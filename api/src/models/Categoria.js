// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// aqui se crea el esquema de las categorias con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const categoriaSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    categoria_padre_id: {
      type: String,
      required: false,  // - required: no es obligatorio, una categoría raíz no tiene padre
      ref: 'Categoria', // - autorreferencia: permite crear jerarquías de subcategorías
      default: null,    // por defecto es una categoría raíz
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'], // - required: es obligatorio
      unique: true,   // - unique: que sea unico
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [80, 'El nombre no puede superar los 80 caracteres'],
      index: true,    // que use un índice
    },
    descripcion: {
      type: String,
      required: false,  // - required: no es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      maxlength: [500, 'La descripcion no puede superar los 500 caracteres'],
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

// creamos un índice categoria_padre ascendente, nombre ascendente.
categoriaSchema.index({ categoria_padre_id: 1, nombre: 1 });

// esto es para assegurar que el campo nombre cumple con los requisitos. se verifica antes de enviarlo a la DB
categoriaSchema.pre('save', function (next) {
  if (this.isModified('nombre')) this.nombre = this.nombre.trim();
  next();
});

// Añade un método estático al modelo. que devuelve las categorías raíz (sin padre)
categoriaSchema.statics.raices = function () {
  return this.find({ categoria_padre_id: null }).select('nombre descripcion');
};

// Compila el esquema y exporta el modelo Categoria
module.exports = mongoose.model('Categoria', categoriaSchema);
