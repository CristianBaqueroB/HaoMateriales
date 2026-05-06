const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Seguridad: Solo despachadores y el administrador
router.use(requireRole(['despachador', 'administrador']));

/**
 * 1. PANEL DE PENDIENTES (La "Torre de Control")
 * GET /api/despachador/pendientes
 */
router.get('/pendientes', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, 
                u.nombre as cliente, 
                l.nombre as producto, 
                p.cantidad_laminas, 
                p.fecha_entrega,
                p.numero_pedido
            FROM pedidos p
            JOIN usuarios u ON p.usuario_id = u.id
            JOIN laminas l ON p.lamina_id = l.id
            WHERE p.estado = 'PENDIENTE'
            ORDER BY p.fecha_entrega ASC`; // Lo más urgente primero

        const result = await pool.query(query);
        
        res.json({
            conteo: result.rowCount,
            pedidos: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al cargar los pedidos pendientes" });
    }
});

/**
 * 2. ENVIAR A TALLER (De PENDIENTE a CORTE)
 * PUT /api/despachador/pedidos/:id/iniciar
 */
router.put('/pedidos/:id/iniciar', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "UPDATE pedidos SET estado = 'CORTE', actualizado_en = NOW() WHERE id = $1 AND estado = 'PENDIENTE' RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Pedido no encontrado o ya iniciado" });
        }

        res.json({ mensaje: "🚀 Pedido enviado a taller con éxito." });
    } catch (err) {
        res.status(500).json({ error: "Error al iniciar producción" });
    }
});

/**
 * 3. ENTREGAR AL CLIENTE (De LISTO a ENTREGADO)
 * PUT /api/despachador/pedidos/:id/entregar
 */
router.put('/pedidos/:id/entregar', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "UPDATE pedidos SET estado = 'ENTREGADO', actualizado_en = NOW() WHERE id = $1 AND estado = 'LISTO' RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "El pedido debe estar 'LISTO' para entregarse" });
        }

        res.json({ mensaje: "✅ Entrega realizada con éxito." });
    } catch (err) {
        res.status(500).json({ error: "Error al procesar la entrega" });
    }
});

module.exports = router;