// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// esto es para validar el formato del SKU
  // - admite mayúsculas, números y guiones, con una longitud de 3 a 30
const SKU_REGEX = /^[A-Z0-9-]{3,30}$/;

// aqui se crea el esquema de los productos con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const producteSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    categoria_id: {
      type: String,
      required: [true, 'El categoria_id es obligatorio'], // - required: es obligatorio
      ref: 'Categoria', // - ref: referencia al model Categoria para poder hacer populate
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'], // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [100, 'El nombre no puede superar los 100 caracteres'],
    },
    descripcion: {
      type: String,
      required: false,  // - required: no es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      maxlength: [2000, 'La descripcion no puede superar los 2000 caracteres'],
    },
    precio: {
      type: Number,
      required: [true, 'El precio es obligatorio'],  // - required: es obligatorio
      min: [0, 'El precio no puede ser negativo'],  // - min: no puede ser negativo
      validate: {
        validator: (v) => Number.isInteger(v * 100),
        message: (props) => `El precio ${props.value} no puede tener más de 2 decimales`,
      },
    },
    sku: {
      type: String,
      required: [true, 'El sku es obligatorio'],  // - required: es obligatorio
      unique: true,   // - unique: que sea unico
      trim: true,   // - trim: elimina los espacios innecesarios
      uppercase: true,   // - uppercase: todo a mayúsculas
      match: [SKU_REGEX, 'El sku solo puede contener mayusculas, numeros y guiones'],   // - match: para revisar si contiene algun caracter de las constantes declaradas
      index: true,    // que use un índice
    },
    activo: {
      type: Boolean,
      required: [true, 'El activo es obligatorio'], // - required: es obligatorio
      default: true,   // por defecto el producto está activo
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

// creamos un índice categoria ascendente, nombre ascendente.
producteSchema.index({ categoria_id: 1, nombre: 1 });

// esto es para assegurar que los campos de nombre y sku cumplen con los requisitos. se verifica antes de enviarlo a la DB
producteSchema.pre('save', function (next) {
  if (this.isModified('nombre')) this.nombre = this.nombre.trim();
  if (this.isModified('sku')) this.sku = this.sku.toUpperCase().trim();
  next();
});

// Añade un método estático al modelo. que devuelve los productos activos de una categoría
producteSchema.statics.activosPorCategoria = function (categoria_id) {
  return this.find({ categoria_id, activo: true }).select('nombre descripcion precio sku');
};

// Compila el esquema y exporta el modelo Producte
module.exports = mongoose.model('Producte', producteSchema);
