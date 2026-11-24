const authService = require('../services/authService');

// El controlador traduce peticiones HTTP a llamadas del servicio y devuelve respuestas JSON.
const register = async (req, res) => {
  // Pasa los datos recibidos al servicio y responde que se creó el usuario (HTTP 201).
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
};

const login = async (req, res) => {
  // authService comprueba credenciales y delega la emisión de tokens a tokenService.
  const result = await authService.login(req.body);
  res.status(200).json({ success: true, data: result });
};

const refresh = async (req, res) => {
  // authService valida el body y tokenService rota el refresh token de la sesión.
  const result = await authService.refresh(req.body);
  res.status(200).json({ success: true, data: result });
};

const logout = async (req, res) => {
  // authenticateToken verificó el access token; el servicio revoca la sesión indicada en req.auth.
  const result = await authService.logout(req.auth);
  res.status(200).json({ success: true, data: result });
};

module.exports = { register, login, refresh, logout };
