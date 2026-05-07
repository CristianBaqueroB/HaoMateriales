const mongoose = require('mongoose');

const laminaSchema = new mongoose.Schema(
    {
        codigo: { type: String, unique: true, required: true, trim: true },
        nombre: { type: String, required: true },
        descripcion: { type: String, default: '' },
        stock: { type: Number, default: 0 },
        precio: { type: Number, default: 0 },
    },
    {
        timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' },
    }
);

laminaSchema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('Lamina', laminaSchema);
