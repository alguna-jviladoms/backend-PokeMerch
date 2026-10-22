const categoryService = require('../services/categoryService');

// Express 5 reenvía los errores de estas funciones async al middleware global.
const createCategory = async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  res.status(201).json({ success: true, data: category });
};

const getCategories = async (req, res) => {
  const result = await categoryService.getCategories(req.query);
  res.status(200).json({ success: true, ...result });
};

const getCategoryById = async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  res.status(200).json({ success: true, data: category });
};

const updateCategory = async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  res.status(200).json({ success: true, data: category });
};

const deleteCategory = async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  res.status(204).end();
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
