const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Lamina = require('../models/Lamina');
const Pedido = require('../models/Pedido');
const PedidoCabecera = require('../models/PedidoCabecera');
const { RECARGO_DOMICILIO_COP } = require('../models/PedidoCabecera');
const { requireLogin } = require('../middleware/auth');

const CAPACIDAD_MAXIMA = 30;
const MAX_DIAS_REPROGRAMACION = 3;

function mergeItemsByCodigo(items) {
    const map = new Map();
    for (const it of items) {
        const code = String(it.codigo_lamina || '').trim();
        const q = parseInt(it.cantidad_laminas, 10);
        if (!code || !Number.isFinite(q) || q < 1) continue;
        map.set(code, (map.get(code) || 0) + q);
    }
    return [...map.entries()].map(([codigo_lamina, cantidad_laminas]) => ({ codigo_lamina, cantidad_laminas }));
}

/** Cupo diario: no cuenta ENTREGADO ni CANCELADO; al editar excluye el mismo número de pedido. */
async function encontrarFechaEntrega(cantidadLaminas, excludeNumeroPedido = null) {
    const fechaFacturacion = new Date().toISOString().split('T')[0];
    const fechaBase = new Date();
    let fechaBusqueda = new Date(fechaBase);
    let cupoEncontrado = false;
    let mensajeAviso = null;
    const n = parseInt(cantidadLaminas, 10);

    if (!Number.isFinite(n) || n < 1) {
        return { error: 'Cantidad inválida para calcular entrega.' };
    }
    if (n > CAPACIDAD_MAXIMA) {
        return {
            error: `Capacidad excedida: un pedido no puede superar ${CAPACIDAD_MAXIMA} láminas.`,
        };
    }

    while (!cupoEncontrado) {
        const diffDias = Math.floor((fechaBusqueda.getTime() - fechaBase.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias > MAX_DIAS_REPROGRAMACION) {
            return {
                error: `No hay cupo disponible en los próximos ${MAX_DIAS_REPROGRAMACION} días. Intenta con menor cantidad.`,
            };
        }

        const fechaString = fechaBusqueda.toISOString().split('T')[0];
        const match = {
            fecha_entrega: fechaString,
            estado: { $nin: ['ENTREGADO', 'CANCELADO'] },
        };
        if (excludeNumeroPedido) {
            match.numero_pedido = { $ne: excludeNumeroPedido };
        }
        const agg = await Pedido.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$cantidad_laminas' } } },
        ]);
        const laminasEseDia = agg[0]?.total || 0;

        if (laminasEseDia + n <= CAPACIDAD_MAXIMA) {
            cupoEncontrado = true;
        } else {
            fechaBusqueda.setDate(fechaBusqueda.getDate() + 1);
        }
    }

    const fechaEntregaFinal = fechaBusqueda.toISOString().split('T')[0];
    if (fechaEntregaFinal !== fechaFacturacion) {
        mensajeAviso = `⚠️ Capacidad completa. Entrega estimada: ${fechaEntregaFinal} (máximo ${MAX_DIAS_REPROGRAMACION} días de ajuste).`;
    }
    return { fechaFacturacion, fechaEntregaFinal, mensajeAviso };
}

function normalizarTipoEntrega(tipo, direccion) {
    const t = String(tipo || '').trim();
    const dir = String(direccion || '').trim();
    if (t !== 'punto_venta' && t !== 'domicilio') {
        return { ok: false, error: 'Indica tipo de entrega: punto_venta o domicilio.' };
    }
    if (t === 'domicilio') {
        if (dir.length < 8) {
            return { ok: false, error: 'Para envío a domicilio escribí la dirección completa (mín. 8 caracteres).' };
        }
        return {
            ok: true,
            tipo_entrega: 'domicilio',
            direccion_envio: dir,
            recargo_envio: RECARGO_DOMICILIO_COP,
        };
    }
    return {
        ok: true,
        tipo_entrega: 'punto_venta',
        direccion_envio: '',
        recargo_envio: 0,
    };
}

async function mapearLineasAStockPrevioGrupo(numeroPedido, usuarioId) {
    const lineas = await Pedido.find({ numero_pedido: numeroPedido, usuario_id: usuarioId })
        .populate('lamina_id', 'codigo')
        .lean();
    const map = new Map();
    for (const ln of lineas) {
        const cod = ln.lamina_id?.codigo;
        if (!cod) continue;
        map.set(cod, (map.get(cod) || 0) + ln.cantidad_laminas);
    }
    return map;
}

