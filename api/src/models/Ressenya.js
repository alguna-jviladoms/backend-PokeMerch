// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// valida que la calificacion sea un numero entero
const esEnter = {
  validator: (v) => Number.isInteger(v),
  message: 'La calificacion ha de ser un nombre enter',
};

// aqui se crea el esquema de las reseñas con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const ressenyaSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    producto_id: {
      type: String,
      required: [true, 'El producto_id es obligatorio'],  // - required: es obligatorio
      ref: 'Producte',  // - ref: referencia al model Producte para poder hacer populate
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    usuario_id: {
      type: String,
      required: [true, 'El usuario_id es obligatorio'],  // - required: es obligatorio
      ref: 'Usuari',    // - ref: referencia al model Usuari para poder hacer populate
      index: true,    // que use un índice
    },
    calificacion: {
      type: Number,
      required: [true, 'La calificacion es obligatoria'],  // - required: es obligatorio
      min: [1, 'La calificacion debe estar entre 1 y 5'],  // - min: como minimo 1
      max: [5, 'La calificacion debe estar entre 1 y 5'],  // - max: como maximo 5
      validate: esEnter,    // - validate: llamamos a la funcion para validar que sea entero
    },
    comentario: {
      type: String,
      required: false,  // - required: no es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      maxlength: [1000, 'El comentario no puede superar los 1000 caracteres'],
    },
    fecha: {
      type: Date,
      required: [true, 'La fecha es obligatoria'], // - required: es obligatorio
      default: () => new Date(),  // ponemos la fecha actual
      immutable: true,    // hacemos que el atributo no se pueda modificar
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

// creamos un índice único producto ascendente, usuario ascendente. un usuario solo puede reseñar una vez el mismo producto
ressenyaSchema.index({ producto_id: 1, usuario_id: 1 }, { unique: true });

// creamos un índice producto ascendente, fecha descendente.
ressenyaSchema.index({ producto_id: 1, fecha: -1 });

// esto es para assegurar que el campo comentario cumple con los requisitos. se verifica antes de enviarlo a la DB
ressenyaSchema.pre('save', function (next) {
  if (this.isModified('comentario') && this.comentario) this.comentario = this.comentario.trim();
  next();
});

// Añade un método estático al modelo. que devuelve las reseñas de un producto
ressenyaSchema.statics.porProducto = function (producto_id) {
  return this.find({ producto_id }).select('usuario_id calificacion comentario fecha');
};

// Compila el esquema y exporta el modelo Ressenya
module.exports = mongoose.model('Ressenya', ressenyaSchema);
