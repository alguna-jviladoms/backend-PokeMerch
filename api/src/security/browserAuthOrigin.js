const ApiError = require('../utils/ApiError');
// Vite usa el puerto 5173 por defecto. Nunca se confía en Host ni en cabeceras del proxy.
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'];
const parseUrl = (value) => {
  if (typeof value !== 'string' || !/^https?:\/\/[^/?#]/u.test(value) || /[\s,\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
};

const getAllowedOrigins = ({ NODE_ENV, AUTH_ALLOWED_ORIGINS } = process.env) => {
  if (NODE_ENV === 'development') return new Set(devOrigins);
  const entries = (AUTH_ALLOWED_ORIGINS || '').split(',').map((entry) => entry.trim());
  const origins = entries.filter((entry) => {
    const url = parseUrl(entry);
    return url?.protocol === 'https:' && url.origin === entry;
  });
  return new Set(origins);
};

const hasAllowedSource = (headers, origins) => {
  const { origin, referer } = headers;
  const fetchSite = headers['sec-fetch-site'];
  if (fetchSite !== undefined && fetchSite !== 'same-origin') return false;
  if (typeof origin !== 'string' || origin === 'null' || !origins.has(origin)) return false;
  if (referer === undefined) return true;
  const source = parseUrl(referer);
  return source?.origin === origin;
};

const createOriginGuard = (origins) => (req, res, next) => {
  if (origins.size === 0) {
    return next(new ApiError(503, 'BROWSER_AUTH_UNAVAILABLE', 'El acceso desde el navegador no está configurado'));
  }
  if (!hasAllowedSource(req.headers, origins)) {
    return next(new ApiError(403, 'AUTH_ORIGIN_DENIED', 'No se permite el origen de la petición'));
  }
  return next();
};
module.exports = { getAllowedOrigins, hasAllowedSource, createOriginGuard };