async function validarItemsConStock(merged, stockExtraPorCodigo) {
    const laminaPorLinea = [];
    let totalQty = 0;
    for (const it of merged) {
        const q = parseInt(it.cantidad_laminas, 10);
        const lamina = await Lamina.findOne({ codigo: it.codigo_lamina });
        if (!lamina) {
            return { error: `Código de lámina no válido: ${it.codigo_lamina}` };
        }
        const extra = stockExtraPorCodigo.get(it.codigo_lamina) || 0;
        const disponible = lamina.stock + extra;
        if (q > disponible) {
            return {
                error: `Stock insuficiente para "${lamina.nombre}" (disponible: ${lamina.stock}; este pedido ya tenía ${extra}).`,
            };
        }
        totalQty += q;
        laminaPorLinea.push({ lamina, cantidad: q });
    }
    return { laminaPorLinea, totalQty };
}

async function aplicarMovimientoStock(session, laminaId, delta) {
    await Lamina.updateOne(
        { _id: laminaId },
        { $inc: { stock: delta } },
        { session }
    );
}

async function enriquecerFilas(rows) {
    const nums = [...new Set(rows.map((r) => r.numero_pedido))];
    const cabs = await PedidoCabecera.find({ numero_pedido: { $in: nums } }).lean();
    const cabMap = Object.fromEntries(cabs.map((c) => [c.numero_pedido, c]));

    return rows.map((p) => {
        const cab = cabMap[p.numero_pedido];
        const tipo =
            cab?.tipo_entrega ?? (p.direccion_envio ? 'domicilio' : 'punto_venta');
        const dirCab = cab?.direccion_envio ?? '';
        const dirLinea = p.direccion_envio || '';
        return {
            ...p,
            tipo_entrega: tipo,
            recargo_envio: cab?.tipo_entrega === 'domicilio' ? cab.recargo_envio ?? 0 : 0,
            direccion_envio: dirCab || dirLinea,
            cabecera_estado: cab?.estado ?? 'activo',
        };
    });
}

/** GET /api/usuario/catalogo */
router.get('/catalogo', requireLogin, async (_req, res) => {
    try {
        const rows = await Lamina.find()
            .sort({ nombre: 1 })
            .select('codigo nombre precio stock')
            .lean();
        res.json(
            rows.map((r) => ({
                codigo: r.codigo,
                nombre: r.nombre,
                precio: r.precio,
                stock: r.stock,
            }))
        );
    } catch (err) {
        console.error('GET /catalogo:', err.message);
        res.status(500).json({ error: 'No se pudo cargar el catálogo' });
    }
});

/**
 * POST /api/usuario/pedidos
 * Carrito: { tipo_entrega, direccion_envio?, items: [...] }
 * Legacy: { codigo_lamina, numero_pedido, cantidad_laminas, direccion_envio?, tipo_entrega? }
 */
