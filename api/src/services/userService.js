const bcrypt = require('bcrypt');
const User = require('../models/Usuari');
const ApiError = require('../utils/ApiError');
const validateUuid = require('../utils/validateUuid');
const { parseListQuery } = require('../utils/listQuery');

// Solo estos campos se pueden modificar con PUT. role y active quedan fuera de la lista.
const EDITABLE_FIELDS = new Set(['name', 'email', 'password']);
const BCRYPT_ROUNDS = 12;
const USER_SORT_FIELDS = new Set(['name', 'email', 'role', 'active', 'createdAt', 'updatedAt']);

// Comprueba el body y crea un objeto nuevo con los campos permitidos.
// Así evitamos guardar propiedades extra enviadas por el cliente, como role o passwordHash.
const pickAllowedFields = (input, allowedFields) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'BAD_REQUEST', 'El body debe ser un objeto JSON');
  }

  const unexpectedFields = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    throw new ApiError(
      400,
      'FIELD_NOT_ALLOWED',
      'La petición contiene campos no permitidos',
      unexpectedFields.map((field) => ({ field, message: 'No se puede modificar este campo' }))
    );
  }

  const selectedFields = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) selectedFields[field] = input[field];
  }
  return selectedFields;
};

// Comprueba los datos que no valida Mongoose por sí solo (la contraseña original).
const validatePassword = (password) => {
  if (typeof password !== 'string' || Array.from(password).length < 12) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Les dades no són vàlides', [
      { field: 'password', message: 'Debe tener al menos 12 caracteres' },
    ]);
  }
};

const createUser = async (input) => {
  const data = pickAllowedFields(input, new Set(['name', 'email', 'password']));
  const missingFields = ['name', 'email', 'password'].filter((field) =>
    !Object.prototype.hasOwnProperty.call(data, field) || data[field] === '' || data[field] == null
  );
  if (missingFields.length > 0) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Les dades no són vàlides',
      missingFields.map((field) => ({ field, message: 'Este campo es obligatorio' }))
    );
  }

  validatePassword(data.password);

  // BCrypt convierte la contraseña original en un hash irreversible antes de guardar.
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = new User({
    name: data.name,
    email: data.email,
    passwordHash,
    role: 'client', // El cliente no puede elegirse un rol administrativo.
    active: true,
  });

  return user.save();
};

const getUsers = async (queryParams = {}) => {
  const { filter, sort, page, limit, skip } = parseListQuery(queryParams, USER_SORT_FIELDS);
  const [users, total] = await Promise.all([
    User.find(filter).select('name email role active createdAt updatedAt').sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getUserById = async (id) => {
  validateUuid(id);
  const user = await User.findById(id).select('name email role active createdAt updatedAt');
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
  return user;
};

const updateUser = async (id, input) => {
  validateUuid(id);
  const data = pickAllowedFields(input, EDITABLE_FIELDS);
  if (Object.keys(data).length === 0) {
    throw new ApiError(400, 'BAD_REQUEST', 'Indica al menos un campo modificable');
  }

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');

  // Copiamos únicamente nombre y email; si llega password, guardamos su hash, nunca el texto.
  if (Object.prototype.hasOwnProperty.call(data, 'name')) user.name = data.name;
  if (Object.prototype.hasOwnProperty.call(data, 'email')) user.email = data.email;
  if (Object.prototype.hasOwnProperty.call(data, 'password')) {
    validatePassword(data.password);
    user.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  }

  return user.save();
};

const deactivateUser = async (id) => {
  validateUuid(id);
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');

  // Baja lógica: conservamos el documento para mantener el historial y lo marcamos inactivo.
  user.active = false;
  await user.save();
  return user;
};

module.exports = { createUser, getUsers, getUserById, updateUser, deactivateUser };
