// Directori per defecte compatible amb Docker (/app/media); configurable via variable d'entorn UPLOADS_DIR.
const path = require('node:path');

const DEFAULT_UPLOADS_DIR = '/app/media';

// Express static requereix una ruta absolut; normalitza la variable d'entorn per no depender del cwd.
const getUploadsDir = () => path.resolve(process.env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR);

module.exports = { getUploadsDir, DEFAULT_UPLOADS_DIR };
