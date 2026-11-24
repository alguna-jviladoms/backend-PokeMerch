const express = require('express');
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// Registro y login son públicos porque el cliente aún no tiene credenciales de sesión.
router.post('/register', authController.register);
router.post('/login', authController.login);

// Refresh comprueba en el servicio el refresh token enviado en el body y lo rota.
router.post('/refresh', authController.refresh);

// Logout exige un access token vigente para identificar la sesión que se va a revocar.
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
