const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Las rutas no tienen logica, solo asocian "método + path → función del controlador"
router.get('/', productController.getProducts);

// Cuando el cliente hace GET a /algo (por ejemplo /products/123), se ejecuta getProductById.
// :id es un parámetro de ruta: Express captura ese valor y lo deja en req.params.id.
router.get('/:id', productController.getProductById);

router.post('/', productController.createProduct);

// Cuando el cliente hace PUT a /algo (por ejemplo /products/123), se ejecuta updateProduct.
// :id es un parámetro de ruta: Express captura ese valor y lo deja en req.params.id.
router.put('/:id', productController.updateProduct);

// Cuando el cliente hace DELETE a /algo (por ejemplo /products/123), se ejecuta deleteProduct.
// :id es un parámetro de ruta: Express captura ese valor y lo deja en req.params.id.
router.delete('/:id', productController.deleteProduct);

module.exports = router;
