// importamos moongoose que es para trabajar con mongoDB
const mongoose = require('mongoose');
// importramos para generar id random en mongoDB
const { randomUUID } = require('node:crypto');

// aqui se crea el esquema de los pedidos con sus atributos
  // declara el tipo de atributo
  // - declaramos los requisitos de cada atributos como:
const comandaSchema = new mongoose.Schema(
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
    direccion_envio_id: {
      type: String,
      required: [true, 'El direccion_envio_id es obligatorio'],  // - required: es obligatorio
      ref: 'Direccio',  // - ref: referencia al model Direccio para poder hacer populate
      index: true,    // que use un índice
    },
    cupon_id: {
      type: String,
      required: false,  // - required: no es obligatorio, un pedido puede no tener cupón
      ref: 'Cupo',  // - ref: referencia al model Cupo para poder hacer populate
      default: null,    // por defecto no tiene cupón
      index: true,    // que use un índice
    },
    fecha_pedido: {
      type: Date,
      required: [true, 'La fecha_pedido es obligatoria'], // - required: es obligatorio
      default: () => new Date(),  // ponemos la fecha actual
      immutable: true,    // hacemos que el atributo no se pueda modificar
    },
    estado: {
      type: String,
      required: [true, 'El estado es obligatorio'],  // - required: es obligatorio
      enum: { // solamente te deja guardar uno de los valores definidos, si intentas guardar otro peta
        values: ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'],
        message: 'El estado "{VALUE}" no es valido',
      },
      default: 'pendiente',   // por defecto ponemos el estado pendiente
      index: true,    // que use un índice
    },
    total: {
      type: Number,
      required: [true, 'El total es obligatorio'],  // - required: es obligatorio
      min: [0, 'El total no puede ser negativo'],  // - min: no puede ser negativo
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

// creamos un índice usuario ascendente, fecha_pedido descendente.
comandaSchema.index({ usuario_id: 1, fecha_pedido: -1 });

// creamos un índice estado ascendente, fecha_pedido descendente.
comandaSchema.index({ estado: 1, fecha_pedido: -1 });

// Añade un método estático al modelo. que devuelve los pedidos de un usuario
comandaSchema.statics.porUsuario = function (usuario_id) {
  return this.find({ usuario_id }).select('direccion_envio_id cupon_id fecha_pedido estado total');
};

// Compila el esquema y exporta el modelo Comanda
module.exports = mongoose.model('Comanda', comandaSchema);