router.post('/pedidos', async (req, res) => {
    const usuarioId = req.session.userId;
    if (!usuarioId) return res.status(401).json({ error: 'Debe iniciar sesión' });

    try {
        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        const body = req.body;
        const isBatch = Array.isArray(body.items) && body.items.length > 0;

        if (isBatch) {
            const ent = normalizarTipoEntrega(body.tipo_entrega, body.direccion_envio);
            if (!ent.ok) return res.status(400).json({ error: ent.error });

            const merged = mergeItemsByCodigo(body.items);
            if (merged.length === 0) {
                return res.status(400).json({ error: 'Agrega al menos un producto válido al pedido.' });
            }

            const stockMap = new Map();
            const v = await validarItemsConStock(merged, stockMap);
            if (v.error) return res.status(400).json({ error: v.error });

            const { laminaPorLinea, totalQty } = v;
            if (totalQty > CAPACIDAD_MAXIMA) {
                return res.status(400).json({
                    error: `Capacidad excedida: máximo ${CAPACIDAD_MAXIMA} láminas por pedido.`,
                });
            }
            const calcEntrega = await encontrarFechaEntrega(totalQty);
            if (calcEntrega.error) return res.status(400).json({ error: calcEntrega.error });
            const { fechaFacturacion, fechaEntregaFinal, mensajeAviso } = calcEntrega;
            const numero_pedido = `HAO-${Date.now()}`;

            const docs = laminaPorLinea.map(({ lamina, cantidad }) => ({
                usuario_id: usuarioId,
                lamina_id: lamina._id,
                numero_pedido,
                fecha_facturacion: fechaFacturacion,
                fecha_entrega: fechaEntregaFinal,
                cantidad_laminas: cantidad,
                direccion_envio: '',
                estado: 'PENDIENTE',
            }));

            const cabDoc = {
                numero_pedido,
                usuario_id: usuarioId,
                tipo_entrega: ent.tipo_entrega,
                direccion_envio: ent.direccion_envio,
                recargo_envio: ent.recargo_envio,
                fecha_facturacion: fechaFacturacion,
                fecha_entrega: fechaEntregaFinal,
                estado: 'activo',
            };

            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    await PedidoCabecera.create([cabDoc], { session });
                    await Pedido.insertMany(docs, { session });
                    for (const { lamina, cantidad } of laminaPorLinea) {
                        await aplicarMovimientoStock(session, lamina._id, -cantidad);
                    }
                });
            } finally {
                session.endSession();
            }

            return res.status(201).json({
                mensaje: mensajeAviso || '✅ Pedido registrado. Pendiente por validación de despacho.',
                numero_pedido,
                lineas: docs.length,
                fecha_entrega: fechaEntregaFinal,
                tipo_entrega: ent.tipo_entrega,
                recargo_envio: ent.recargo_envio,
            });
        }

        const { codigo_lamina, numero_pedido, cantidad_laminas, direccion_envio, tipo_entrega } = body;
        if (!codigo_lamina || !numero_pedido || cantidad_laminas == null) {
            return res.status(400).json({ error: 'Datos de pedido incompletos.' });
        }

        const qty = parseInt(cantidad_laminas, 10);
        if (!Number.isFinite(qty) || qty < 1) {
            return res.status(400).json({ error: 'Cantidad inválida.' });
        }
        if (qty > CAPACIDAD_MAXIMA) {
            return res.status(400).json({
                error: `Capacidad excedida: máximo ${CAPACIDAD_MAXIMA} láminas por pedido.`,
            });
        }

        const ent = normalizarTipoEntrega(
            tipo_entrega || (direccion_envio ? 'domicilio' : 'punto_venta'),
            tipo_entrega === 'punto_venta' ? '' : (direccion_envio || '')
        );
        if (!ent.ok) return res.status(400).json({ error: ent.error });

        const lamina = await Lamina.findOne({ codigo: codigo_lamina });
        if (!lamina) return res.status(400).json({ error: 'Código de lámina no válido' });
        if (lamina.stock < qty) {
            return res.status(400).json({ error: `Stock insuficiente (disponible: ${lamina.stock}).` });
        }

        const calcEntrega = await encontrarFechaEntrega(qty);
        if (calcEntrega.error) return res.status(400).json({ error: calcEntrega.error });
        const { fechaFacturacion, fechaEntregaFinal, mensajeAviso } = calcEntrega;

        const session = await mongoose.startSession();
        let pedidoDoc;
        try {
            await session.withTransaction(async () => {
                await PedidoCabecera.create(
                    [
                        {
                            numero_pedido,
                            usuario_id: usuarioId,
                            tipo_entrega: ent.tipo_entrega,
                            direccion_envio: ent.direccion_envio,
                            recargo_envio: ent.recargo_envio,
                            fecha_facturacion: fechaFacturacion,
                            fecha_entrega: fechaEntregaFinal,
                            estado: 'activo',
                        },
                    ],
                    { session }
                );
                const [creado] = await Pedido.create(
                    [
                        {
                            usuario_id: usuarioId,
                            lamina_id: lamina._id,
                            numero_pedido,
                            fecha_facturacion: fechaFacturacion,
                            fecha_entrega: fechaEntregaFinal,
                            cantidad_laminas: qty,
                            direccion_envio: '',
                            estado: 'PENDIENTE',
                        },
                    ],
                    { session }
                );
                await aplicarMovimientoStock(session, lamina._id, -qty);
                pedidoDoc = creado;
            });
        } finally {
            session.endSession();
        }

        res.status(201).json({
            mensaje: mensajeAviso || '✅ Pedido registrado. Pendiente por validación de despacho.',
            pedido: pedidoDoc.toJSON(),
            tipo_entrega: ent.tipo_entrega,
            recargo_envio: ent.recargo_envio,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al procesar el pedido' });
    }
});

