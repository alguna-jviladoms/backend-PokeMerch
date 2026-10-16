const productService = require('../services/productService');

// Controlador de crear un producto
// Requiere una request ( req ) que es la petición HTTP que llega del cliente
// Una response ( res ) que es la respuesta HTTP que le enviamos al cliente
const createProduct = async ( req, res ) => {
    try {
        // Llamamos al servicio pasandole la info del producto
        // de normal debería ser un JSON con todo ( req.body )
        const producto = await productService.createProduct(req.body);
        // Si se crea enviamos el codigo correcto que es el 201
        res.status(201).json({ 
            status: 'success',
            data: producto
        }); 
    }
    catch (error) {
        // Si hay un error capturamos el error y mandamos un mensaje con error codigo 400 y el mensaje del error
        res.status(400).json({ 
            status: 'error',
            message: error.message
        });
    }
};

const getProducts = async ( req, res ) => {
    try {
        // Llamamos al servicio para que devuelva todos los productos
        const productos = await productService.getProducts( );
        res.status(200).json ({
            status: 'Success',
            data: productos
        });
    } catch (error) {
        res.status(400).json({
            status: 'error', 
            message: error.message
        });
    }
};

const getProductById = async ( req, res ) => {
    try {
        // req.params.id es el valor que viene en la URL.
        // Ejemplo: si la ruta es /products/123, entonces req.params.id = "123".
        const producto = await productService.getProductById(req.params.id);
        res.status(200).json({
            status: 'success',
            data: producto 
        });
    } catch ( error ) {
        // Si el servicio lanza un error con statusCode (por ejemplo 404), lo usamos.
        // Si no tiene statusCode, usamos 400 por defecto.
        res.status(error.statusCode || 400).json({
            status: 'error',
            message: error.message 
        });
    }
};

const updateProduct = async ( req, res ) => {
    try {
        // Pasamos el ID que viene en la URL y los nuevos datos que vienen en el body
        const producto = await productService.updateProduct( req.params.id, req.body);
        res.status(200).json({
            status: "success",
            data: producto 
        });
    } catch ( error ) {
        // Si no tiene statusCode, usamos 400 por defecto.
        res.status(error.statusCode || 400).json({ 
            status: "error",
            message: error.message 
        });
    }
};

const deleteProduct = async ( req, res ) => {
    try {
        await productService.deleteProduct( req.params.id );
        res.status(200).json({ 
            status: 'success',
            message: 'Producto eliminado'
        });
    } catch ( error ) {
        // Si no tiene statusCode, usamos 400 por defecto.
        res.status(error.statusCode || 400).json({
            status: 'error',
            message: error.message
        });
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
};
