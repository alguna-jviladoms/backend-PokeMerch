const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Esperamos a que MongoDB termine de crear los índices declarados en los esquemas.
    // Así email, slug y SKU ya son únicos antes de aceptar la primera petición.
    const models = mongoose.modelNames().map((modelName) => mongoose.model(modelName));
    await Promise.all(models.map((model) => model.init()));

    console.log('MongoDB connectat correctament');
  } catch (error) {
    // Solo se registra el problema en el servidor; nunca se devuelve al cliente.
    console.error(`Error al conectar con MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
