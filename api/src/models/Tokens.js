const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

// Una sesión representa un dispositivo/navegador con su refresh token vigente.
const tokensSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => randomUUID(),
    },
    userId: {
      type: String,
      ref: 'Usuari',
      required: [true, 'El usuario de la sesión es obligatorio'],
      index: true,
    },
    // Guardamos el SHA-256 del refresh token, nunca el token que recibe el cliente.
    tokenHash: {
      type: String,
      required: [true, 'El hash del refresh token es obligatorio'],
      select: false,
    },
    // Cada rotación cambia jti; así detectamos que se presente un token ya sustituido.
    currentJti: {
      type: String,
      required: [true, 'El identificador del refresh token es obligatorio'],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'La fecha de expiración es obligatoria'],
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokeReason: {
      type: String,
      enum: [null, 'refresh_token_reuse', 'logout', 'manual'],
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

// MongoDB elimina sesiones caducadas automáticamente; la expiración del JWT se valida aparte.
tokensSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Conservamos el nombre de la colección para que las sesiones ya guardadas sigan disponibles.
module.exports = mongoose.model('Tokens', tokensSchema, 'refreshsessions');
