const express = require('express');
const cors = require('cors');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const connectDB = require('./config/db');
require('dotenv').config({ override: true });

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

if (isProduction) {
    app.set('trust proxy', 1); // necesario en Railway / proxies HTTPS para cookies seguras
}

// 1. CORS: Permite credenciales y origen dinámico
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin === clientUrl) {
            callback(null, true);
        } else {
            callback(new Error(`Origin ${origin} no permitido`));
        }
    },
    credentials: true,
}));

app.use(express.json());

// 2. SESIÓN: Usar cookies seguras en producción y sameSite None para cross-site
app.use(session({
    secret: process.env.SESSION_SECRET || 'hao_clave_secreta_upc',
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