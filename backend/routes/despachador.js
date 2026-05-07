const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Pedido = require('../models/Pedido');
const { requireRole } = require('../middleware/auth');

router.use(requireRole(['despachador', 'administrador']));

router.get('/pendientes', async (req, res) => {
    try {
        const rows = await Pedido.find({ estado: 'PENDIENTE' })
            .populate('usuario_id', 'nombre')
            .populate('lamina_id', 'nombre')
            .sort({ fecha_entrega: 1 })
            .lean();

        const pedidos = rows.map((p) => ({
            id: p._id.toString(),
            cliente: p.usuario_id?.nombre,
            producto: p.lamina_id?.nombre,
            cantidad_laminas: p.cantidad_laminas,
            fecha_entrega: p.fecha_entrega,
            numero_pedido: p.numero_pedido,
        }));

        res.json({
            conteo: pedidos.length,
            pedidos,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al cargar los pedidos pendientes' });
    }
});

router.put('/pedidos/:id/iniciar', async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Identificador inválido' });
        }

        const pedido = await Pedido.findOne({ _id: id, estado: 'PENDIENTE' });
        if (!pedido) {
            return res.status(400).json({ error: 'Pedido no encontrado o ya iniciado' });
        }
        pedido.estado = 'CORTE';
        await pedido.save();

        res.json({ mensaje: '🚀 Pedido enviado a taller con éxito.' });
    } catch (_err) {
        res.status(500).json({ error: 'Error al iniciar producción' });
    }
});

router.put('/pedidos/:id/entregar', async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Identificador inválido' });
        }

        const pedido = await Pedido.findOne({ _id: id, estado: 'LISTO' });
        if (!pedido) {
            return res.status(400).json({ error: "El pedido debe estar 'LISTO' para entregarse" });
        }
        pedido.estado = 'ENTREGADO';
        await pedido.save();

        res.json({ mensaje: '✅ Entrega realizada con éxito.' });
    } catch (_err) {
        res.status(500).json({ error: 'Error al procesar la entrega' });
    }
});

module.exports = router;
