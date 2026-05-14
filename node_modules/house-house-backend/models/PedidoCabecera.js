const mongoose = require('mongoose');

const RECARGO_DOMICILIO_COP = 4000;

const pedidoCabeceraSchema = new mongoose.Schema(
    {
        numero_pedido: { type: String, required: true, unique: true, index: true },
        usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        tipo_entrega: { type: String, enum: ['punto_venta', 'domicilio'], required: true },
        direccion_envio: { type: String, default: '', trim: true },
        recargo_envio: { type: Number, default: 0, min: 0 },
        fecha_facturacion: { type: String, required: true },
        fecha_entrega: { type: String, required: true },
        estado: { type: String, enum: ['activo', 'cancelado'], default: 'activo' },
    },
    {
        timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' },
    }
);

pedidoCabeceraSchema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
        ret.id = ret._id.toString();
        if (ret.usuario_id?.toString) ret.usuario_id = ret.usuario_id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('PedidoCabecera', pedidoCabeceraSchema);
module.exports.RECARGO_DOMICILIO_COP = RECARGO_DOMICILIO_COP;
