const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const connectDB = require('./config/db');
require('dotenv').config({ override: true });

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const clientUrl = (process.env.CLIENT_URL || 'https://hao-materiales.vercel.app').trim().replace(/\/$/, '');

if (isProduction) {
    app.set('trust proxy', 1); // Necesario para que Render maneje las cookies seguras (HTTPS)
}

// 1. CORS: Permite credenciales y origen dinámico
const allowedOrigins = [clientUrl, 'https://hao-materiales.vercel.app'];

app.use(cors({
    origin: (origin, callback) => {
        // Verificamos si el origen está en nuestra lista, es un subdominio de vercel o es localhost
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('localhost')) {
            callback(null, true);
        } else {
            console.warn(`⚠️ Origen bloqueado por CORS: ${origin}`);
            callback(null, false); // No enviamos error para evitar que la respuesta pierda las cabeceras
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());

// 2. SESIÓN: Usar cookies seguras en producción y sameSite None para cross-site
app.use(session({
    secret: process.env.SESSION_SECRET || 'hao_clave_secreta_upc',
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
    },
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