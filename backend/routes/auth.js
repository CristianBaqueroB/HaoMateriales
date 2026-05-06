const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

router.post('/registro', async (req, res) => {
    const { nombre, email, password, telefono, direccion } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO usuarios (nombre, email, password_hash, telefono, direccion) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id, email, nombre`,
            [nombre, email, hash, telefono, direccion]
        );
        res.status(201).json({ mensaje: "Usuario registrado", usuario: result.rows[0] });
    } catch (err) {
        res.status(400).json({ error: "Error en registro. Email duplicado?" });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM usuarios WHERE email = $1 AND activo = true", [email]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.userId = user.id;
            req.session.rol = user.rol;
            req.session.nombre = user.nombre;

            await pool.query(
                "INSERT INTO logs_acceso (usuario_id, tipo, ip, user_agent) VALUES ($1, 'LOGIN', $2, $3)",
                [user.id, req.ip, req.headers['user-agent']]
            );

            res.json({ mensaje: "Bienvenido", rol: user.rol });
        } else {
            res.status(401).json({ error: "Credenciales incorrectas" });
        }
    } catch (err) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ mensaje: "Sesión cerrada" });
});

module.exports = router;