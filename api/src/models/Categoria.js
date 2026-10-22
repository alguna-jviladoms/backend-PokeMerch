// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');

// aqui se crea el esquema de las categorias con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const categoriaSchema = new mongoose.Schema(
  {
    categoria_padre_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,  // - required: no es obligatorio, una categoría raíz no tiene padre
      ref: 'Category', // - autorreferencia: permite crear jerarquías de subcategorías
      default: null,    // por defecto es una categoría raíz
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'], // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],  // - longitud minima del nombre
      maxlength: [80, 'El nombre no puede superar los 80 caracteres'],
      index: true,    // que use un índice
    },
    slug: {
      type: String,
      required: [true, 'El slug es obligatorio'],
      unique: true, // MongoDB impide duplicados; el servicio traduce el error de índice 11000.
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: false,  // - required: no es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      maxlength: [500, 'La descripcion no puede superar los 500 caracteres'],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,    // elimina el campo __v que Mongoose añade por defecto
    timestamps: true, // Mongoose gestiona automáticamente createdAt y updatedAt.
    toJSON: {   // convierte a JSON
      virtuals: true,   // incluye campos virtuales, como id. Que son los que se generan de manera dinamica y no se guardan automaticamente
      transform: (doc, ret) => {  // antes de devolver el JSON, elimina id. Así no se devuelve el id duplicado (ya devolvemos _id)
        delete ret.id;
        return ret;
      },
    },
  }
);

// creamos un índice categoria_padre ascendente, name ascendente.
categoriaSchema.index({ categoria_padre_id: 1, name: 1 });

// esto es para assegurar que el campo nombre cumple con los requisitos. se verifica antes de enviarlo a la DB
categoriaSchema.pre('save', function () {
  if (this.isModified('name')) this.name = this.name.trim();
  if (this.isModified('slug')) this.slug = this.slug.toLowerCase().trim();
});

// Añade un método estático al modelo. que devuelve las categorías raíz (sin padre)
categoriaSchema.statics.raices = function () {
  return this.find({ categoria_padre_id: null }).select('name slug description active');
};

// Compila el esquema como Category; Product.category usa ref: 'Category'.
module.exports = mongoose.model('Category', categoriaSchema);
