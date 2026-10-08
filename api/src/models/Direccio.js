// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// esto es para hacer purga en el campo Codigo Postal
const CODI_POSTAL_REGEX = /^\d{5}$/;

// aqui se crea el esquema de las direcciones con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const direccioSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    usuario_id: {
      type: String,
      required: [true, 'El usuario_id es obligatorio'],  // - required: es obligatorio
      ref: 'Usuari',    // - ref: referencia al model Usuari para poder hacer populate
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    calle: {
      type: String,
      required: [true, 'La calle es obligatoria'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [2, 'La calle debe tener al menos 2 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [150, 'La calle no puede superar los 150 caracteres'],
    },
    ciudad: {
      type: String,
      required: [true, 'La ciudad es obligatoria'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [2, 'La ciudad debe tener al menos 2 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [80, 'La ciudad no puede superar los 80 caracteres'],
      index: true,    // que use un índice
    },
    codigo_postal: {
      type: String,
      required: [true, 'El codigo_postal es obligatorio'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      match: [CODI_POSTAL_REGEX, 'El codigo_postal debe tener 5 digitos'],  // - match: para revisar si contiene algun caracter de las constantes declaradas
    },
    pais: {
      type: String,
      required: [true, 'El pais es obligatorio'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      default: 'España',   // por defecto ponemos España
      maxlength: [60, 'El pais no puede superar los 60 caracteres'],
    },
    tipo: {
      type: String,
      required: [true, 'El tipo es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['envio', 'facturacion'],
        message: 'El tipo "{VALUE}" no es valido',
      },
      default: 'envio',   // por defecto ponemos el tipo envio
      index: true,    // que use un índice
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

// creamos un índice usuario ascendente, tipo ascendente.
direccioSchema.index({ usuario_id: 1, tipo: 1 });

// esto es para assegurar que los campos de texto cumplen con los requisitos. se verifica antes de enviarlo a la DB
direccioSchema.pre('save', function (next) {
  if (this.isModified('calle')) this.calle = this.calle.trim();
  if (this.isModified('ciudad')) this.ciudad = this.ciudad.trim();
  if (this.isModified('pais')) this.pais = this.pais.trim();
  next();
});

// Añade un método estático al modelo. que devuelve las direcciones de un usuario
direccioSchema.statics.porUsuario = function (usuario_id) {
  return this.find({ usuario_id }).select('calle ciudad codigo_postal pais tipo');
};

// Compila el esquema y exporta el modelo Direccio
module.exports = mongoose.model('Direccio', direccioSchema);
