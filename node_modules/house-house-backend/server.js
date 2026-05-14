const express = require('express');
const cors = require('cors');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const connectDB = require('./config/db');
require('dotenv').config({ override: true });

const app = express();

// 1. CORS: Configurado para aceptar credenciales
app.use(cors({ 
    origin: 'http://localhost:5173', 
    credentials: true // Permite el paso de cookies
}));

app.use(express.json());

// 2. SESIÓN: Configurada para desarrollo local entre diferentes puertos
app.use(session({
    secret: process.env.SESSION_SECRET || 'hao_clave_secreta_upc',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,    // false porque usamos http:// (no https)
        httpOnly: true,   // Protege la cookie de ataques JS
        sameSite: 'lax'   // 🔑 PERMITE compartir la sesión entre puertos locales
    }
}));

// Documentación
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas
app.get('/', (req, res) => {
    res.send('<h1>🏠 Hao Materiales Backend Online</h1>');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/usuario', require('./routes/pedidos'));
app.use('/api/operador', require('./routes/operador'));
app.use('/api/despachador', require('./routes/despachador'));

const PORT = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Servidor en http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ No se pudo iniciar el servidor:', err.message);
        process.exit(1);
    });