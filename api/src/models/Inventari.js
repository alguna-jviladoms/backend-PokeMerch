// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// valida que la cantidad sea un numero entero
const esEnter = {
  validator: (v) => Number.isInteger(v),
  message: 'La cantidad ha de ser un nombre enter',
};

// aqui se crea el esquema del inventario con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const inventariSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    producto_id: {
      type: String,
      required: [true, 'El producto_id es obligatorio'],  // - required: es obligatorio
      unique: true,   // - unique: relación 1:1, cada producto tiene una sola ficha de inventario
      ref: 'Producte',    // - ref: referencia al model Producte para poder hacer populate
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    cantidad: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],  // - required: es obligatorio
      min: [0, 'La cantidad no puede ser negativa'],  // - min: no puede ser negativa
      validate: esEnter,    // - validate: llamamos a la funcion para validar que sea entero
    },
    almacen: {
      type: String,
      required: [true, 'El almacen es obligatorio'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [2, 'El almacen debe tener al menos 2 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [80, 'El almacen no puede superar los 80 caracteres'],
      index: true,    // que use un índice
    },
    actualizado_en: {
      type: Date,
      required: [true, 'La fecha actualizado_en es obligatoria'], // - required: es obligatorio
      default: () => new Date(),  // ponemos la fecha actual
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

// creamos un índice almacen ascendente, cantidad ascendente.
inventariSchema.index({ almacen: 1, cantidad: 1 });

// actualiza la fecha cada vez que se modifica el stock. se verifica antes de enviarlo a la DB
inventariSchema.pre('save', function (next) {
  if (this.isModified('cantidad') || this.isModified('almacen')) {
    this.actualizado_en = new Date();
  }
  next();
});

// Añade un método estático al modelo. que devuelve el stock de un almacén
inventariSchema.statics.porAlmacen = function (almacen) {
  return this.find({ almacen }).select('producto_id cantidad actualizado_en');
};

// Compila el esquema y exporta el modelo Inventari
module.exports = mongoose.model('Inventari', inventariSchema);
