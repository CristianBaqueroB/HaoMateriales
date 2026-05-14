// middleware/auditoria.js
const pool = require('../config/db');

/**
 * Función para registrar eventos en la tabla de auditoría.
 */
const logAuditoria = async (usuario_id, accion, tabla, registro_id, antes, despues, ip) => {
    try {
        await pool.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, datos_antes, datos_despues, ip)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                usuario_id, 
                accion, 
                tabla, 
                registro_id, 
                antes ? JSON.stringify(antes) : null, 
                despues ? JSON.stringify(despues) : null, 
                ip
            ]
        );
    } catch (err) {
        console.error("❌ Fallo al registrar auditoría:", err.message);
    }
};

module.exports = { logAuditoria };