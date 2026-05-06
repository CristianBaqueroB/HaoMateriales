import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [materiales, setMateriales] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tab, setTab] = useState('laminas'); // 'laminas' o 'usuarios'
  
  const [nuevoMaterial, setNuevoMaterial] = useState({
    codigo: '', nombre: '', descripcion: '', stock: 0, precio: 0
  });
  
  const [editingMaterial, setEditingMaterial] = useState(null); // Para el Modal
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => {
    fetchMateriales();
    fetchUsuarios();
  }, []);

  const fetchMateriales = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/admin/laminas', {
      // 🔑 TAMBIÉN AQUÍ: Envía la cookie guardada al servidor
      credentials: 'include' 
    });
    const data = await res.json();

    console.log("Datos de láminas recibidos:", data); // Mira esto en la consola

    if (Array.isArray(data)) {
      setMateriales(data);
    } else {
      setMateriales([]);
    }
  } catch (err) {
    console.error("Error de red:", err);
  }
};

const fetchUsuarios = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/admin/usuarios', {
      credentials: 'include' // 🔑 También aquí
    });
    const data = await res.json();
    if (Array.isArray(data)) setUsuarios(data);
  } catch (err) { console.error(err); }
};

 
  const handleGuardar = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/admin/laminas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoMaterial)
      });
      if (res.ok) {
        alert("¡Lámina creada!");
        setMostrarForm(false);
        fetchMateriales();
      }
    } catch (err) { alert("Error de conexión"); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:3000/api/admin/laminas/${editingMaterial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMaterial)
      });
      if (res.ok) {
        alert("¡Actualizado con éxito!");
        setEditingMaterial(null);
        fetchMateriales();
      }
    } catch (err) { alert("Error al actualizar"); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar con Identidad Corporativa */}
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="font-black italic text-xl tracking-tighter">HAO | ADMIN</h1>
          <div className="flex gap-2 ml-6">
            <button onClick={() => setTab('laminas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'laminas' ? 'bg-white text-red-700 shadow-md' : 'hover:bg-red-600'}`}>Inventario</button>
            <button onClick={() => setTab('usuarios')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'usuarios' ? 'bg-white text-red-700 shadow-md' : 'hover:bg-red-600'}`}>Personal</button>
          </div>
        </div>
        <button onClick={() => window.location.href='/login'} className="bg-red-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-950 transition-all">Cerrar Sesión</button>
      </nav>

      <main className="p-8 max-w-7xl mx-auto">
        
        {tab === 'laminas' ? (
          <>
            <div className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">Gestión de Láminas</h2>
                <p className="text-slate-500 font-medium mt-1">Control total de stock y precios de Hao Materiales.</p>
              </div>
              <button onClick={() => setMostrarForm(!mostrarForm)} className="bg-red-700 hover:bg-red-800 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-red-900/20 transition-all">
                {mostrarForm ? 'Cerrar Registro' : '+ Agregar Referencia'}
              </button>
            </div>

            {mostrarForm && (
              <div className="bg-white p-8 rounded-3xl shadow-2xl mb-10 border border-slate-200 animate-in fade-in slide-in-from-top-4">
                <h3 className="text-xl font-bold mb-6 text-red-700 flex items-center gap-2">
                  <span className="w-2 h-6 bg-red-700 rounded-full"></span> Nueva Referencia de Material
                </h3>
                <form onSubmit={handleGuardar} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <input type="text" placeholder="Código (LAM-XXX)" required className="p-4 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10 focus:border-red-700 transition-all"
                    onChange={(e) => setNuevoMaterial({...nuevoMaterial, codigo: e.target.value})} />
                  <input type="text" placeholder="Nombre" required className="p-4 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10 focus:border-red-700 transition-all"
                    onChange={(e) => setNuevoMaterial({...nuevoMaterial, nombre: e.target.value})} />
                  <input type="number" placeholder="Precio de Venta ($)" required className="p-4 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10 focus:border-red-700 transition-all"
                    onChange={(e) => setNuevoMaterial({...nuevoMaterial, precio: e.target.value})} />
                  <input type="number" placeholder="Stock Inicial" required className="p-4 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10 focus:border-red-700 transition-all"
                    onChange={(e) => setNuevoMaterial({...nuevoMaterial, stock: e.target.value})} />
                  <textarea placeholder="Descripción detallada" className="p-4 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10 focus:border-red-700 transition-all md:col-span-2"
                    onChange={(e) => setNuevoMaterial({...nuevoMaterial, descripcion: e.target.value})} />
                  <button type="submit" className="md:col-span-3 bg-red-700 text-white py-5 rounded-2xl font-black hover:bg-red-800 shadow-lg shadow-red-900/20 transition-all">REGISTRAR EN POSTGRESQL</button>
                </form>
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-black tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="p-6">ID</th>
                    <th className="p-6">Referencia</th>
                    <th className="p-6">Nombre</th>
                    <th className="p-6 text-center">Stock Disponible</th>
                    <th className="p-6">Precio</th>
                    <th className="p-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materiales.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-6 font-bold text-slate-300">#{m.id}</td>
                      <td className="p-6 font-mono text-sm text-red-700 font-bold">{m.codigo}</td>
                      <td className="p-6 font-bold text-slate-700">{m.nombre}</td>
                      <td className="p-6 text-center">
                        <span className={`px-4 py-2 rounded-xl text-xs font-black ${m.stock < 10 ? 'bg-red-100 text-red-700 ring-1 ring-red-200' : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'}`}>
                          {m.stock} UNID
                        </span>
                      </td>
                      <td className="p-6 font-black text-slate-800">${new Intl.NumberFormat('es-CO').format(m.precio)}</td>
                      <td className="p-6 text-right">
                        <button onClick={() => setEditingMaterial(m)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-600 hover:text-white transition-all mr-2">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* VISTA DE PERSONAL / USUARIOS */
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-8">Personal de Hao Materiales</h2>
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase font-black tracking-widest">
                  <tr>
                    <th className="p-6">Nombre del Empleado</th>
                    <th className="p-6">Correo</th>
                    <th className="p-6">Rol de Acceso</th>
                    <th className="p-6">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-6 font-bold text-slate-800">{u.nombre}</td>
                      <td className="p-6 text-slate-500 font-medium">{u.email}</td>
                      <td className="p-6">
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold uppercase">{u.rol}</span>
                      </td>
                      <td className="p-6 text-slate-400 text-sm">{new Date(u.creado_en).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE EDICIÓN RÁPIDA */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Editar Material</h3>
            <p className="text-slate-500 mb-8 font-medium">Actualizando: {editingMaterial.nombre}</p>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1">Precio Unitario ($)</label>
                <input type="number" value={editingMaterial.precio} className="w-full p-4 mt-2 rounded-2xl border bg-slate-50 outline-none focus:border-red-700"
                  onChange={(e) => setEditingMaterial({...editingMaterial, precio: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-black uppercase text-slate-400 ml-1">Stock Actual (Manual)</label>
                <input type="number" value={editingMaterial.stock} className="w-full p-4 mt-2 rounded-2xl border bg-slate-50 outline-none focus:border-red-700"
                  onChange={(e) => setEditingMaterial({...editingMaterial, stock: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingMaterial(null)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
                <button type="submit" className="flex-1 bg-red-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-900/20 hover:bg-red-800">GUARDAR CAMBIOS</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}