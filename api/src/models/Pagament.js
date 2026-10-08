// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// aqui se crea el esquema de los pagos con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const pagamentSchema = new mongoose.Schema(
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
    metodo: {
      type: String,
      required: [true, 'El metodo es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['tarjeta', 'paypal', 'transferencia', 'contrareembolso'],
        message: 'El metodo "{VALUE}" no es valido',
      },
    },
    monto: {
      type: Number,
      required: [true, 'El monto es obligatorio'],  // - required: es obligatorio
      min: [0, 'El monto no puede ser negativo'],  // - min: no puede ser negativo
    },
    estado: {
      type: String,
      required: [true, 'El estado es obligatorio'],  // - required: es obligatorio
      enum: {
        values: ['pendiente', 'completado', 'fallido', 'reembolsado'],
        message: 'El estado "{VALUE}" no es valido',
      },
      default: 'pendiente',   // por defecto ponemos el estado pendiente
      index: true,    // que use un índice
    },
    fecha_pago: {
      type: Date,
      required: [true, 'La fecha_pago es obligatoria'], // - required: es obligatorio
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

// creamos un índice estado ascendente, fecha_pago descendente.
pagamentSchema.index({ estado: 1, fecha_pago: -1 });

// Añade un método estático al modelo. que devuelve los pagos de un pedido
pagamentSchema.statics.porPedido = function (pedido_id) {
  return this.find({ pedido_id }).select('metodo monto estado fecha_pago');
};

// Compila el esquema y exporta el modelo Pagament
module.exports = mongoose.model('Pagament', pagamentSchema);
