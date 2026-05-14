const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Pedido = require('../models/Pedido');
const { requireRole } = require('../middleware/auth');

router.use(requireRole(['operador', 'administrador']));

const ORDEN_ESTADO = {
    CORTE: 1,
    ENCHAPE: 2,
    REFILADA: 3,
    ZUNCHADA: 4,
    LISTO: 5,
};

router.get('/pedidos', async (req, res) => {
    try {
        const rows = await Pedido.find({
            estado: { $nin: ['PENDIENTE', 'ENTREGADO', 'CANCELADO'] },
        })
            .populate('usuario_id', 'nombre')
            .populate('lamina_id', 'nombre')
            .lean();

        const cola = rows
            .map((p) => ({
                id: p._id.toString(),
                cliente: p.usuario_id?.nombre,
                lamina: p.lamina_id?.nombre,
                cantidad_laminas: p.cantidad_laminas,
                estado: p.estado,
                fecha_entrega: p.fecha_entrega,
            }))
            .sort((a, b) => {
                const oa = ORDEN_ESTADO[a.estado] ?? 99;
                const ob = ORDEN_ESTADO[b.estado] ?? 99;
                if (oa !== ob) return oa - ob;
                return String(a.fecha_entrega).localeCompare(String(b.fecha_entrega));
            });

        res.json({
            trabajos_activos: cola.length,
            cola,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener la cola de producción' });
    }
});

router.put('/pedidos/:id/avanzar', async (req, res) => {
    const { id } = req.params;
    const FLUJO = ['CORTE', 'ENCHAPE', 'REFILADA', 'ZUNCHADA', 'LISTO'];

    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Identificador inválido' });
        }

        const pedidoDoc = await Pedido.findById(id);
        if (!pedidoDoc) return res.status(404).json({ error: 'Pedido no encontrado' });

        const estadoActual = pedidoDoc.estado;
        const indexActual = FLUJO.indexOf(estadoActual);

        if (estadoActual === 'PENDIENTE') {
            return res.status(403).json({
                error: 'Acción no permitida',
                mensaje: 'Este pedido aún no ha sido autorizado por el despachador.',
            });
        }

        if (indexActual === -1 || indexActual === FLUJO.length - 1) {
            return res.status(400).json({ error: 'El pedido ya está en su fase final en taller' });
        }

        const nuevoEstado = FLUJO[indexActual + 1];
        pedidoDoc.estado = nuevoEstado;
        await pedidoDoc.save();

        res.json({ mensaje: `✅ Movido a ${nuevoEstado}`, actual: nuevoEstado });
    } catch (_err) {
        res.status(500).json({ error: 'Error en la línea de producción' });
    }
    // ... dentro de router.put('/pedidos/:id/avanzar')

const pedidoDoc = await Pedido.findById(id);
if (!pedidoDoc) return res.status(404).json({ error: 'Pedido no encontrado' });

// --- NUEVA LÓGICA DE LÍMITE DIARIO ---
const inicioHoy = new Date();
inicioHoy.setHours(0, 0, 0, 0);

const finHoy = new Date();
finHoy.setHours(23, 59, 59, 999);

// Sumamos la cantidad_laminas de todos los pedidos que ya están en proceso o terminados hoy
// (Excluimos los que siguen en PENDIENTE)
const agregadosHoy = await Pedido.aggregate([
    {
        $match: {
            estado: { $nin: ['PENDIENTE', 'CANCELADO'] },
            updatedAt: { $gte: inicioHoy, $lte: finHoy }
        }
    },
    {
        $group: {
            _id: null,
            totalLaminas: { $sum: "$cantidad_laminas" }
        }
    }
]);

const totalProcesado = agregadosHoy[0]?.totalLaminas || 0;
const LIMITE_DIARIO = 30;

// Si el pedido es nuevo en la línea (está en CORTE) y al sumarlo supera el límite
if (pedidoDoc.estado === 'CORTE' && (totalProcesado + pedidoDoc.cantidad_laminas) > LIMITE_DIARIO) {
    return res.status(403).json({ 
        error: 'Límite diario alcanzado', 
        mensaje: `No se pueden procesar más de ${LIMITE_DIARIO} láminas por día. Este pedido debe esperar a mañana.` 
    });
}
// ---------------------------------------
});

module.exports = router;
