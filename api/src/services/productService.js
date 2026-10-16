const Product = require('../models/Producte');

// GET ( Todos ) -> recogemos todos los productos que existan
const getProducts = async () => {
    return await Product.find();
};

// GET ( Filtrado por id ) recogemos solamente el producto con el id
const getProductById = async ( id ) => {
    const producto = await Product.findById(id);
    if ( !producto ) {
        const error = new Error('Producto no encontrado');
        error.statusCode = 404;
        throw error;
    };
    return producto;
};

//PUT -> actualizar un producto ya existente
const updateProduct = async ( id, productData ) => {
    const producto = await Product.findByIdAndUpdate(
         id, productData, { 
         new: true, // esto es porque moongose devuelve el producto antes de actualizarlo, y asi lo obligamos a que nos lo de una vez ya este actualizado
         runValidators: true // vuelve a ejecutar las validaciones del esquema
        } 
    );
    if ( !producto ) {
        const error = new Error('Producto no encontrado');
        error.statusCode = 404;
        throw error;
    };
    return producto;
};

//DELETE -> borrar un producto
const deleteProduct = async ( id ) => {
    const producto = await Product.findByIdAndDelete(id);
    if ( !producto ) {
        const error = new Error('Producto no encontrado');
        error.statusCode = 404;
        throw error;
    };
    return producto;
};

// POST -> añadir un nuevo producto
const createProduct = async (productData) => {
    const newProduct = new Product(productData);
    return await newProduct.save();
};

module.exports = { 
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
};
