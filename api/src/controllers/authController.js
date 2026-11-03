const authService = require('../services/authService');

// El controlador se ocupa del protocolo HTTP; las reglas viven en authService.
const register = async (req, res) => {
  // Pasa los datos recibidos al servicio y responde que se creó el usuario (HTTP 201).
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
};

const login = async (req, res) => {
  // El servicio valida credenciales y devuelve los datos públicos y el token.
  const result = await authService.login(req.body);
  res.status(200).json({ success: true, data: result });
};

module.exports = { register, login };
