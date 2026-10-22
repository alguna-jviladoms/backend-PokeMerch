const ApiError = require('./ApiError');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const ALLOWED_PARAMETERS = new Set(['active', 'name', 'sort', 'page', 'limit']);

// Convierte y valida page/limit. No aceptamos decimales, cero, negativos ni texto.
const parsePositiveInteger = (value, field, defaultValue) => {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ApiError(400, 'INVALID_QUERY', `${field} debe ser un entero positivo`, [
      { field, message: 'Usa un entero mayor que cero' },
    ]);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiError(400, 'INVALID_QUERY', `${field} está fuera del rango permitido`, [
      { field, message: 'El valor es demasiado grande' },
    ]);
  }
  return parsed;
};

// Escapa caracteres especiales para que name se busque literalmente y no como regex libre.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Express puede entregar arrays si un parámetro aparece repetido; aquí solo aceptamos un valor.
const getSingleValue = (query, field) => {
  const value = query[field];
  if (value !== undefined && typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_QUERY', `${field} debe tener un solo valor`, [
      { field, message: 'Envía este parámetro una sola vez' },
    ]);
  }
  return value;
};

// Utilidad compartida por categorías y usuarios para evitar duplicar reglas de lista.
const parseListQuery = (query, allowedSortFields) => {
  const unknownParameters = Object.keys(query).filter((key) => !ALLOWED_PARAMETERS.has(key));
  if (unknownParameters.length) {
    throw new ApiError(400, 'INVALID_QUERY', 'La consulta contiene parámetros no permitidos',
      unknownParameters.map((field) => ({ field, message: 'Parámetro no permitido' })));
  }

  const page = parsePositiveInteger(getSingleValue(query, 'page'), 'page', DEFAULT_PAGE);
  const limit = parsePositiveInteger(getSingleValue(query, 'limit'), 'limit', DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) {
    throw new ApiError(400, 'INVALID_QUERY', `limit no puede superar ${MAX_LIMIT}`, [
      { field: 'limit', message: `El máximo permitido es ${MAX_LIMIT}` },
    ]);
  }

  const filter = {};
  const active = getSingleValue(query, 'active');
  if (active !== undefined) {
    if (active !== 'true' && active !== 'false') {
      throw new ApiError(400, 'INVALID_QUERY', 'active debe ser true o false', [
        { field: 'active', message: 'Usa true o false' },
      ]);
    }
    filter.active = active === 'true';
  }

  const nameQuery = getSingleValue(query, 'name');
  if (nameQuery !== undefined) {
    const name = nameQuery.trim();
    if (!name) {
      throw new ApiError(400, 'INVALID_QUERY', 'name no puede estar vacío', [
        { field: 'name', message: 'Escribe al menos un carácter' },
      ]);
    }
    filter.name = { $regex: escapeRegExp(name), $options: 'i' };
  }

  const sort = {};
  const sortQuery = getSingleValue(query, 'sort');
  if (sortQuery !== undefined) {
    const descending = sortQuery.startsWith('-');
    const field = descending ? sortQuery.slice(1) : sortQuery;
    if (!allowedSortFields.has(field)) {
      throw new ApiError(400, 'INVALID_QUERY', 'El campo de ordenación no está permitido', [
        { field: 'sort', message: `Campos permitidos: ${[...allowedSortFields].join(', ')}` },
      ]);
    }
    sort[field] = descending ? -1 : 1;
  } else {
    sort.createdAt = -1; // El orden predeterminado muestra primero los registros más recientes.
  }

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};

module.exports = { parseListQuery };
