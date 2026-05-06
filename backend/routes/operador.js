const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireRole } = require('../middleware/auth');

// Seguridad: Solo el personal de taller y el jefe
router.use(requireRole(['operador', 'administrador']));

/**
 * LISTAR COLA DE PRODUCCIÓN
 * GET /api/operador/pedidos
 */
router.get('/pedidos', async (req, res) => {
    try {
        // Filtramos para NO mostrar 'PENDIENTE' ni 'ENTREGADO'
        const query = `
            SELECT 
                p.id, 
                u.nombre as cliente, 
                l.nombre as lamina, 
                p.cantidad_laminas, 
                p.estado, 
                p.fecha_entrega 
            FROM pedidos p
            JOIN usuarios u ON p.usuario_id = u.id
            JOIN laminas l ON p.lamina_id = l.id
            WHERE p.estado NOT IN ('PENDIENTE', 'ENTREGADO') 
            ORDER BY 
                CASE 
                    WHEN p.estado = 'CORTE' THEN 1
                    WHEN p.estado = 'ENCHAPE' THEN 2
                    WHEN p.estado = 'REFILADA' THEN 3
                    WHEN p.estado = 'ZUNCHADA' THEN 4
                    WHEN p.estado = 'LISTO' THEN 5
                    ELSE 6
                END, 
                p.fecha_entrega ASC`;

        const result = await pool.query(query);
        
        res.json({
            trabajos_activos: result.rowCount,
            cola: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener la cola de producción" });
    }
});

/**
 * AVANZAR ESTADO (Flujo de Fábrica)
 * PUT /api/operador/pedidos/:id/avanzar
 */
router.put('/pedidos/:id/avanzar', async (req, res) => {
    const { id } = req.params;
    const FLUJO = ['CORTE', 'ENCHAPE', 'REFILADA', 'ZUNCHADA', 'LISTO'];

    try {
        const pedido = await pool.query("SELECT estado FROM pedidos WHERE id = $1", [id]);
        if (pedido.rows.length === 0) return res.status(404).json({ error: "Pedido no encontrado" });

        const estadoActual = pedido.rows[0].estado;
        const indexActual = FLUJO.indexOf(estadoActual);

        // Si el estado es 'PENDIENTE', el operador no puede avanzarlo
        if (estadoActual === 'PENDIENTE') {
            return res.status(403).json({ 
                error: "Acción no permitida", 
                mensaje: "Este pedido aún no ha sido autorizado por el despachador." 
            });
        }

        if (indexActual === -1 || indexActual === FLUJO.length - 1) {
            return res.status(400).json({ error: "El pedido ya está en su fase final en taller" });
        }

        const nuevoEstado = FLUJO[indexActual + 1];
        await pool.query(
            "UPDATE pedidos SET estado = $1, actualizado_en = NOW() WHERE id = $2",
            [nuevoEstado, id]
        );

        res.json({ mensaje: `✅ Movido a ${nuevoEstado}`, actual: nuevoEstado });
    } catch (err) {
        res.status(500).json({ error: "Error en la línea de producción" });
    }
});

module.exports = router;