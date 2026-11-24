// Seed idempotente del catàleg demo (fase 1): upsert per slug de categoria i per SKU de producte.
// Si el registre existeix es actualitza; si no, es crea. Mai realitza deletes destructius.
require('dotenv').config();

const mongoose = require('mongoose');
const Category = require('../models/Categoria');
const Product = require('../models/Producte');

// Catàleg demo acordat: 2 categories i 3 productes (ADR-003).
const DEMO_CATEGORIES = [
  {
    name: 'Peluches',
    slug: 'peluches',
    description: 'Peluches y muñecos para abrazar.',
    active: true,
  },
  {
    name: 'Accesorios',
    slug: 'accesorios',
    description: 'Pequeños detalles del mundo Pokémon.',
    active: true,
  },
];

const DEMO_PRODUCTS = [
  {
    categorySlug: 'peluches',
    nombre: 'Pikachu clásico',
    descripcion: 'El compañero Pikachu de las aventuras clásicas, convertido en peluche para abrazar.',
    precio: 24.90,
    sku: 'PCH-CLSC-001',
    imagen: '/api/media/pikachu-clasico.webp',
  },
  {
    categorySlug: 'peluches',
    nombre: 'Eevee de felpa',
    descripcion: 'Eevee de felpa suave, ideal para completar la colección.',
    precio: 27.90,
    sku: 'EVE-FELP-002',
    imagen: '/api/media/eevee-felpa.webp',
  },
  {
    categorySlug: 'accesorios',
    nombre: 'Llavero Poké Ball',
    descripcion: 'Un detalle de la Poké Ball para llevar en las llaves o en la mochila.',
    precio: 9.90,
    sku: 'PKB-ACC-003',
    imagen: '/api/media/llavero-poke-ball.webp',
  },
];

const runSeed = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  try {
    // Upsert por slug: si existe la categoría se actualiza, si no se crea. Nunca se borra nada.
    for (const category of DEMO_CATEGORIES) {
      await Category.findOneAndUpdate(
        { slug: category.slug },
        { ...category },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    // Upsert por SKU: si existe el producto se actualiza, si no se crea. Nunca se borra nada.
    for (const product of DEMO_PRODUCTS) {
      const category = await Category.findOne({ slug: product.categorySlug });
      if (!category) {
        throw new Error(`La categoría con slug "${product.categorySlug}" no existe`);
      }
      await Product.findOneAndUpdate(
        { sku: product.sku },
        {
          nombre: product.nombre,
          descripcion: product.descripcion,
          precio: product.precio,
          sku: product.sku,
          activo: true,
          category: category._id,
          imagen: product.imagen,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    console.log('Seed del catálogo demo completado (upsert por slug/sku, sin borrados).');
  } finally {
    await mongoose.disconnect();
  }
};

runSeed().catch(async (error) => {
  console.error(`Error en el seed del catálogo demo: ${error.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
