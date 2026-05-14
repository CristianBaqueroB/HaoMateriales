import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../lib/api.js';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [materiales, setMateriales] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [ventasCargando, setVentasCargando] = useState(false);
  const [ventasError, setVentasError] = useState('');
  const [filtroPedido, setFiltroPedido] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [usuariosError, setUsuariosError] = useState('');
  const [usuariosCargando, setUsuariosCargando] = useState(false);
  const [tab, setTab] = useState('laminas'); // 'laminas' | 'usuarios' | 'ventas'
  
  const [nuevoMaterial, setNuevoMaterial] = useState({
    codigo: '', nombre: '', descripcion: '', stock: 0, precio: 0
  });
  
  const [editingMaterial, setEditingMaterial] = useState(null); // Para el Modal
  const [mostrarForm, setMostrarForm] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    setUsuariosError('');
    setUsuariosCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/usuarios`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        navigate('/login');
        return;
      }

      if (!res.ok) {
        setUsuarios([]);
        setUsuariosError(data?.mensaje || data?.error || 'No se pudo cargar el listado de personal.');
        return;
      }

      if (Array.isArray(data)) {
        setUsuarios(data);
      } else {
        setUsuarios([]);
        setUsuariosError('El servidor devolvió un formato inesperado; no se pudo mostrar el personal.');
      }
    } catch (err) {
      console.error(err);
      setUsuarios([]);
      setUsuariosError('Error de red al consultar usuarios. ¿El backend está en http://localhost:3000?');
    } finally {
      setUsuariosCargando(false);
    }
  }, []);

  useEffect(() => {
    fetchMateriales();
    fetchUsuarios();
  }, [fetchUsuarios]);

  useEffect(() => {
    if (tab === 'usuarios') fetchUsuarios();
  }, [tab, fetchUsuarios]);

  const fetchVentas = useCallback(async () => {
    setVentasError('');
    setVentasCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/ventas`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setVentas([]);
        setVentasError(data?.mensaje || data?.error || 'No se pudo cargar historial de ventas.');
        return;
      }
      setVentas(Array.isArray(data) ? data : []);
    } catch {
      setVentas([]);
      setVentasError('Error de red al consultar ventas.');
    } finally {
      setVentasCargando(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'ventas') fetchVentas();
  }, [tab, fetchVentas]);

  const fetchMateriales = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/laminas`, {
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

  const handleGuardar = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        codigo: nuevoMaterial.codigo.trim(),
        nombre: nuevoMaterial.nombre.trim(),
        descripcion: (nuevoMaterial.descripcion || '').trim(),
        precio: Number(nuevoMaterial.precio),
        stock: Number(nuevoMaterial.stock),
      };
      const res = await fetch(`${API_BASE}/api/admin/laminas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert('¡Lámina creada!');
        setMostrarForm(false);
        setNuevoMaterial({ codigo: '', nombre: '', descripcion: '', stock: 0, precio: 0 });
        fetchMateriales();
      } else {
        let data = {};
        try {
          data = await res.json();
        } catch {
          /* vacío */
        }
        alert(data.error || data.mensaje || 'No se pudo guardar la referencia');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: editingMaterial.nombre,
        descripcion: editingMaterial.descripcion ?? '',
        precio: Number(editingMaterial.precio),
        stock: Number(editingMaterial.stock),
      };
      const res = await fetch(`${API_BASE}/api/admin/laminas/${editingMaterial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert('¡Actualizado con éxito!');
        setEditingMaterial(null);
        fetchMateriales();
      } else {
        let data = {};
        try {
          data = await res.json();
        } catch {
          /* vacío */
        }
        alert(data.error || data.mensaje || 'No se pudo actualizar');
      }
    } catch (err) {
      alert('Error al actualizar');
    }
  };

  const handleDeleteLamina = async (id) => {
    if (!window.confirm('¿Seguro que quieres borrar esta lámina del inventario? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/laminas/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        alert('Lámina eliminada correctamente');
        fetchMateriales();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || data.mensaje || 'No se pudo eliminar la lámina');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al eliminar');
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* vacío */
    }
    navigate('/login');
  };

  const ventasFiltradas = ventas.filter((v) => {
    const matchPedido = filtroPedido
      ? v.numero_pedido.toLowerCase().includes(filtroPedido.toLowerCase())
      : true;
    const matchCliente = filtroCliente
      ? v.cliente.toLowerCase().includes(filtroCliente.toLowerCase())
      : true;
    const matchEstado = filtroEstado
      ? v.estado_actual.toLowerCase().includes(filtroEstado.toLowerCase())
      : true;
    const fechaEntregaISO = v.fecha_entrega ? new Date(v.fecha_entrega).toISOString().slice(0, 10) : '';
    const matchFecha = filtroFecha ? fechaEntregaISO.startsWith(filtroFecha) : true;
    return matchPedido && matchCliente && matchEstado && matchFecha;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar con Identidad Corporativa */}
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="font-black italic text-xl tracking-tighter">HAO | ADMIN</h1>
          <div className="flex gap-2 ml-6">
            <button onClick={() => setTab('laminas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'laminas' ? 'bg-white text-red-700 shadow-md' : 'hover:bg-red-600'}`}>Inventario</button>
            <button onClick={() => setTab('usuarios')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'usuarios' ? 'bg-white text-red-700 shadow-md' : 'hover:bg-red-600'}`}>Personal</button>
            <button onClick={() => setTab('ventas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'ventas' ? 'bg-white text-red-700 shadow-md' : 'hover:bg-red-600'}`}>Historial ventas</button>
          </div>
        </div>
        <button onClick={logout} className="bg-red-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-950 transition-all">Cerrar Sesión</button>
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
                  <button type="submit" className="md:col-span-3 bg-red-700 text-white py-5 rounded-2xl font-black hover:bg-red-800 shadow-lg shadow-red-900/20 transition-all">GUARDAR EN INVENTARIO</button>
                </form>
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-black tracking-widest border-b border-slate-100">
                  <tr>
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
                        <button onClick={() => handleDeleteLamina(m.id)} className="bg-slate-100 text-red-700 px-4 py-2 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : tab === 'usuarios' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">Personal de Hao Materiales</h2>
              <button
                type="button"
                onClick={() => fetchUsuarios()}
                disabled={usuariosCargando}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {usuariosCargando ? 'Actualizando…' : 'Actualizar lista'}
              </button>
            </div>
            {usuariosError && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                {usuariosError}
              </div>
            )}
            <p className="text-slate-500 text-sm mb-4">
              Incluye cuentas creadas desde <strong>Regístrate aquí</strong> (rol &quot;usuario&quot;). Si ves la tabla vacía
              pero Compass sí tiene datos, revisá que en Compass estés en la misma base que imprime el backend al arrancar.
            </p>
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
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">Historial de ventas</h2>
              <button
                type="button"
                onClick={() => fetchVentas()}
                disabled={ventasCargando}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {ventasCargando ? 'Actualizando…' : 'Actualizar lista'}
              </button>
            </div>
            {ventasError && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                {ventasError}
              </div>
            )}
            <div className="mb-8 grid gap-4 md:grid-cols-4">
              <input
                value={filtroPedido}
                onChange={(e) => setFiltroPedido(e.target.value)}
                placeholder="Buscar pedido..."
                className="p-3 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10"
              />
              <input
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                placeholder="Buscar cliente..."
                className="p-3 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10"
              />
              <input
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                placeholder="Filtrar por estado..."
                className="p-3 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10"
              />
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="p-3 rounded-2xl border bg-slate-50 outline-none focus:ring-4 focus:ring-red-900/10"
              />
            </div>
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-slate-300 text-xs uppercase font-black tracking-widest">
                  <tr>
                    <th className="p-5">Pedido</th>
                    <th className="p-5">Cliente</th>
                    <th className="p-5">Entrega</th>
                    <th className="p-5">Estado</th>
                    <th className="p-5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventasFiltradas.map((v) => (
                    <tr key={v.numero_pedido} className="hover:bg-slate-50 transition-colors">
                      <td className="p-5">
                        <p className="font-mono text-red-700 font-bold">{v.numero_pedido}</p>
                        <p className="text-xs text-slate-500">{v.fecha_facturacion}</p>
                      </td>
                      <td className="p-5">
                        <p className="font-bold text-slate-800">{v.cliente}</p>
                        <p className="text-xs text-slate-500">{v.email}</p>
                      </td>
                      <td className="p-5 text-sm text-slate-600">
                        {v.fecha_entrega}
                        <p className="text-xs text-slate-500 mt-1">{v.tipo_entrega}</p>
                      </td>
                      <td className="p-5">
                        <span className="px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-700 uppercase">
                          {v.estado_actual}
                        </span>
                      </td>
                      <td className="p-5 font-black text-slate-900">
                        ${new Intl.NumberFormat('es-CO').format(v.total || 0)}
                      </td>
                    </tr>
                  ))}
                  {ventasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No hay ventas que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
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