const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Protegemos todas las rutas para el administrador
router.use(requireRole(['administrador']));

// --- GESTIÓN DE LÁMINAS ---

// 1. Ver todas las láminas (Corregido: Quitamos el filtro de columna inexistente)
router.get('/laminas', async (req, res) => {
    try {
        // Quitamos "WHERE eliminado_en IS NULL" para que no de error
        const result = await pool.query(
            "SELECT * FROM laminas ORDER BY creado_en DESC"
        );
        res.json(result.rows);
    } catch (err) {
        // IMPORTANTE: Esto te dirá el error real en la terminal negra de Node
        console.error("❌ ERROR SQL EN GET /laminas:", err.message);
        res.status(500).json({ error: "Error interno al listar inventario" });
    }
});

// 2. Crear nueva referencia
router.post('/laminas', async (req, res) => {
    const { codigo, nombre, descripcion, stock, precio } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO laminas (codigo, nombre, descripcion, stock, precio) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [codigo, nombre, descripcion, stock, precio]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("❌ ERROR SQL EN POST /laminas:", err.message);
        res.status(400).json({ error: "No se pudo crear. Revisa si el código ya existe." });
    }
});

// 3. Actualizar lámina completa
router.put('/laminas/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock } = req.body;
    try {
        const result = await pool.query(
            "UPDATE laminas SET nombre = $1, descripcion = $2, precio = $3, stock = $4 WHERE id = $5 RETURNING *",
            [nombre, descripcion, precio, stock, id]
        );
        res.json({ mensaje: "Actualizado con éxito", producto: result.rows[0] });
    } catch (err) {
        console.error("❌ ERROR SQL EN PUT /laminas:", err.message);
        res.status(500).json({ error: "Error al actualizar los datos" });
    }
});

// 4. Actualizar solo stock (Parcial)
router.patch('/laminas/:id/stock', async (req, res) => {
    const { id } = req.params;
    const { cantidad } = req.body;
    try {
        const result = await pool.query(
            "UPDATE laminas SET stock = stock + $1 WHERE id = $2 RETURNING stock",
            [cantidad, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Lámina no encontrada" });
        res.json({ mensaje: "Stock actualizado", nuevo_stock: result.rows[0].stock });
    } catch (err) {
        console.error("❌ ERROR SQL EN PATCH /stock:", err.message);
        res.status(500).json({ error: "No se pudo actualizar el stock" });
    }
});

// 5. Listar usuarios (Corregido)
router.get('/usuarios', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, nombre, email, rol, creado_en FROM usuarios ORDER BY nombre ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("❌ ERROR SQL EN GET /usuarios:", err.message);
        res.status(500).json({ error: "Error al obtener lista de personal" });
    }
});

module.exports = router;