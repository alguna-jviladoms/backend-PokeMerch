require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const { getUploadsDir } = require("./config/uploads");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const browserAuthRoutes = require("./routes/browserAuthRoutes");
const ApiError = require("./utils/ApiError");
const errorHandler = require("./middleware/errorHandler");

const app = express();
app.use('/api/auth/browser', browserAuthRoutes);
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({ success: true, data: { message: 'API Ecommerce en marxa' } });
});

// Montem les rutes de productes sota el prefix '/api/products'
app.use('/api/products', productRoutes);
// Montamos las rutas CRUD de categorías bajo /api/categories.
app.use('/api/categories', categoryRoutes);
// Endpoints locales de desarrollo; userRoutes los bloquea fuera de NODE_ENV=development.
app.use('/api/users', userRoutes);
// Registro/login/refresh son endpoints de autenticación; los routers de recursos validan el access token.
app.use('/api/auth', authRoutes);
// Servimos los archivos públicos (p. ej. /api/media/pikachu-clasico.webp) desde el directorio configurable.
app.use('/api/media', express.static(getUploadsDir()));

// Si ninguna ruta coincide, lo convertimos en un error con el mismo formato JSON.
app.use((req, res, next) => {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'La ruta solicitada no existe'));
});

// El manejador de errores debe ir al final para recibir errores de todas las rutas anteriores.
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
// Arrancamos HTTP cuando MongoDB y sus índices ya están listos para recibir peticiones.
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Servidor escoltant al port ${PORT}`));
});
