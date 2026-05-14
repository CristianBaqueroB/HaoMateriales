import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api.js';

export default function Registro() {
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      nombre: formData.nombre.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      telefono: '',
      direccion: '',
    };
    if (payload.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.usuario?.id) {
        alert('Registro exitoso. Ya podés iniciar sesión con el mismo correo y contraseña.');
        navigate('/login');
        return;
      }

      if (response.ok && !data?.usuario?.id) {
        setError(
          'El servidor respondió sin confirmar el alta. Revisá que el backend esté conectado a MongoDB y volvé a intentar.'
        );
        return;
      }

      setError(data?.error || data?.message || data?.mensaje || 'Error al registrar');
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="w-full h-32 bg-cover bg-center border-b-4 border-red-900" style={{ backgroundImage: "url('/logo-hao.png')" }}></div>
        <div className="p-8">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Crear Cuenta</h2>
          {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <form onSubmit={handleRegistro} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre Completo"
              required
              autoComplete="name"
              value={formData.nombre}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-600"
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
            <input
              type="email"
              placeholder="Correo Electrónico"
              required
              autoComplete="email"
              value={formData.email}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-600"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Contraseña (mín. 6 caracteres)"
              required
              minLength={6}
              autoComplete="new-password"
              value={formData.password}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-600"
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button type="submit" className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-xl transition-all">REGISTRARSE</button>
          </form>
          <p className="text-center mt-6 text-sm">¿Ya tienes cuenta? <Link to="/login" className="text-red-700 font-bold">Inicia Sesión</Link></p>
        </div>
      </div>
    </div>
  );
}