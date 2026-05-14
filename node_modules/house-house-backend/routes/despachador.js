const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Pedido = require('../models/Pedido');
const PedidoCabecera = require('../models/PedidoCabecera');
const { requireRole } = require('../middleware/auth');

router.use(requireRole(['despachador', 'administrador']));
const CAPACIDAD_MAXIMA = 30;
const MAX_DIAS_REPROGRAMACION = 3;
const ESTADOS_EN_PRODUCCION = ['CORTE', 'ENCHAPE', 'REFILADA', 'ZUNCHADA', 'LISTO'];

async function adjuntarTipoEntrega(rows) {
    const nums = [...new Set(rows.map((p) => p.numero_pedido))];
    const cabs = await PedidoCabecera.find({ numero_pedido: { $in: nums } }).lean();
    const cabMap = Object.fromEntries(cabs.map((c) => [c.numero_pedido, c]));
    return rows.map((p) => {
        const cab = cabMap[p.numero_pedido];
        const tipoEntrega =
            cab?.tipo_entrega ?? ((p.direccion_envio || '').trim() ? 'domicilio' : 'punto_venta');
        const direccion = (cab?.direccion_envio ?? p.direccion_envio ?? '').trim();
        return {
            id: p._id.toString(),
            cliente: p.usuario_id?.nombre,
            producto: p.lamina_id?.nombre,
            cantidad_laminas: p.cantidad_laminas,
            fecha_entrega: p.fecha_entrega,
            numero_pedido: p.numero_pedido,
            estado: p.estado,
            tipo_entrega: tipoEntrega,
            direccion_envio: tipoEntrega === 'domicilio' ? direccion : '',
        };
    });
}

async function buscarFechaProduccionDisponible(cantidadLaminas, excludeNumeroPedido = null) {
    const hoy = new Date();
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const n = parseInt(cantidadLaminas, 10);
    if (!Number.isFinite(n) || n < 1 || n > CAPACIDAD_MAXIMA) return null;

    for (let i = 0; i <= MAX_DIAS_REPROGRAMACION; i += 1) {
        const f = new Date(base);
        f.setDate(base.getDate() + i);
        const fecha = f.toISOString().split('T')[0];
        const match = {
            fecha_entrega: fecha,
            estado: { $in: ESTADOS_EN_PRODUCCION },
        };
        if (excludeNumeroPedido) {
            match.numero_pedido = { $ne: excludeNumeroPedido };
        }
        const agg = await Pedido.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$cantidad_laminas' } } },
        ]);
        const totalDia = agg[0]?.total || 0;
        if (totalDia + n <= CAPACIDAD_MAXIMA) return fecha;
    }
    return null;
}

router.get('/pendientes', async (req, res) => {
    try {
        const rows = await Pedido.find({ estado: 'PENDIENTE' })
            .populate('usuario_id', 'nombre')
            .populate('lamina_id', 'nombre')
            .sort({ fecha_entrega: 1 })
            .lean();

        const pedidos = await adjuntarTipoEntrega(rows);

        res.json({
            conteo: pedidos.length,
            pedidos,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al cargar los pedidos pendientes' });
    }
});

router.get('/listos', async (req, res) => {
    try {
        const rows = await Pedido.find({ estado: 'LISTO' })
            .populate('usuario_id', 'nombre')
            .populate('lamina_id', 'nombre')
            .sort({ fecha_entrega: 1 })
            .lean();

        const pedidos = await adjuntarTipoEntrega(rows);

        res.json({
            conteo: pedidos.length,
            pedidos,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al cargar pedidos listos para entrega' });
    }
});

router.put('/pedidos/:id/iniciar', async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Identificador inválido' });
        }

        const obs = typeof req.body?.observacion === 'string' ? req.body.observacion.trim() : '';

        const pedido = await Pedido.findOne({ _id: id, estado: 'PENDIENTE' });
        if (!pedido) {
            return res.status(400).json({ error: 'Pedido no encontrado o ya iniciado' });
        }

        const aggPedido = await Pedido.aggregate([
            {
                $match: {
                    numero_pedido: pedido.numero_pedido,
                    estado: { $ne: 'CANCELADO' },
                },
            },
            { $group: { _id: '$numero_pedido', total: { $sum: '$cantidad_laminas' } } },
        ]);
        const totalPedido = aggPedido[0]?.total || 0;
        if (totalPedido > CAPACIDAD_MAXIMA) {
            return res.status(400).json({
                error: `No se puede enviar a operador: el pedido supera ${CAPACIDAD_MAXIMA} láminas.`,
            });
        }

        const fechaDisponible = await buscarFechaProduccionDisponible(totalPedido, pedido.numero_pedido);
        if (!fechaDisponible) {
            return res.status(409).json({
                error: `Sin cupo de producción. Solo se permite reprogramar hasta ${MAX_DIAS_REPROGRAMACION} días.`,
            });
        }
        if (fechaDisponible !== pedido.fecha_entrega) {
            await Pedido.updateMany(
                { numero_pedido: pedido.numero_pedido, estado: 'PENDIENTE' },
                { $set: { fecha_entrega: fechaDisponible } }
            );
            await PedidoCabecera.updateOne(
                { numero_pedido: pedido.numero_pedido, estado: 'activo' },
                { $set: { fecha_entrega: fechaDisponible } }
            );
            return res.status(409).json({
                error: `Capacidad completa. Pedido reprogramado para ${fechaDisponible}. Reintenta enviar a taller.`,
            });
        }

        pedido.estado = 'CORTE';
        if (obs) pedido.nota_envio_a_taller = obs;
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

        const obs = typeof req.body?.observacion === 'string' ? req.body.observacion.trim() : '';

        const pedido = await Pedido.findOne({ _id: id, estado: 'LISTO' });
        if (!pedido) {
            return res.status(400).json({ error: "El pedido debe estar 'LISTO' para entregarse" });
        }
        pedido.estado = 'ENTREGADO';
        if (obs) pedido.nota_entrega_logistica = obs;
        await pedido.save();

        res.json({ mensaje: '✅ Entrega realizada con éxito.' });
    } catch (_err) {
        res.status(500).json({ error: 'Error al procesar la entrega' });
    }
});

module.exports = router;
