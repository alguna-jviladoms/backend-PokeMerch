const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Registro y login son endpoints públicos; los demás recursos se protegerán en pasos posteriores.
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
