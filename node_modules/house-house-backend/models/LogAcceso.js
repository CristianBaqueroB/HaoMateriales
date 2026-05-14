const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
    {
        usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        tipo: { type: String, required: true },
        ip: String,
        user_agent: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model('LogAcceso', logSchema);
