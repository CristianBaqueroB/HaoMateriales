import { BrowserRouter as Router, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';

// Importación de Componentes
import Registro from './components/Registro';
import AdminDashboard from './components/dashboards/AdminDashboard';
import UserDashboard from './components/dashboards/UserDashboard';
import OperadorDashboard from './components/dashboards/OperadorDashboard';
import DespachadorDashboard from './components/dashboards/DespachadorDashboard';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // 🔑 ESTA ES LA LLAVE: Permite que el navegador guarde la cookie de sesión
  credentials: 'include', 
  body: JSON.stringify({ email, password }),
});
    
    const data = await response.json();
    console.log("Datos recibidos:", data); 

    if (response.ok) {
      // Normalizamos el rol que viene del servidor (rol o role)
      const rolRecibido = (data.rol || data.role || '').toLowerCase();

      if (rolRecibido === 'admin' || rolRecibido === 'administrador') {
        navigate('/admin');
      } else if (rolRecibido === 'operador') {
        navigate('/operador');
      } else if (rolRecibido === 'despachador') {
        navigate('/despachador');
      } else if (rolRecibido === 'usuario') {
        navigate('/usuario');
      } else {
        setError(`El rol "${rolRecibido}" no tiene un dashboard asignado.`);
      }
    } else {
      setError(data.error || data.message || 'Credenciales incorrectas');
    }
  } catch (err) { 
    setError('Error de conexión con el servidor.'); 
  }
};
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div 
          className="w-full h-48 bg-cover bg-center border-b-4 border-red-900" 
          style={{ backgroundImage: "url('/logo-hao.png')" }}
        ></div>
        
        <div className="p-10">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm border-l-4 border-red-600">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Correo Institucional
              </label>
              <input 
                type="email" 
                placeholder="usuario@hao.com" 
                required 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-4 focus:ring-red-900/10 focus:border-red-700 outline-none transition-all" 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Contraseña
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-4 focus:ring-red-900/10 focus:border-red-700 outline-none transition-all" 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-red-900/20 transform active:scale-95 transition-all"
            >
              ACCEDER AL SISTEMA
            </button>
          </form>
          
          <p className="text-center mt-8 text-sm text-slate-500">
            ¿No tienes cuenta? <Link to="/registro" className="text-red-700 font-bold hover:underline">Regístrate aquí</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// COMPONENTE PRINCIPAL CON TODAS LAS RUTAS
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta de Login y Registro */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Rutas de Dashboards por Rol */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/usuario" element={<UserDashboard />} />
        <Route path="/operador" element={<OperadorDashboard />} />
        <Route path="/despachador" element={<DespachadorDashboard />} />

        {/* Redirección por defecto */}
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
}