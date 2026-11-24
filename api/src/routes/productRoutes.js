const express = require('express');
const productController = require('../controllers/productController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

// El catálogo es público para que la tienda pueda mostrar productos sin sesión.
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Las operaciones de administración sí requieren autenticación.
router.post('/', authenticateToken, productController.createProduct);
router.put('/:id', authenticateToken, productController.updateProduct);
router.delete('/:id', authenticateToken, productController.deleteProduct);

module.exports = router;
