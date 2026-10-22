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
  message: 'El correo no puede pertenecer a un servicio temporal',
};

// Comprueba que el campo de base de datos contenga un hash BCrypt, no una contraseña en claro.
const hashValid = {
  validator: (v) => typeof v === 'string' && /^\$2[aby]\$/.test(v) && v.length === 60,
  message: 'passwordHash debe contener un hash BCrypt válido',
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
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'], // - required: es obligatorio
      trim: true,    // - trim: elimina los espacios innecesarios
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
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
    passwordHash: {
      type: String,
      required: [true, 'El passwordHash es obligatorio'],
      validate: hashValid,    // - validate: llamamos a la funcion para validar si es valido 
      select: false, // Mongoose no incluye la contraseña hash en las consultas por defecto.
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
    role: {
      type: String,
      required: [true, 'El rol es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['client', 'admin'],
        message: 'El rol "{VALUE}" no es valido',
      },
      default: 'client',   // El rol normal se asigna en el servidor, no desde el body.
      index: true,    // que use un índice
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,    // elimina el campo __v que Mongoose añade por defecto
    timestamps: true, // Añade createdAt y updatedAt automáticamente.
    toJSON: {   // convierte a JSON
      virtuals: true,   // incluye campos virtuales, como id. Que son los que se generan de manera dinamica y no se guradan automaticamente
      transform: (doc, ret) => {  // Nunca devolvemos el hash de contraseña ni el id virtual duplicado.
        delete ret.passwordHash;
        delete ret.id;
        return ret;
      },
    },
  }
);

// Índice para buscar usuarios por rol y fecha de creación.
usuariSchema.index({ role: 1, createdAt: -1 });

// esto es para assegurar que los campos de nombre y email cumplen con los requisitos. se verifica antes de enviarlo a la DB
usuariSchema.pre('save', function () {
  if (this.isModified('email')) this.email = this.email.toLowerCase().trim();
  if (this.isModified('name')) this.name = this.name.trim();
});

// Método de consulta: devuelve usuarios activos de un rol y omite passwordHash.
usuariSchema.statics.activosPorRol = function (role) {
  return this.find({ role, active: true }).select('name email telefono createdAt');
};

// Conservamos el nombre Usuari porque los demás esquemas ya lo usan en sus referencias.
module.exports = mongoose.model('Usuari', usuariSchema);
