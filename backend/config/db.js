const mongoose = require('mongoose');

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI no está definido en .env (usa la URI de MongoDB Atlas)');
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10_000,
    });
    const dbNombre = mongoose.connection.name;
    console.log('✅ Conexión a MongoDB exitosa');
    console.log(`📂 Colección Users en la base: "${dbNombre}" (colección típica: "users"). Revisá el mismo nombre de BD en Compass.`);
}

module.exports = connectDB;
