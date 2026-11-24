const bcrypt = require('bcrypt');
const User = require('../models/Usuari');
const userService = require('./userService');
const tokenService = require('./token/tokenService');
const ApiError = require('../utils/ApiError');

const LOGIN_FIELDS = new Set(['email', 'password']);
const REFRESH_FIELDS = new Set(['refreshToken']);

// El body debe ser un objeto normal: evita errores al leer propiedades de null o arrays.
const requireObjectBody = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'BAD_REQUEST', 'El body debe ser un objeto JSON');
  }
};

// Comprueba que el body de login solo contenga los campos esperados.
const validateFields = (input, allowedFields, operation) => {
  requireObjectBody(input);
  const unexpectedFields = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length) {
    throw new ApiError(
      400,
      'FIELD_NOT_ALLOWED',
      'La petición contiene campos no permitidos',
      unexpectedFields.map((field) => ({ field, message: `Campo no permitido para ${operation}` }))
    );
  }
};

const validateLoginFields = (input) => {
  validateFields(input, LOGIN_FIELDS, 'iniciar sesión');
  const missingFields = ['email', 'password'].filter((field) =>
    typeof input[field] !== 'string' || input[field].length === 0
  );
  if (missingFields.length) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Les dades no són vàlides',
      missingFields.map((field) => ({ field, message: 'Este campo es obligatorio' }))
    );
  }
};

const validateRefreshFields = (input) => {
  validateFields(input, REFRESH_FIELDS, 'renovar la sesión');
  if (typeof input.refreshToken !== 'string' || input.refreshToken.length === 0) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Les dades no són vàlides', [
      { field: 'refreshToken', message: 'Este campo es obligatorio' },
    ]);
  }
};

// La API devuelve una vista pública del usuario y nunca expone passwordHash.
const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
});

// Crear cuenta y gestionar su contraseña pertenece a userService; los tokens a tokenService.
const register = async (input, tokenOptions) => {
  tokenService.assertTokenConfiguration();
  const user = await userService.createUser(input);
  const tokens = await tokenService.issueTokens(user, tokenOptions);
  return { user: toPublicUser(user), ...tokens };
};

const login = async (input, tokenOptions) => {
  validateLoginFields(input);
  tokenService.assertTokenConfiguration();

  // Normalizamos el email y pedimos passwordHash solo para verificar la contraseña con BCrypt.
  const email = input.email.trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordIsWithinBcryptLimit = Buffer.byteLength(input.password, 'utf8') <= 72;
  const passwordMatches = user && passwordIsWithinBcryptLimit
    && await bcrypt.compare(input.password, user.passwordHash);

  // El mismo error evita revelar si existe el correo o si la cuenta está desactivada.
  if (!user || !user.active || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
  }

  const tokens = await tokenService.issueTokens(user, tokenOptions);
  return { user: toPublicUser(user), ...tokens };
};

const refresh = async (input) => {
  validateRefreshFields(input);
  const { user, ...tokens } = await tokenService.rotateRefreshToken(input.refreshToken);
  return { user: toPublicUser(user), ...tokens };
};

const refreshBrowserSession = async (refreshToken) => {
  const { user, accessToken } = await tokenService.refreshBrowserSession(refreshToken);
  return { user: toPublicUser(user), accessToken };
};

const logout = (auth) => tokenService.logout(auth);

module.exports = { register, login, refresh, refreshBrowserSession, logout };
