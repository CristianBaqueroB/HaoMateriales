const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Lamina = require('../models/Lamina');
const User = require('../models/User');
const Pedido = require('../models/Pedido');
const PedidoCabecera = require('../models/PedidoCabecera');
const { requireRole } = require('../middleware/auth');

router.use(requireRole(['administrador']));

router.get('/laminas', async (req, res) => {
    try {
        const rows = await Lamina.find().sort({ creado_en: -1 });
        res.json(rows.map((row) => row.toJSON()));
    } catch (err) {
        console.error('❌ ERROR EN GET /laminas:', err.message);
        res.status(500).json({ error: 'Error interno al listar inventario' });
    }
});

router.post('/laminas', async (req, res) => {
    const { codigo, nombre, descripcion, stock, precio } = req.body;
    try {
        const creado = await Lamina.create({
            codigo,
            nombre,
            descripcion,
            stock,
            precio,
        });
        res.status(201).json(creado.toJSON());
    } catch (err) {
        console.error('❌ ERROR EN POST /laminas:', err.message);
        res.status(400).json({ error: 'No se pudo crear. Revisa si el código ya existe.' });
    }
});

router.put('/laminas/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock } = req.body;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Identificador inválido' });
        }
        const actualizado = await Lamina.findByIdAndUpdate(
            id,
            { nombre, descripcion, precio, stock },
            { new: true, runValidators: true }
        );
        if (!actualizado) return res.status(404).json({ error: 'No encontrado' });
        res.json({ mensaje: 'Actualizado con éxito', producto: actualizado.toJSON() });
    } catch (err) {
        console.error('❌ ERROR EN PUT /laminas/:id:', err.message);
        res.status(500).json({ error: 'Error al actualizar los datos' });
    }
});

router.patch('/laminas/:id/stock', async (req, res) => {
    const { id } = req.params;
    const { cantidad } = req.body;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Identificador inválido' });
        }
        const doc = await Lamina.findByIdAndUpdate(id, { $inc: { stock: cantidad } }, {
            new: true,
            runValidators: true,
        });
        if (!doc) return res.status(404).json({ error: 'Lámina no encontrada' });
        res.json({ mensaje: 'Stock actualizado', nuevo_stock: doc.stock });
    } catch (err) {
        console.error('❌ ERROR EN PATCH /stock:', err.message);
        res.status(500).json({ error: 'No se pudo actualizar el stock' });
    }
});

router.get('/usuarios', async (req, res) => {
    try {
        const rows = await User.find({}, 'nombre email rol creado_en').sort({ nombre: 1 }).lean();
        res.json(
            rows.map((u) => ({
                id: u._id.toString(),
                nombre: u.nombre,
                email: u.email,
                rol: u.rol,
                creado_en: u.creado_en,
            }))
        );
    } catch (err) {
        console.error('❌ ERROR EN GET /usuarios:', err.message);
        res.status(500).json({ error: 'Error al obtener lista de personal' });
    }
});

router.get('/ventas', async (_req, res) => {
    try {
        const lineas = await Pedido.find({})
            .populate('lamina_id', 'nombre codigo precio')
            .populate('usuario_id', 'nombre email')
            .sort({ creado_en: -1 })
            .lean();

        const numeros = [...new Set(lineas.map((l) => l.numero_pedido))];
        const cabs = await PedidoCabecera.find({ numero_pedido: { $in: numeros } }).lean();
        const cabMap = Object.fromEntries(cabs.map((c) => [c.numero_pedido, c]));

        const grupos = new Map();
        for (const ln of lineas) {
            if (!grupos.has(ln.numero_pedido)) {
                grupos.set(ln.numero_pedido, []);
            }
            grupos.get(ln.numero_pedido).push(ln);
        }

        const ventas = [...grupos.entries()].map(([numero, filas]) => {
            const first = filas[0];
            const cab = cabMap[numero];
            const subtotal = filas.reduce(
                (acc, x) => acc + x.cantidad_laminas * Number(x.lamina_id?.precio || 0),
                0
            );
            const recargo = cab?.tipo_entrega === 'domicilio' ? Number(cab.recargo_envio || 0) : 0;
            return {
                numero_pedido: numero,
                cliente: first.usuario_id?.nombre || '—',
                email: first.usuario_id?.email || '—',
                fecha_facturacion: first.fecha_facturacion,
                fecha_entrega: first.fecha_entrega,
                tipo_entrega: cab?.tipo_entrega || (first.direccion_envio ? 'domicilio' : 'punto_venta'),
                estado_cabecera: cab?.estado || 'activo',
                estado_actual: first.estado,
                lineas: filas.length,
                subtotal,
                recargo_envio: recargo,
                total: subtotal + recargo,
            };
        });

        ventas.sort((a, b) => String(b.fecha_facturacion).localeCompare(String(a.fecha_facturacion)));
        res.json(ventas);
    } catch (err) {
        console.error('❌ ERROR EN GET /ventas:', err.message);
        res.status(500).json({ error: 'No se pudo cargar el historial de ventas' });
    }
});

module.exports = router;
