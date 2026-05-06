const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * 1. REGISTRAR PEDIDO (Estado inicial: PENDIENTE)
 * POST /api/usuario/pedidos
 */
router.post('/pedidos', async (req, res) => {
    const { codigo_lamina, numero_pedido, cantidad_laminas } = req.body;
    const usuarioId = req.session.userId;
    const CAPACIDAD_MAXIMA = 30;

    if (!usuarioId) return res.status(401).json({ error: "Debe iniciar sesión" });

    const fechaFacturacion = new Date().toISOString().split('T')[0];

    try {
        let fechaBusqueda = new Date();
        let cupoEncontrado = false;
        let mensajeAviso = null;

        while (!cupoEncontrado) {
            const fechaString = fechaBusqueda.toISOString().split('T')[0];
            const resCarga = await pool.query(
                "SELECT SUM(cantidad_laminas) as total FROM pedidos WHERE fecha_entrega = $1 AND estado != 'ENTREGADO'",
                [fechaString]
            );

            const laminasEseDia = parseInt(resCarga.rows[0].total) || 0;

            if (laminasEseDia + parseInt(cantidad_laminas) <= CAPACIDAD_MAXIMA) {
                cupoEncontrado = true;
            } else {
                fechaBusqueda.setDate(fechaBusqueda.getDate() + 1);
            }
        }

        const fechaEntregaFinal = fechaBusqueda.toISOString().split('T')[0];
        if (fechaEntregaFinal !== fechaFacturacion) {
            mensajeAviso = `⚠️ Capacidad completa. Entrega estimada: ${fechaEntregaFinal}`;
        }

        // INSERT con estado 'PENDIENTE'
        const queryInsert = `
            INSERT INTO pedidos (usuario_id, lamina_id, numero_pedido, fecha_facturacion, fecha_entrega, cantidad_laminas, estado) 
            VALUES ($1, (SELECT id FROM laminas WHERE codigo = $2), $3, $4, $5, $6, 'PENDIENTE') 
            RETURNING *`;

        const result = await pool.query(queryInsert, [
            usuarioId, codigo_lamina, numero_pedido, fechaFacturacion, fechaEntregaFinal, cantidad_laminas
        ]);

        res.status(201).json({
            mensaje: mensajeAviso || "✅ Pedido registrado. Pendiente por validación de despacho.",
            pedido: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al procesar el pedido" });
    }
});

/**
 * 2. VER MIS PEDIDOS
 */
router.get('/mis-pedidos', async (req, res) => {
    const usuarioId = req.session.userId;
    if (!usuarioId) return res.status(401).json({ error: "Inicie sesión" });

    try {
        const query = `
            SELECT p.id, p.numero_pedido, l.nombre AS producto, p.cantidad_laminas, 
                   p.estado, p.fecha_facturacion, p.fecha_entrega
            FROM pedidos p
            INNER JOIN laminas l ON p.lamina_id = l.id
            WHERE p.usuario_id = $1
            ORDER BY p.creado_en DESC`;

        const result = await pool.query(query, [usuarioId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener historial" });
    }
});

module.exports = router;