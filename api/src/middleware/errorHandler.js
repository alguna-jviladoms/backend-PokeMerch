const ApiError = require('../utils/ApiError');

// Convierte los errores de validación de Mongoose en una lista fácil de corregir en Postman.
const getValidationDetails = (error) =>
  Object.values(error.errors).map((fieldError) => ({
    field: fieldError.path,
    message: fieldError.message,
  }));

// Los índices unique pertenecen a MongoDB; por eso sus duplicados llegan como código 11000.
const getDuplicateError = (error) => {
  const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
  const knownDuplicates = {
    email: ['DUPLICATE_EMAIL', 'Ya existe un usuario con ese email'],
    slug: ['DUPLICATE_SLUG', 'Ya existe una categoría con ese slug'],
    sku: ['DUPLICATE_SKU', 'Ya existe un producto con ese SKU'],
  };
  const [code, message] = knownDuplicates[duplicateField] || [
    'DUPLICATE_VALUE',
    'Ya existe un recurso con ese valor',
  ];

  return new ApiError(409, code, message, [
    { field: duplicateField || 'unknown', message: 'El valor ya está en uso' },
  ]);
};

// Middleware global de errores: Express llega aquí cuando una ruta llama next(error)
// o cuando una función async de Express 5 lanza/rechaza una promesa.
const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let apiError = error;

  if (error.code === 11000) {
    apiError = getDuplicateError(error);
  } else if (error.name === 'ValidationError') {
    apiError = new ApiError(
      422,
      'VALIDATION_ERROR',
      'Les dades no són vàlides',
      getValidationDetails(error)
    );
  } else if (error.name === 'CastError') {
    apiError = new ApiError(400, 'INVALID_ID', 'El ID no tiene un formato válido', [
      { field: error.path || 'id', message: 'Comprueba el formato del identificador' },
    ]);
  } else if (error.type === 'entity.parse.failed') {
    apiError = new ApiError(400, 'BAD_REQUEST', 'El JSON de la petición no es válido');
  } else if (!(error instanceof ApiError)) {
    // Un error no previsto nunca devuelve su mensaje, stack ni datos internos al cliente.
    apiError = new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }

  const errorResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  };
  if (apiError.details?.length) errorResponse.error.details = apiError.details;

  return res.status(apiError.statusCode).json(errorResponse);
};

module.exports = errorHandler;
