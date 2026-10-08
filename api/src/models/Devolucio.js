// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// aqui se crea el esquema de las devoluciones con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const devolucioSchema = new mongoose.Schema(
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
    linea_id: {
      type: String,
      required: [true, 'El linea_id es obligatorio'],  // - required: es obligatorio
      ref: 'LiniaComanda',  // - ref: referencia al model LiniaComanda para poder hacer populate
      index: true,    // que use un índice
    },
    motivo: {
      type: String,
      required: [true, 'El motivo es obligatorio'],  // - required: es obligatorio
      trim: true,   // - trim: elimina los espacios innecesarios
      minlength: [5, 'El motivo debe tener al menos 5 caracteres'],  // - min y max length: longitud minima y maxima
      maxlength: [500, 'El motivo no puede superar los 500 caracteres'],
    },
    estado: {
      type: String,
      required: [true, 'El estado es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['solicitada', 'aprobada', 'rechazada', 'reembolsada'],
        message: 'El estado "{VALUE}" no es valido',
      },
      default: 'solicitada',   // por defecto ponemos el estado solicitada
      index: true,    // que use un índice
    },
    monto_reembolso: {
      type: Number,
      required: [true, 'El monto_reembolso es obligatorio'],  // - required: es obligatorio
      min: [0, 'El monto_reembolso no puede ser negativo'],  // - min: no puede ser negativo
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

// creamos un índice estado ascendente, pedido ascendente.
devolucioSchema.index({ estado: 1, pedido_id: 1 });

// esto es para assegurar que el campo motivo cumple con los requisitos. se verifica antes de enviarlo a la DB
devolucioSchema.pre('save', function (next) {
  if (this.isModified('motivo')) this.motivo = this.motivo.trim();
  next();
});

// Añade un método estático al modelo. que devuelve las devoluciones de un pedido
devolucioSchema.statics.porPedido = function (pedido_id) {
  return this.find({ pedido_id }).select('linea_id motivo estado monto_reembolso');
};

// Compila el esquema y exporta el modelo Devolucio
module.exports = mongoose.model('Devolucio', devolucioSchema);
