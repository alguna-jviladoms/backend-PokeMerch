const ApiError = require('./ApiError');

// Producte y Usuari conservan UUID como _id; comprobamos el formato antes de consultar MongoDB.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateUuid = (id) => {
  if (!UUID_REGEX.test(id)) {
    throw new ApiError(400, 'INVALID_ID', 'El ID no tiene un formato válido', [
      { field: 'id', message: 'Debe ser un UUID válido' },
    ]);
  }
};

module.exports = validateUuid;
