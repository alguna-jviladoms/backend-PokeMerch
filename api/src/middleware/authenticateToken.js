const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { getJwtSecret } = require('../utils/jwtSecrets');
const tokenService = require('../services/token/tokenService');

const authenticationRequired = () => new ApiError(
  401,
  'AUTHENTICATION_REQUIRED',
  'Debes enviar un access token en Authorization: Bearer <token>',
  [{ field: 'Authorization', message: 'Falta el encabezado Bearer' }]
);

const invalidAccessToken = () => new ApiError(
  401,
  'INVALID_ACCESS_TOKEN',
  'El access token no es válido o ha caducado'
);

// Express ejecuta este middleware antes de llegar al controlador de una ruta protegida.
const authenticateToken = async (req, res, next) => {
  const authorization = req.get('authorization');
  if (!authorization) return next(authenticationRequired());

  // Aceptamos solo el formato estándar Bearer y un único valor de token.
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) return next(invalidAccessToken());

  // La clave de access es distinta de la clave usada para firmar refresh tokens.
  const accessSecret = getJwtSecret('JWT_SECRET');
  let claims;
  try {
    // verify comprueba la firma y la expiración; limitamos el algoritmo permitido a HS256.
    claims = jwt.verify(match[1], accessSecret, { algorithms: ['HS256'] });
  } catch {
    return next(invalidAccessToken());
  }

  // El refresh token también es un JWT, así que comprobamos que este sea específicamente de acceso.
  if (
    !claims || typeof claims !== 'object'
    || claims.tokenUse !== 'access'
    || typeof claims.sub !== 'string'
    || typeof claims.sid !== 'string'
    || !['client', 'admin'].includes(claims.role)
  ) {
    return next(invalidAccessToken());
  }

  // Consultamos el estado de la sesión para que logout o una revocación por robo corte el access token.
  const activeSession = await tokenService.isSessionActive({
    sessionId: claims.sid,
    userId: claims.sub,
  });
  if (!activeSession) return next(invalidAccessToken());

  // Los controladores pueden leer la identidad verificada desde req.auth.
  req.auth = { userId: claims.sub, sessionId: claims.sid, role: claims.role };
  return next();
};

module.exports = authenticateToken;
