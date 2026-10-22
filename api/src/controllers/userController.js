const userService = require('../services/userService');

// Los errores async se reenvían al middleware global; aquí formateamos solo los éxitos.
const createUser = async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, data: user });
};

const getUsers = async (req, res) => {
  const result = await userService.getUsers(req.query);
  res.status(200).json({ success: true, ...result });
};

const getUserById = async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json({ success: true, data: user });
};

const updateUser = async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  res.status(200).json({ success: true, data: user });
};

const deactivateUser = async (req, res) => {
  await userService.deactivateUser(req.params.id);
  res.status(204).end();
};

module.exports = { createUser, getUsers, getUserById, updateUser, deactivateUser };
