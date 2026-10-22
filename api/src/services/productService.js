const Product = require('../models/Producte');
const ApiError = require('../utils/ApiError');
const validateUuid = require('../utils/validateUuid');

// GET ( Todos ) -> recogemos todos los productos que existan
const getProducts = async () => {
    // populate sustituye el ObjectId de category por el documento Category relacionado.
    return await Product.find().populate('category');
};

// GET ( Filtrado por id ) recogemos solamente el producto con el id
const getProductById = async ( id ) => {
    validateUuid(id);
    const producto = await Product.findById(id).populate('category');
    if ( !producto ) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
    };
    return producto;
};

//PUT -> actualizar un producto ya existente
const updateProduct = async ( id, productData ) => {
    validateUuid(id);
    const producto = await Product.findByIdAndUpdate(
         id, productData, { 
         new: true, // esto es porque moongose devuelve el producto antes de actualizarlo, y asi lo obligamos a que nos lo de una vez ya este actualizado
         runValidators: true // vuelve a ejecutar las validaciones del esquema
        } 
    ).populate('category');
    if ( !producto ) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
    };
    return producto;
};

//DELETE -> borrar un producto
const deleteProduct = async ( id ) => {
    validateUuid(id);
    const producto = await Product.findByIdAndDelete(id);
    if ( !producto ) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
    };
    return producto;
};

// POST -> añadir un nuevo producto
const createProduct = async (productData) => {
    const newProduct = new Product(productData);
    await newProduct.save();
    // Después de guardar, populate carga la categoría enlazada para incluirla en la respuesta.
    return await newProduct.populate('category');
};

module.exports = { 
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
};
