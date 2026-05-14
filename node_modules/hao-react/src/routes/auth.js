res.json({
  message: "Bienvenido",
  token: "...",
  role: user.role, // Asegúrate de que 'user' tenga la propiedad 'role' de la base de datos
  nombre: user.nombre
});