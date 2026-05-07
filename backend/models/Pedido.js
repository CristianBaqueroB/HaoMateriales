const mongoose = require('mongoose');

const pedidoSchema = new mongoose.Schema(
    {
        usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        lamina_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lamina', required: true },
        numero_pedido: { type: String, required: true },
        fecha_facturacion: { type: String, required: true },
        fecha_entrega: { type: String, required: true },
        cantidad_laminas: { type: Number, required: true },
        direccion_envio: { type: String, default: '', trim: true },
        estado: {
            type: String,
            enum: ['PENDIENTE', 'CORTE', 'ENCHAPE', 'REFILADA', 'ZUNCHADA', 'LISTO', 'ENTREGADO', 'CANCELADO'],
            default: 'PENDIENTE',
        },
    },
    {
        timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' },
    }
);

pedidoSchema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
        ret.id = ret._id.toString();
        if (ret.usuario_id && ret.usuario_id.toString) ret.usuario_id = ret.usuario_id.toString();
        if (ret.lamina_id && ret.lamina_id.toString) ret.lamina_id = ret.lamina_id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Pedido', pedidoSchema);
