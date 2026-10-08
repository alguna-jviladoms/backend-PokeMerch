// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// esto es para hacer purga en los campos de 
  // - Telefono
  // - Email
  // - Email temporales
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO_REGEX = /^[6-9]\d{8}$/;
const DOMINIS_TEMPORALS = /@(tempemail|mailinator|10minutemail|guerrillamail)\./i;

// Funcion para para validar que el email no sea temporal
const emailNoTemporal = {
  validator: (v) => !DOMINIS_TEMPORALS.test(v),
  message: (props) => `El correu ${props.value} pertany a un servei temporal`,
};

// esto es para validar estandares minimos para la seguridad de la password
  // - [A-Z]/.test(v) esto mira que tenga una mayúscula
  // - [a-z]/.test(v) esto mira que tenga una minúscula
  // - /\d/.test(v) esto mira que tenga un numero entre el 0-9
  // - v.length >= 8 esto mira que tenga una longitud igual o mayor a 8
const passwordFort = {
  validator: (v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && v.length >= 8,
  message: 'La contrasenya ha de tenir 8+ caracters, majuscula, minuscula i digit',
};

// valida que el hash de la contraseña sea un string con formato de hash bcrypt
  // - el hash bcrypt es cadena de texto codificada de 60 caracteres que almacena de forma segura una contraseña mediante un algoritmo criptográfico lento y adaptativo
  // - Comcretamente la funcion revisa que inicie con $2a$, $2b$ o $2y$ y que tenga al menos 20 caracteres.
const hashValid = {
  validator: (v) => typeof v === 'string' && v.length >= 20 && /^\$2[aby]\$/.test(v),
  message: 'password_hash ha de ser un hash bcrypt (bcryptjs genera aquest format)',
};

// aqui se crea el esquema del usuario con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:  
const usuariSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'], // - required: es obligatorio
      trim: true,    // - trim: elimina los espacios innecesarios
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],   // - min y max lenght: longitud minima y maxima
      maxlength: [50, 'El nombre no puede superar los 50 caracteres'],
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],  // - required: es obligatorio
      unique: true,    // - unique: que sea unico
      trim: true,   // - trim: elimina los espacios innecesarios
      lowercase: true,    // - lowercase: todo a minúsculas
      match: [EMAIL_REGEX, 'El formato del email no es valido'],    // - match: para revisar si contiene algun caracter de las constantes declaradas 
      validate: emailNoTemporal,    // - validate: llamamos a la funcion para validar que el email no es temporal y marcamos un boleano 
      index: true,    // - index: le marcamos que use un índeice de mongo que declararemos dentro
    },
    password_hash: {
      type: String,
      required: [true, 'El password_hash es obligatorio'],  // - required: es obligatorio
      validate: hashValid,    // - validate: llamamos a la funcion para validar si es valido 
      select: false, // mirar que es
    },
    telefono: {
      type: String,
      required: false,  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      match: [TELEFONO_REGEX, 'El telefono debe tener 9 digitos y empezar por 6, 7, 8 o 9'],    // - match: para revisar si contiene algun caracter de las constantes declaradas 
    },
    fecha_registro: {
      type: Date,
      required: [true, 'La fecha_registro es obligatoria'], // - required: es obligatorio
      default: () => new Date(),  //ponemos la fecha actual
      immutable: true,    //hacemos que el atributo no se pueda modificar
    },
    rol: {
      type: String,
      required: [true, 'El rol es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['cliente', 'admin', 'repartidor'],
        message: 'El rol "{VALUE}" no es valido',
      },
      default: 'cliente',   // por defecto ponemos el rol cliente
      index: true,    // que use un índice
    },
  },
  {
    versionKey: false,    // elimina el campo __v que Mongoose añade por defecto
    toJSON: {   // convierte a JSON
      virtuals: true,   // incluye campos virtuales, como id. Que son los que se generan de manera dinamica y no se guradan automaticamente
      transform: (doc, ret) => {  //antes de devolver el JSON, elimina password_hash y id. Así nunca se filtra el hash de la contraseña.
        delete ret.password_hash;
        delete ret.id;
        return ret;
      },
    },
  }
);

// creamos un índice rol ascendente, fecha_registro descendente.
usuariSchema.index({ rol: 1, fecha_registro: -1 });

// esto es para assegurar que los campos de nombre y email cumplen con los requisitos. se verifica antes de enviarlo a la DB
usuariSchema.pre('save', function (next) {
  if (this.isModified('email')) this.email = this.email.toLowerCase().trim();
  if (this.isModified('nombre')) this.nombre = this.nombre.trim();
  next();
});

// Añade un método estático al modelo. que devuelve los atributos a excepcion de password_hash porque el select es false
usuariSchema.statics.activosPorRol = function (rol) {
  return this.find({ rol }).select('nombre email telefono fecha_registro');
};

// Compila el esquema y exporta el modelo Usuari
module.exports = mongoose.model('Usuari', usuariSchema);