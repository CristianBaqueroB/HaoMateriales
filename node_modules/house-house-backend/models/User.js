const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        nombre: { type: String, required: true },
        email: { type: String, unique: true, required: true, lowercase: true, trim: true },
        password_hash: { type: String, required: true },
        telefono: { type: String, default: '' },
        direccion: { type: String, default: '' },
        activo: { type: Boolean, default: true },
        rol: {
            type: String,
            enum: ['usuario', 'operador', 'despachador', 'administrador'],
            default: 'usuario',
        },
    },
    {
        timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' },
    }
);

userSchema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

module.exports = mongoose.model('User', userSchema);
