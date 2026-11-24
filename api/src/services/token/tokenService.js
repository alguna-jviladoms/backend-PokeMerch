const jwt = require('jsonwebtoken');
const { createHash, randomUUID, timingSafeEqual } = require('node:crypto');
const User = require('../../models/Usuari');
const Tokens = require('../../models/Tokens');
const ApiError = require('../../utils/ApiError');
const { getJwtSecret } = require('../../utils/jwtSecrets');

// El access token caduca pronto; el refresh token dura más y permite renovar la sesión.
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BROWSER_REFRESH_TOKEN_EXPIRES_IN = '7d';
const BROWSER_TOKEN_CHANNEL = 'browser';

const invalidRefreshToken = () => new ApiError(
  401,
  'INVALID_REFRESH_TOKEN',
  'El refresh token no es válido o ha caducado'
);

// Exigimos claves seguras y diferentes para que un token no sirva como el otro.
const assertTokenConfiguration = () => {
  const accessSecret = getJwtSecret('JWT_SECRET');
  const refreshSecret = getJwtSecret('JWT_REFRESH_SECRET');
  if (accessSecret === refreshSecret) {
    throw new ApiError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'El servicio de autenticación no está configurado'
    );
  }
};

// En MongoDB solo guardamos esta huella; el refresh token original se queda en el cliente.
const hashRefreshToken = (refreshToken) => createHash('sha256').update(refreshToken).digest('hex');

const createAccessToken = (user, sessionId, sessionExpiry) => {
  const secret = getJwtSecret('JWT_SECRET');
  const claims = { sub: user._id, sid: sessionId, role: user.role, tokenUse: 'access' };
  const accessToken = jwt.sign(
    claims,
    secret,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
  if (sessionExpiry === undefined) return accessToken;

  // Conserva el TTL de acceso configurado, salvo que la sesión termine antes.
  const { iat, exp } = jwt.decode(accessToken);
  if (sessionExpiry <= iat) throw invalidRefreshToken();
  if (exp <= sessionExpiry) return accessToken;
  return jwt.sign({ ...claims, iat, exp: sessionExpiry }, secret, { algorithm: 'HS256' });
};

// Generamos dos JWT vinculados a la sesión; jti identifica el refresh token actual.
const createTokenPair = (user, sessionId = randomUUID(), browser = false) => {
  const refreshJti = randomUUID();
  const refreshTokenExpiresIn = browser ? BROWSER_REFRESH_TOKEN_EXPIRES_IN : REFRESH_TOKEN_EXPIRES_IN;
  const refreshClaims = { sub: user._id, sid: sessionId, jti: refreshJti, tokenUse: 'refresh' };
  if (browser) refreshClaims.tokenChannel = BROWSER_TOKEN_CHANNEL;
  const refreshToken = jwt.sign(
    refreshClaims,
    getJwtSecret('JWT_REFRESH_SECRET'),
    { algorithm: 'HS256', expiresIn: refreshTokenExpiresIn }
  );

  // Guardamos la misma expiración que incluye el campo exp del JWT.
  const { exp } = jwt.decode(refreshToken);
  const refreshExpiresAt = new Date(exp * 1000);
  const accessToken = createAccessToken(user, sessionId, browser ? exp : undefined);
  return {
    sessionId,
    refreshJti,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshExpiresAt,
    refreshTokenExpiresIn,
    accessToken,
    refreshToken,
  };
};

// No devolvemos a authService datos internos como el hash que guardamos en la base de datos.
const publicTokenPair = (pair) => ({
  accessToken: pair.accessToken,
  refreshToken: pair.refreshToken,
  tokenType: 'Bearer',
  accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
  refreshTokenExpiresIn: pair.refreshTokenExpiresIn,
});

// Crea el registro de sesión al hacer login o registro.
const issueTokens = async (user, { browser = false } = {}) => {
  assertTokenConfiguration();
  const pair = createTokenPair(user, undefined, browser);

  await Tokens.create({
    _id: pair.sessionId,
    userId: user._id,
    currentJti: pair.refreshJti,
    tokenHash: pair.refreshTokenHash,
    expiresAt: pair.refreshExpiresAt,
  });

  return publicTokenPair(pair);
};

// Verifica firma, expiración y que el JWT sea de tipo refresh.
const verifyRefreshToken = (refreshToken) => {
  const refreshSecret = getJwtSecret('JWT_REFRESH_SECRET');
  let claims;
  try {
    claims = jwt.verify(refreshToken, refreshSecret, { algorithms: ['HS256'] });
  } catch (error) {
    if (!(error instanceof jwt.JsonWebTokenError)) throw error;
    throw invalidRefreshToken();
  }

  if (
    !claims || typeof claims !== 'object'
    || !Number.isFinite(claims.exp)
    || claims.tokenUse !== 'refresh'
    || typeof claims.sub !== 'string' || !claims.sub.trim()
    || typeof claims.sid !== 'string' || !claims.sid.trim()
    || typeof claims.jti !== 'string' || !claims.jti.trim()
  ) {
    throw invalidRefreshToken();
  }
  return claims;
};

const verifyBrowserRefreshToken = (refreshToken) => {
  const claims = verifyRefreshToken(refreshToken);
  if (claims.tokenChannel !== BROWSER_TOKEN_CHANNEL) throw invalidRefreshToken();
  return claims;
};

const currentBrowserSession = (claims, refreshToken) => ({
  _id: claims.sid,
  userId: claims.sub,
  currentJti: claims.jti,
  tokenHash: hashRefreshToken(refreshToken),
  revokedAt: null,
  expiresAt: { $gt: new Date() },
});

// El refresh del navegador es de solo lectura: no cambia la sesión ni su expiración.
const refreshBrowserSession = async (refreshToken) => {
  assertTokenConfiguration();
  const claims = verifyBrowserRefreshToken(refreshToken);
  const session = await Tokens.findOne(currentBrowserSession(claims, refreshToken)).select('expiresAt');
  if (!session) throw invalidRefreshToken();

  const user = await User.findById(claims.sub);
  if (!user || !user.active) throw invalidRefreshToken();

  const expiresAt = Math.min(Math.floor(session.expiresAt.getTime() / 1000), Math.floor(claims.exp));
  return { user, accessToken: createAccessToken(user, claims.sid, expiresAt) };
};

const logoutBrowserSession = async (refreshToken) => {
  assertTokenConfiguration();
  let claims;
  try {
    claims = verifyBrowserRefreshToken(refreshToken);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_REFRESH_TOKEN') return;
    throw error;
  }

  const result = await Tokens.updateOne(
    currentBrowserSession(claims, refreshToken),
    { $set: { revokedAt: new Date(), revokeReason: 'logout' } }
  );
  if (!result.acknowledged) {
    throw new ApiError(500, 'BROWSER_LOGOUT_FAILED', 'No se pudo cerrar la sesión');
  }
};

const hashesMatch = (storedHash, presentedHash) => {
  const storedBytes = Buffer.from(storedHash, 'hex');
  const presentedBytes = Buffer.from(presentedHash, 'hex');
  return storedBytes.length === presentedBytes.length && timingSafeEqual(storedBytes, presentedBytes);
};

const revokeReusedSession = async (sessionId) => {
  // Si se presenta un token sustituido, revocamos toda su sesión y la familia de tokens.
  await Tokens.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: 'refresh_token_reuse' } }
  );
};

