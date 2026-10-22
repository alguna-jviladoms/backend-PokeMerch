const productService = require('../services/productService');

// Express 5 envía automáticamente al middleware global cualquier error de estas funciones async.
const createProduct = async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json({ success: true, data: product });
};

const getProducts = async (req, res) => {
  const products = await productService.getProducts();
  res.status(200).json({ success: true, data: products });
};

const getProductById = async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  res.status(200).json({ success: true, data: product });
};

const updateProduct = async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.status(200).json({ success: true, data: product });
};

const deleteProduct = async (req, res) => {
  await productService.deleteProduct(req.params.id);
  // 204 indica éxito y, por convención HTTP, no lleva cuerpo.
  res.status(204).end();
};

module.exports = { createProduct, getProducts, getProductById, updateProduct, deleteProduct };
