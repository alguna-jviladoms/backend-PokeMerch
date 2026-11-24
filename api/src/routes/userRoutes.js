const express = require('express');
const userController = require('../controllers/userController');
const ApiError = require('../utils/ApiError');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// El token confirma identidad; este control conserva además el límite local mientras no haya RBAC.
const allowLocalDevelopmentOnly = (req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const remoteAddress = req.socket.remoteAddress;
  const isLoopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress);

  if (!isDevelopment || !isLoopback) {
    return next(new ApiError(
      403,
      'LOCAL_ONLY',
      'La gestión de usuarios solo está disponible en desarrollo local.'
    ));
  }

  next();
};

// Primero exigimos identidad y después comprobamos que la petición sea local y de desarrollo.
router.use(authenticateToken);
router.use(allowLocalDevelopmentOnly);

router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
// DELETE es lógico: el controlador cambia active a false, no borra el documento.
router.delete('/:id', userController.deactivateUser);

module.exports = router;
