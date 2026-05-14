const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const LogAcceso = require('../models/LogAcceso');
const { requireLogin } = require('../middleware/auth');

function normalizarEmail(email) {
    return String(email ?? '')
        .trim()
        .toLowerCase();
}

router.post('/registro', async (req, res) => {
    const nombre = String(req.body?.nombre ?? '').trim();
    const email = normalizarEmail(req.body?.email);
    const password = req.body?.password;
    const telefono = String(req.body?.telefono ?? '').trim();
    const direccion = String(req.body?.direccion ?? '').trim();

    if (!nombre || nombre.length < 2) {
        return res.status(400).json({ error: 'Indica un nombre válido (mínimo 2 caracteres).' });
    }
    if (!email) {
        return res.status(400).json({ error: 'Indica un correo electrónico.' });
    }
    if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const usuario = await User.create({
            nombre,
            email,
            password_hash: hash,
            telefono,
            direccion,
        });
        const out = usuario.toJSON();
        console.log('[auth/registro] Usuario creado en MongoDB:', out.id, out.email);
        res.status(201).json({
            mensaje: 'Usuario registrado',
            usuario: { id: out.id, email: out.email, nombre: out.nombre },
        });
    } catch (err) {
        if (err.code === 11000) {
            res.status(400).json({ error: 'Ese correo ya está registrado.' });
            return;
        }
        if (err.name === 'ValidationError') {
            const msg = Object.values(err.errors || {})
                .map((e) => e.message)
                .join(' ');
            console.error('[auth/registro] ValidationError:', msg);
            return res.status(400).json({ error: msg || 'Datos inválidos.' });
        }
        console.error('[auth/registro]', err);
        res.status(500).json({ error: 'No se pudo completar el registro. Revisa la conexión a la base de datos.' });
    }
});

router.post('/login', async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    const password = req.body?.password;
    try {
        if (!email || typeof password !== 'string') {
            return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
        }

        const user = await User.findOne({ email, activo: true });

        if (user && (await bcrypt.compare(password, user.password_hash))) {
            req.session.userId = user._id.toString();
            req.session.rol = user.rol;
            req.session.nombre = user.nombre;

            await LogAcceso.create({
                usuario_id: user._id,
                tipo: 'LOGIN',
                ip: req.ip,
                user_agent: req.headers['user-agent'],
            });

            res.json({ mensaje: 'Bienvenido', rol: user.rol });
        } else {
            res.status(401).json({ error: 'Credenciales incorrectas' });
        }
    } catch (_err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ mensaje: 'Sesión cerrada' });
});

router.get('/me', requireLogin, (req, res) => {
    res.json({
        userId: req.session.userId,
        rol: req.session.rol,
        nombre: req.session.nombre,
    });
});

module.exports = router;
