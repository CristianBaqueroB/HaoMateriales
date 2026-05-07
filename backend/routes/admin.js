const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Lamina = require('../models/Lamina');
const User = require('../models/User');
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

module.exports = router;