/** GET /api/usuario/mis-pedidos */
router.get('/mis-pedidos', async (req, res) => {
    const usuarioId = req.session.userId;
    if (!usuarioId) return res.status(401).json({ error: 'Inicie sesión' });

    try {
        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        const rows = await Pedido.find({ usuario_id: usuarioId })
            .populate('lamina_id', 'nombre codigo precio')
            .sort({ creado_en: -1 })
            .lean();

        const base = rows.map((p) => ({
            id: p._id.toString(),
            numero_pedido: p.numero_pedido,
            producto: p.lamina_id?.nombre,
            codigo: p.lamina_id?.codigo,
            precio_unitario: p.lamina_id?.precio ?? 0,
            cantidad_laminas: p.cantidad_laminas,
            estado: p.estado,
            fecha_facturacion: p.fecha_facturacion,
            fecha_entrega: p.fecha_entrega,
            direccion_envio: p.direccion_envio || '',
        }));

        res.json(await enriquecerFilas(base));
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

/** GET /api/usuario/pedidos/grupo/:numeroPedido — detalle para editar */
router.get('/pedidos/grupo/:numeroPedido', async (req, res) => {
    const usuarioId = req.session.userId;
    if (!usuarioId) return res.status(401).json({ error: 'Inicie sesión' });

    const numeroPedido = decodeURIComponent(req.params.numeroPedido);

    try {
        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        const cab = await PedidoCabecera.findOne({ numero_pedido: numeroPedido, usuario_id: usuarioId }).lean();
        const lineas = await Pedido.find({ numero_pedido: numeroPedido, usuario_id: usuarioId })
            .populate('lamina_id', 'codigo nombre precio')
            .lean();

        if (lineas.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        const todosPendientes = lineas.every((l) => l.estado === 'PENDIENTE');
        const tipo = cab?.tipo_entrega ?? (lineas[0].direccion_envio ? 'domicilio' : 'punto_venta');
        const direccion = cab?.direccion_envio ?? lineas[0].direccion_envio ?? '';
        const recargo =
            cab != null
                ? cab.tipo_entrega === 'domicilio'
                    ? cab.recargo_envio
                    : 0
                : 0;

        res.json({
            numero_pedido: numeroPedido,
            tipo_entrega: tipo,
            direccion_envio: tipo === 'domicilio' ? direccion : '',
            recargo_envio: tipo === 'domicilio' ? recargo : 0,
            cabecera_estado: cab?.estado ?? 'activo',
            puede_editar: todosPendientes && (cab?.estado ?? 'activo') === 'activo',
            items: lineas.map((l) => ({
                codigo_lamina: l.lamina_id?.codigo,
                nombre: l.lamina_id?.nombre,
                precio: l.lamina_id?.precio,
                cantidad_laminas: l.cantidad_laminas,
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al cargar el pedido' });
    }
});

/** PUT /api/usuario/pedidos/grupo/:numeroPedido — solo PENDIENTE y cabecera activa */
router.put('/pedidos/grupo/:numeroPedido', async (req, res) => {
    const usuarioId = req.session.userId;
    if (!usuarioId) return res.status(401).json({ error: 'Debe iniciar sesión' });

    const numeroPedido = decodeURIComponent(req.params.numeroPedido);

    try {
        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        let cab = await PedidoCabecera.findOne({ numero_pedido: numeroPedido, usuario_id: usuarioId });

        const lineasActuales = await Pedido.find({ numero_pedido: numeroPedido, usuario_id: usuarioId });
        if (lineasActuales.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        if (!lineasActuales.every((l) => l.estado === 'PENDIENTE')) {
            return res.status(403).json({ error: 'Solo se puede editar mientras el pedido está pendiente de despacho.' });
        }

        if (cab && cab.estado !== 'activo') {
            return res.status(400).json({ error: 'No se puede modificar este pedido.' });
        }

        if (!cab) {
            const ln0 = lineasActuales[0];
            const dirLeg = String(ln0.direccion_envio || '').trim();
            const tipoLeg = dirLeg ? 'domicilio' : 'punto_venta';
            cab = await PedidoCabecera.create({
                numero_pedido: numeroPedido,
                usuario_id: usuarioId,
                tipo_entrega: tipoLeg,
                direccion_envio: tipoLeg === 'domicilio' ? dirLeg : '',
                recargo_envio: 0,
                fecha_facturacion: ln0.fecha_facturacion,
                fecha_entrega: ln0.fecha_entrega,
                estado: 'activo',
            });
        }

        const ent = normalizarTipoEntrega(req.body.tipo_entrega, req.body.direccion_envio);
        if (!ent.ok) return res.status(400).json({ error: ent.error });

        const merged = mergeItemsByCodigo(req.body.items || []);
        if (merged.length === 0) {
            return res.status(400).json({ error: 'El pedido debe tener al menos un producto.' });
        }

        const stockExtraMap = await mapearLineasAStockPrevioGrupo(numeroPedido, usuarioId);
        const v = await validarItemsConStock(merged, stockExtraMap);
        if (v.error) return res.status(400).json({ error: v.error });

        const { laminaPorLinea, totalQty } = v;
        if (totalQty > CAPACIDAD_MAXIMA) {
            return res.status(400).json({
                error: `Capacidad excedida: máximo ${CAPACIDAD_MAXIMA} láminas por pedido.`,
            });
        }
        const calcEntrega = await encontrarFechaEntrega(totalQty, numeroPedido);
        if (calcEntrega.error) return res.status(400).json({ error: calcEntrega.error });
        const { fechaFacturacion, fechaEntregaFinal, mensajeAviso } = calcEntrega;

        const docs = laminaPorLinea.map(({ lamina, cantidad }) => ({
            usuario_id: usuarioId,
            lamina_id: lamina._id,
            numero_pedido: numeroPedido,
            fecha_facturacion: fechaFacturacion,
            fecha_entrega: fechaEntregaFinal,
            cantidad_laminas: cantidad,
            direccion_envio: '',
            estado: 'PENDIENTE',
        }));

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                for (const ln of lineasActuales) {
                    await aplicarMovimientoStock(session, ln.lamina_id, ln.cantidad_laminas);
                }
                await Pedido.deleteMany({ numero_pedido: numeroPedido, usuario_id: usuarioId }, { session });
                await Pedido.insertMany(docs, { session });
                for (const { lamina, cantidad } of laminaPorLinea) {
                    await aplicarMovimientoStock(session, lamina._id, -cantidad);
                }
                cab.tipo_entrega = ent.tipo_entrega;
                cab.direccion_envio = ent.direccion_envio;
                cab.recargo_envio = ent.recargo_envio;
                cab.fecha_facturacion = fechaFacturacion;
                cab.fecha_entrega = fechaEntregaFinal;
                await cab.save({ session });
            });
        } finally {
            session.endSession();
        }

        res.json({
            mensaje: mensajeAviso || 'Pedido actualizado.',
            numero_pedido: numeroPedido,
            fecha_entrega: fechaEntregaFinal,
            tipo_entrega: ent.tipo_entrega,
            recargo_envio: ent.recargo_envio,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al actualizar el pedido' });
    }
});

/** DELETE /api/usuario/pedidos/grupo/:numeroPedido — cancelar (PENDIENTE) */
router.delete('/pedidos/grupo/:numeroPedido', async (req, res) => {
    const usuarioId = req.session.userId;
    if (!usuarioId) return res.status(401).json({ error: 'Debe iniciar sesión' });

    const numeroPedido = decodeURIComponent(req.params.numeroPedido);

    try {
        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(401).json({ error: 'Sesión inválida' });
        }

        const cab = await PedidoCabecera.findOne({ numero_pedido: numeroPedido, usuario_id: usuarioId });
        const lineas = await Pedido.find({ numero_pedido: numeroPedido, usuario_id: usuarioId });

        if (lineas.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        if (!lineas.every((l) => l.estado === 'PENDIENTE')) {
            return res.status(403).json({ error: 'Solo se puede cancelar mientras está pendiente.' });
        }
        if (cab && cab.estado !== 'activo') {
            return res.status(400).json({ error: 'Este pedido ya fue cancelado.' });
        }

        if (cab) {
            cab.estado = 'cancelado';
            await cab.save();
        }
        const stockPorLamina = new Map();
        for (const ln of lineas) {
            const k = ln.lamina_id.toString();
            stockPorLamina.set(k, (stockPorLamina.get(k) || 0) + ln.cantidad_laminas);
        }
        for (const [laminaId, cantidad] of stockPorLamina.entries()) {
            await Lamina.updateOne({ _id: laminaId }, { $inc: { stock: cantidad } });
        }
        await Pedido.updateMany(
            { numero_pedido: numeroPedido, usuario_id: usuarioId },
            { $set: { estado: 'CANCELADO' } }
        );

        res.json({ mensaje: 'Pedido cancelado.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al cancelar' });
    }
});

module.exports = router;
