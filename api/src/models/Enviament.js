// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// aqui se crea el esquema de los envios con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const enviamentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(), // - el id lo genera como UUID aleatorio como string no como el ObjectId de MongoDB
    },
    pedido_id: {
      type: String,
      required: [true, 'El pedido_id es obligatorio'],  // - required: es obligatorio
      ref: 'Comanda',   // - ref: referencia al model Comanda para poder hacer populate
      index: true,    // - index: le marcamos que use un índice de mongo que declararemos dentro
    },
    transportista: {
      type: String,
      required: [true, 'El transportista es obligatorio'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [2, 'El transportista debe tener al menos 2 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [80, 'El transportista no puede superar los 80 caracteres'],
    },
    num_seguimiento: {
      type: String,
      required: [true, 'El num_seguimiento es obligatorio'],  // - required: es obligatorio
      unique: true,   // - unique: que sea unico
      trim: true,   // - trim: elimina los espacios innecesarios
      uppercase: true,   // - uppercase: todo a mayúsculas
      index: true,    // que use un índice
    },
    estado: {
      type: String,
      required: [true, 'El estado es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['preparando', 'en_camino', 'entregado', 'devuelto'],
        message: 'El estado "{VALUE}" no es valido',
      },
      default: 'preparando',   // por defecto ponemos el estado preparando
      index: true,    // que use un índice
    },
    fecha_envio: {
      type: Date,
      required: [true, 'La fecha_envio es obligatoria'], // - required: es obligatorio
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

// creamos un índice estado ascendente, fecha_envio descendente.
enviamentSchema.index({ estado: 1, fecha_envio: -1 });

// esto es para assegurar que los campos de texto cumplen con los requisitos. se verifica antes de enviarlo a la DB
enviamentSchema.pre('save', function (next) {
  if (this.isModified('transportista')) this.transportista = this.transportista.trim();
  if (this.isModified('num_seguimiento')) this.num_seguimiento = this.num_seguimiento.toUpperCase().trim();
  next();
});

// Añade un método estático al modelo. que devuelve los envios de un pedido
enviamentSchema.statics.porPedido = function (pedido_id) {
  return this.find({ pedido_id }).select('transportista num_seguimiento estado fecha_envio');
};

// Compila el esquema y exporta el modelo Enviament
module.exports = mongoose.model('Enviament', enviamentSchema);
