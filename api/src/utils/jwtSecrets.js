const ApiError = require('./ApiError');

// Centralizamos la lectura de claves para que los servicios y middlewares validen igual.
const getJwtSecret = (envName) => {
  const secret = process.env[envName];
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new ApiError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'El servicio de autenticación no está configurado'
    );
  }
  return secret;
};

module.exports = { getJwtSecret };
