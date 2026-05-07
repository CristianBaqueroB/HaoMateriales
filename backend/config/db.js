const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI no está definido en .env (usa la URI de MongoDB Atlas)');
    }
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10_000,
    });
    console.log('✅ Conexión a MongoDB exitosa');
}

module.exports = connectDB;
