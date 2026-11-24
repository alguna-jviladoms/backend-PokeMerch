const express = require('express');
const authService = require('../services/authService');
const tokenService = require('../services/token/tokenService');
const { createBrowserAuthController } = require('../controllers/browserAuthController');
const { createCookieWriter } = require('../security/browserAuthCookies');
const { createOriginGuard, getAllowedOrigins } = require('../security/browserAuthOrigin');

const router = express.Router();
const guard = createOriginGuard(getAllowedOrigins());
const parseJson = express.json();
const controller = createBrowserAuthController({
  authService,
  tokenService,
  cookies: createCookieWriter(process.env.NODE_ENV),
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.post('/register', guard, parseJson, controller.register);
router.post('/login', guard, parseJson, controller.login);
router.post('/refresh', guard, controller.refresh);
router.post('/logout', guard, controller.logout);

module.exports = router;
