const express = require('express');
const categoryController = require('../controllers/categoryController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// La navegación de la tienda necesita leer las categorías sin iniciar sesión.
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);

// Las operaciones de administración sí requieren identidad verificada.
router.post('/', authenticateToken, categoryController.createCategory);
router.put('/:id', authenticateToken, categoryController.updateCategory);
router.delete('/:id', authenticateToken, categoryController.deleteCategory);

module.exports = router;
