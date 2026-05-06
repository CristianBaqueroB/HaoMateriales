import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Registro() {
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegistro = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...formData, telefono: '', direccion: '' }),
      });

      if (response.ok) {
        alert('Registro exitoso. Ahora puedes iniciar sesión.');
        navigate('/login');
      } else {
        let data = {};
        try {
          data = await response.json();
        } catch {
          /* 404/HTML u otra respuesta no JSON */
        }
        setError(data.error || data.message || data.mensaje || 'Error al registrar');
      }
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
            <input type="text" placeholder="Nombre Completo" required className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-600"
              onChange={(e) => setFormData({...formData, nombre: e.target.value})} />
            <input type="email" placeholder="Correo Electrónico" required className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-600"
              onChange={(e) => setFormData({...formData, email: e.target.value})} />
            <input type="password" placeholder="Contraseña" required className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-red-600"
              onChange={(e) => setFormData({...formData, password: e.target.value})} />
            <button type="submit" className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-xl transition-all">REGISTRARSE</button>
          </form>
          <p className="text-center mt-6 text-sm">¿Ya tienes cuenta? <Link to="/login" className="text-red-700 font-bold">Inicia Sesión</Link></p>
        </div>
      </div>
    </div>
  );
}