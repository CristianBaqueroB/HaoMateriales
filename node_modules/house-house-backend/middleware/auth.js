// middleware/auth.js

/**
 * Verifica que el usuario esté logueado.
 * Útil para rutas generales de clientes.
 */
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ 
            error: "Sesión no iniciada", 
            mensaje: "Por favor, inicie sesión para continuar." 
        });
    }
    next();
};

/**
 * Verifica que el usuario esté logueado Y tenga el rol necesario.
 * @param {Array} rolesPermitidos - Ejemplo: ['administrador', 'operador']
 */
const requireRole = (rolesPermitidos) => {
    return (req, res, next) => {
        // 1. Primero verificamos si hay sesión activa
        if (!req.session.userId) {
            return res.status(401).json({ 
                error: "No autorizado", 
                mensaje: "Debe iniciar sesión primero." 
            });
        }

        // 2. Verificamos si el rol del usuario está en la lista permitida
        // Importante: req.session.rol debe ser cargado en el login
        if (!req.session.rol || !rolesPermitidos.includes(req.session.rol)) {
            return res.status(403).json({ 
                error: "Acceso prohibido", 
                mensaje: `Tu cargo de '${req.session.rol || 'Invitado'}' no tiene permiso para entrar aquí.` 
            });
        }

        // 3. Si todo está bien, adelante
        next();
    };
};

module.exports = { requireLogin, requireRole };