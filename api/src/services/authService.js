const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/Usuari');
const userService = require('./userService');
const ApiError = require('../utils/ApiError');

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const LOGIN_FIELDS = new Set(['email', 'password']);

// El body debe ser un objeto normal: evita errores al leer propiedades de null o arrays.
const requireObjectBody = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'BAD_REQUEST', 'El body debe ser un objeto JSON');
  }
};

// Login solo necesita email y password; rechazar el resto hace explícito el contrato de la API.
const validateLoginFields = (input) => {
  requireObjectBody(input);
  const unexpectedFields = Object.keys(input).filter((field) => !LOGIN_FIELDS.has(field));
  if (unexpectedFields.length) {
    throw new ApiError(
      400,
      'FIELD_NOT_ALLOWED',
      'La petición contiene campos no permitidos',
      unexpectedFields.map((field) => ({ field, message: 'Campo no permitido para iniciar sesión' }))
    );
  }

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

// Nunca usamos un secreto por defecto: cada entorno debe configurar su propia clave aleatoria.
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new ApiError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'El servicio de autenticación no está configurado'
    );
  }
  return secret;
};

// Devolvemos una vista segura y explícita del usuario, sin depender solo de la serialización.
const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
});

// El JWT solo lleva identificador y rol; no incluye contraseña, email ni datos personales.
const createAuthResponse = (user) => {
  // jwt.sign crea y firma el token que el registro/login devolverá al cliente.
  const token = jwt.sign(
    { sub: user._id, role: user.role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: TOKEN_EXPIRES_IN }
  );

  return {
    user: toPublicUser(user),
    token,
    tokenType: 'Bearer',
    expiresIn: TOKEN_EXPIRES_IN,
  };
};

const register = async (input) => {
  // Comprueba la configuración antes de guardar: si falta el secreto no creamos una cuenta sin token.
  getJwtSecret();

  // userService limita los campos, valida name/email/password y guarda passwordHash con BCrypt.
  // También asigna role=client y active=true en el servidor.
  const user = await userService.createUser(input);
  return createAuthResponse(user);
};

const login = async (input) => {
  validateLoginFields(input);

  // Normalizamos el correo igual que el esquema: espacios fuera y minúsculas.
  const email = input.email.trim().toLowerCase();

  // Consulta a MongoDB con Mongoose; passwordHash está oculto y solo se selecciona para comparar.
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordIsWithinBcryptLimit = Buffer.byteLength(input.password, 'utf8') <= 72;
  const passwordMatches = user && passwordIsWithinBcryptLimit
    && await bcrypt.compare(input.password, user.passwordHash);

  // Un mensaje único evita revelar si el correo existe o si la cuenta está desactivada.
  if (!user || !user.active || !passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
  }

  return createAuthResponse(user);
};

module.exports = { register, login };
