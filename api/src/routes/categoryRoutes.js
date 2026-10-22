const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

// Cada ruta enlaza un verbo y una URL con la función que atenderá esa petición.
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);
router.post('/', categoryController.createCategory);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
