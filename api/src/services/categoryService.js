// El modelo usa el esquema conservado en Categoria.js y se registra como "Category".
const Category = require('../models/Categoria');
const ApiError = require('../utils/ApiError');
const { parseListQuery } = require('../utils/listQuery');

const CATEGORY_SORT_FIELDS = new Set(['name', 'slug', 'active', 'createdAt', 'updatedAt']);

// new Category prepara el documento y save lo valida y guarda en MongoDB.
const createCategory = async (categoryData) => new Category(categoryData).save();

const getCategories = async (queryParams = {}) => {
  const { filter, sort, page, limit, skip } = parseListQuery(queryParams, CATEGORY_SORT_FIELDS);
  const [categories, total] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    data: categories,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getCategoryById = async (id) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoría no encontrada');
  }
  return category;
};

const updateCategory = async (id, categoryData) => {
  // new devuelve el documento actualizado; runValidators vuelve a revisar el esquema.
  const category = await Category.findByIdAndUpdate(id, categoryData, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoría no encontrada');
  return category;
};

const deleteCategory = async (id) => {
  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Categoría no encontrada');
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
