const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

const ACCESS_COOKIE = 'pm_access';
const REFRESH_COOKIE = 'pm_refresh';
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![\s\S])/u;

const getOptions = (environment) => ({
  httpOnly: true,
  secure: environment !== 'development',
  sameSite: 'lax',
  path: '/api/auth/browser',
});

const invalidRefresh = () => new ApiError(401, 'INVALID_REFRESH_TOKEN', 'La sesión no es válida o ha caducado');

const readBrowserCookies = (header = '', { refreshOnly = false } = {}) => {
  const cookies = {};
  for (const item of header.split(';')) {
    const pair = item.trimStart();
    const separator = pair.indexOf('=');
    const name = (separator === -1 ? pair : pair.slice(0, separator)).trim();
    if (name !== REFRESH_COOKIE && (refreshOnly || name !== ACCESS_COOKIE)) continue;
    const value = pair.slice(separator + 1);
    if (separator === -1 || pair.slice(0, separator) !== name
      || !JWT_PATTERN.test(value) || (Object.hasOwn(cookies, name) && cookies[name] !== value)) {
      throw invalidRefresh();
    }
    cookies[name] = value;
  }
  return cookies;
};

// Solo se decodifican tokens que el servicio acaba de emitir; nunca se autentica por decode.
const getMaxAge = (token, now) => {
  const exp = jwt.decode(token)?.exp;
  if (!JWT_PATTERN.test(token) || !Number.isSafeInteger(exp) || exp * 1000 <= now) {
    throw new ApiError(500, 'AUTH_CONFIGURATION_ERROR', 'No se pudo configurar la sesión');
  }
  return exp * 1000 - now;
};

const createCookieWriter = (environment) => {
  const options = getOptions(environment);
  return {
    set(res, { accessToken, refreshToken }) {
      const now = Date.now();
      const accessMaxAge = getMaxAge(accessToken, now);
      const refreshMaxAge = getMaxAge(refreshToken, now);
      res.cookie(ACCESS_COOKIE, accessToken, { ...options, maxAge: accessMaxAge });
      res.cookie(REFRESH_COOKIE, refreshToken, { ...options, maxAge: refreshMaxAge });
    },
    setAccess(res, accessToken) {
      res.cookie(ACCESS_COOKIE, accessToken, { ...options, maxAge: getMaxAge(accessToken, Date.now()) });
    },
    clear(res) {
      res.clearCookie(ACCESS_COOKIE, options);
      res.clearCookie(REFRESH_COOKIE, options);
    },
  };
};

module.exports = { REFRESH_COOKIE, readBrowserCookies, createCookieWriter, invalidRefresh };