// Sustituye el refresh token usado y devuelve el par siguiente.
const rotateRefreshToken = async (refreshToken) => {
  assertTokenConfiguration();
  const claims = verifyRefreshToken(refreshToken);
  // Los refresh JSON históricos no tienen canal; no se permite rotar sesiones del navegador.
  if (claims.tokenChannel !== undefined) throw invalidRefreshToken();
  const presentedHash = hashRefreshToken(refreshToken);
  const now = new Date();

  const session = await Tokens.findById(claims.sid).select('+tokenHash');
  if (
    !session || session.userId !== claims.sub || session.revokedAt
    || session.expiresAt <= now
  ) {
    throw invalidRefreshToken();
  }

  if (session.currentJti !== claims.jti) {
    await revokeReusedSession(session._id);
    throw new ApiError(401, 'REFRESH_TOKEN_REUSED', 'Se detectó la reutilización de un refresh token; inicia sesión de nuevo');
  }
  if (!hashesMatch(session.tokenHash, presentedHash)) throw invalidRefreshToken();

  const user = await User.findById(claims.sub);
  if (!user || !user.active) throw invalidRefreshToken();

  // Este cambio condicional es atómico: dos peticiones con el mismo token no pueden ganar.
  const nextPair = createTokenPair(user, session._id);
  const rotatedSession = await Tokens.findOneAndUpdate(
    {
      _id: session._id,
      userId: claims.sub,
      currentJti: claims.jti,
      tokenHash: presentedHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        currentJti: nextPair.refreshJti,
        tokenHash: nextPair.refreshTokenHash,
        expiresAt: nextPair.refreshExpiresAt,
      },
    },
    { new: true, runValidators: true }
  );

  if (!rotatedSession) {
    // Otra solicitud pudo rotar primero; si cambió jti, la anterior se ha reutilizado.
    const latestSession = await Tokens.findById(session._id);
    if (latestSession && !latestSession.revokedAt && latestSession.currentJti !== claims.jti) {
      await revokeReusedSession(session._id);
      throw new ApiError(401, 'REFRESH_TOKEN_REUSED', 'Se detectó la reutilización de un refresh token; inicia sesión de nuevo');
    }
    throw invalidRefreshToken();
  }

  return { user, ...publicTokenPair(nextPair) };
};

// Valida que el access token siga asociado a una sesión activa en MongoDB.
const isSessionActive = ({ userId, sessionId }) => Tokens.exists({
  _id: sessionId,
  userId,
  revokedAt: null,
  expiresAt: { $gt: new Date() },
});

// Cierra la sesión actual; authenticateToken ya verificó userId y sessionId.
const logout = async ({ userId, sessionId }) => {
  if (!userId || !sessionId) {
    throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'El access token no es válido o ha caducado');
  }

  await Tokens.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: 'logout' } }
  );
  return { message: 'Sesión cerrada' };
};

module.exports = {
  assertTokenConfiguration,
  issueTokens,
  verifyRefreshToken,
  refreshBrowserSession,
  logoutBrowserSession,
  rotateRefreshToken,
  isSessionActive,
  logout,
};
