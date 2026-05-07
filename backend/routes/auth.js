const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const LogAcceso = require('../models/LogAcceso');

router.post('/registro', async (req, res) => {
    const { nombre, email, password, telefono, direccion } = req.body;
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
        res.status(201).json({
            mensaje: 'Usuario registrado',
            usuario: { id: out.id, email: out.email, nombre: out.nombre },
        });
    } catch (err) {
        if (err.code === 11000) {
            res.status(400).json({ error: 'Error en registro. Email duplicado?' });
            return;
        }
        res.status(400).json({ error: 'Error en registro. Email duplicado?' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
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

module.exports = router;
