// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// esto es para validar el formato del codigo del cupón
  // - admite mayúsculas, números y guiones, con una longitud de 3 a 20
const CODI_REGEX = /^[A-Z0-9-]{3,20}$/;

// valida que el usos_max sea un numero entero
const esEnter = {
  validator: (v) => Number.isInteger(v),
  message: 'El usos_max ha de ser un nombre enter',
};

// valida que si el descuento es en porcentaje no supere el 100
const valorValid = {
  validator: function (v) {
    return this.tipo_descuento !== 'porcentaje' || v <= 100;
  },
  message: 'Si el tipo_descuento es porcentaje, el valor no puede superar 100',
};

// valida que la fecha_fin sea posterior a la fecha_inicio
const datesValides = {
  validator: function (v) {
    return !this.fecha_inicio || v > this.fecha_inicio;
  },
  message: 'La fecha_fin ha de ser posterior a la fecha_inicio',
};

// aqui se crea el esquema de los cupones con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const cupoSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    codigo: {
      type: String,
      required: [true, 'El codigo es obligatorio'],  // - required: es obligatorio
      unique: true,   // - unique: que sea unico
      trim: true,   // - trim: elimina los espacios innecesarios
      uppercase: true,   // - uppercase: todo a mayúsculas
      match: [CODI_REGEX, 'El codigo solo puede contener mayusculas, numeros y guiones'],   // - match: para revisar si contiene algun caracter de las constantes declaradas
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    tipo_descuento: {
      type: String,
      required: [true, 'El tipo_descuento es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['porcentaje', 'fijo'],
        message: 'El tipo_descuento "{VALUE}" no es valido',
      },
      default: 'fijo',   // por defecto ponemos descuento fijo
      index: true,    // que use un índice
    },
    valor: {
      type: Number,
      required: [true, 'El valor es obligatorio'],  // - required: es obligatorio
      min: [0, 'El valor no puede ser negativo'],  // - min: no puede ser negativo
      validate: valorValid,   // - validate: llamamos a la funcion para validar el valor segun el tipo
    },
    fecha_inicio: {
      type: Date,
      required: [true, 'La fecha_inicio es obligatoria'], // - required: es obligatorio
      default: () => new Date(),  // ponemos la fecha actual
    },
    fecha_fin: {
      type: Date,
      required: [true, 'La fecha_fin es obligatoria'], // - required: es obligatorio
      validate: datesValides,   // - validate: llamamos a la funcion para validar que sea posterior a fecha_inicio
    },
    usos_max: {
      type: Number,
      required: [true, 'El usos_max es obligatorio'],  // - required: es obligatorio
      min: [1, 'El usos_max debe ser como minimo 1'],  // - min: como minimo 1 uso
      validate: esEnter,    // - validate: llamamos a la funcion para validar que sea entero
    },
  },
  {
    versionKey: false,    // elimina el campo __v que Mongoose añade por defecto
    toJSON: {   // convierte a JSON
      virtuals: true,   // incluye campos virtuales, como id. Que son los que se generan de manera dinamica y no se guardan automaticamente
      transform: (doc, ret) => {  // antes de devolver el JSON, elimina id. Así no se devuelve el id duplicado (ya devolvemos _id)
        delete ret.id;
        return ret;
      },
    },
  }
);

// creamos un índice tipo_descuento ascendente, fecha_fin descendente.
cupoSchema.index({ tipo_descuento: 1, fecha_fin: -1 });

// esto es para assegurar que el campo codigo cumple con los requisitos. se verifica antes de enviarlo a la DB
cupoSchema.pre('save', function (next) {
  if (this.isModified('codigo')) this.codigo = this.codigo.toUpperCase().trim();
  next();
});

// Añade un método estático al modelo. que devuelve los cupones vigentes en la fecha actual
cupoSchema.statics.vigentes = function () {
  const ara = new Date();
  return this.find({ fecha_inicio: { $lte: ara }, fecha_fin: { $gte: ara } })
    .select('codigo tipo_descuento valor fecha_inicio fecha_fin usos_max');
};

// Compila el esquema y exporta el modelo Cupo
module.exports = mongoose.model('Cupo', cupoSchema);
