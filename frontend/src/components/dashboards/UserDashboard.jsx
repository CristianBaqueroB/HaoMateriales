import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE } from '../../lib/api.js';

const API = `${API_BASE}/api/usuario`;
const RECARGO_DOMICILIO_COP = 4000;
const ESTADOS_LISTOS = new Set(['ENTREGADO']);
const ESTADOS_CANCELADOS = new Set(['CANCELADO']);
const ETAPAS_PROCESO = new Set(['PENDIENTE', 'CORTE', 'ENCHAPE', 'REFILADA', 'ZUNCHADA', 'LISTO']);

function nuevaLineaId() {
  return globalThis.crypto?.randomUUID?.() ?? `ln-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatoCOP(valor) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    valor
  );
}

export default function UserDashboard() {
  const [pedidos, setPedidos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [modoForm, setModoForm] = useState('crear');
  const [editingNumero, setEditingNumero] = useState(null);

  const [carrito, setCarrito] = useState([]);
  const [codigoSeleccionado, setCodigoSeleccionado] = useState('');
  const [cantidadAgregar, setCantidadAgregar] = useState(1);

  const [tipoEntrega, setTipoEntrega] = useState('punto_venta');
  const [direccionEnvio, setDireccionEnvio] = useState('');
  const [filtroPedido, setFiltroPedido] = useState('');
  const [filtroHistorial, setFiltroHistorial] = useState('TODOS');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  const fetchPedidos = useCallback(async () => {
    const res = await fetch(`${API}/mis-pedidos`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    setPedidos(Array.isArray(data) ? data : []);
  }, []);

  const fetchCatalogo = useCallback(async () => {
    const res = await fetch(`${API}/catalogo`, { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    setCatalogo(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    let ok = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([fetchPedidos(), fetchCatalogo()]);
      } catch {
        if (ok) setError('No se pudo conectar con el servidor.');
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, [fetchPedidos, fetchCatalogo]);

  const cantidadEnCarritoPorCodigo = useMemo(() => {
    const m = new Map();
    for (const ln of carrito) {
      m.set(ln.codigo, (m.get(ln.codigo) || 0) + ln.cantidad);
    }
    return m;
  }, [carrito]);

  const stockDisponibleCatalogo = (codigo) => {
    const p = catalogo.find((c) => c.codigo === codigo);
    if (!p) return 0;
    const uso = cantidadEnCarritoPorCodigo.get(codigo) || 0;
    return Math.max(0, p.stock - uso);
  };

  const subtotalProductos = useMemo(
    () => carrito.reduce((acc, ln) => acc + ln.cantidad * ln.precio, 0),
    [carrito]
  );

  const recargoActual = tipoEntrega === 'domicilio' ? RECARGO_DOMICILIO_COP : 0;
  const totalConEnvio = subtotalProductos + recargoActual;

  const gruposPedidos = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidos) {
      if (!mapa.has(p.numero_pedido)) {
        mapa.set(p.numero_pedido, {
          numero: p.numero_pedido,
          filas: [],
        });
      }
      mapa.get(p.numero_pedido).filas.push(p);
    }
    return [...mapa.values()].map((g) => {
      const first = g.filas[0];
      const sub = g.filas.reduce(
        (a, x) => a + x.cantidad_laminas * (Number(x.precio_unitario) || 0),
        0
      );
      const rec = first.tipo_entrega === 'domicilio' ? Number(first.recargo_envio) || 0 : 0;
      const canceladoCab = first.cabecera_estado === 'cancelado';
      const algunoCancelado = g.filas.some((f) => ESTADOS_CANCELADOS.has(f.estado));
      const todosPendientes = g.filas.every((f) => f.estado === 'PENDIENTE');
      const puedeGestionar = !canceladoCab && !algunoCancelado && todosPendientes;
      const estados = g.filas.map((f) => f.estado);
      const todosCancelados = canceladoCab || estados.every((e) => ESTADOS_CANCELADOS.has(e));
      const todosListos = estados.every((e) => ESTADOS_LISTOS.has(e));
      const estadoHistorial = todosCancelados ? 'CANCELADAS' : todosListos ? 'LISTAS' : 'EN_PROCESO';

      return {
        ...g,
        subtotal: sub,
        recargo: rec,
        total: sub + rec,
        tipo_entrega: first.tipo_entrega,
        direccion: first.direccion_envio || '',
        fecha_entrega: first.fecha_entrega,
        puedeGestionar,
        estadoVista: algunoCancelado || canceladoCab ? 'CANCELADO' : first.estado,
        estadoHistorial,
      };
    });
  }, [pedidos]);

  const gruposPedidosFiltrados = useMemo(() => {
    const q = filtroPedido.trim().toLowerCase();
    const porTexto = q
      ? gruposPedidos.filter((g) => String(g.numero || '').toLowerCase().includes(q))
      : gruposPedidos;
    if (filtroHistorial === 'TODOS') return porTexto;
    return porTexto.filter((g) => g.estadoHistorial === filtroHistorial);
  }, [gruposPedidos, filtroPedido, filtroHistorial]);

  const resumenHistorial = useMemo(() => {
    const base = { TODAS: gruposPedidos.length, LISTAS: 0, EN_PROCESO: 0, CANCELADAS: 0 };
    for (const g of gruposPedidos) {
      if (g.estadoHistorial === 'LISTAS') base.LISTAS += 1;
      else if (g.estadoHistorial === 'CANCELADAS') base.CANCELADAS += 1;
      else base.EN_PROCESO += 1;
    }
    return base;
  }, [gruposPedidos]);

  const resetFormCrear = () => {
    setModoForm('crear');
    setEditingNumero(null);
    setDireccionEnvio('');
    setTipoEntrega('punto_venta');
    setCarrito([]);
    setCantidadAgregar(1);
    setError('');
  };

  const abrirNuevoPedido = () => {
    resetFormCrear();
    setShowForm(true);
    if (catalogo.length && !codigoSeleccionado) {
      setCodigoSeleccionado(catalogo[0].codigo);
    }
  };

  const abrirEditarGrupo = async (numero) => {
    setError('');
    try {
      const res = await fetch(`${API}/pedidos/grupo/${encodeURIComponent(numero)}`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cargar el pedido.');
        return;
      }
      if (!data.puede_editar) {
        setError('Este pedido ya no se puede editar.');
        return;
      }
      setModoForm('editar');
      setEditingNumero(numero);
      setTipoEntrega(data.tipo_entrega || 'punto_venta');
      setDireccionEnvio(data.direccion_envio || '');
      setCarrito(
        (data.items || []).map((it) => ({
          id: nuevaLineaId(),
          codigo: it.codigo_lamina,
          nombre: it.nombre,
          precio: Number(it.precio) || 0,
          cantidad: it.cantidad_laminas,
        }))
      );
      setShowForm(true);
    } catch {
      setError('Error de conexión al cargar el pedido.');
    }
  };

  const cancelarGrupo = async (numero) => {
    if (!window.confirm('¿Cancelar este pedido? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`${API}/pedidos/grupo/${encodeURIComponent(numero)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await fetchPedidos();
        alert(data.mensaje || 'Pedido cancelado.');
      } else {
        alert(data.error || 'No se pudo cancelar.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  const agregarAlCarrito = (e) => {
    e.preventDefault();
    setError('');
    const prod = catalogo.find((c) => c.codigo === codigoSeleccionado);
    const n = Number(cantidadAgregar);
    if (!prod) {
      setError('Elegí un producto válido.');
      return;
    }
    if (!Number.isFinite(n) || n < 1) {
      setError('La cantidad debe ser al menos 1.');
      return;
    }
    const disp = stockDisponibleCatalogo(prod.codigo);
    if (n > disp) {
      setError(`Stock insuficiente para este producto. Podés sumar hasta ${disp} unidad(es).`);
      return;
    }

    const existenteIdx = carrito.findIndex((ln) => ln.codigo === prod.codigo);
    if (existenteIdx >= 0) {
      setCarrito((prev) =>
        prev.map((ln, i) => (i === existenteIdx ? { ...ln, cantidad: ln.cantidad + n } : ln))
      );
    } else {
      setCarrito((prev) => [
        ...prev,
        {
          id: nuevaLineaId(),
          codigo: prod.codigo,
          nombre: prod.nombre,
          precio: Number(prod.precio) || 0,
          cantidad: n,
        },
      ]);
    }
    setCantidadAgregar(1);
  };

  const actualizarCantidadLinea = (id, nueva) => {
    setError('');
    const val = Number(nueva);
    if (!Number.isFinite(val) || val < 1) return;
    const linea = carrito.find((l) => l.id === id);
    if (!linea) return;
    const prod = catalogo.find((c) => c.codigo === linea.codigo);
    if (!prod) return;

    const otras = cantidadEnCarritoPorCodigo.get(linea.codigo) - linea.cantidad;
    const maxPermitido = Math.max(0, prod.stock - otras);
    const q = Math.min(val, maxPermitido);
    if (q < 1) return;
    if (val > maxPermitido) {
      setError(`Máximo ${maxPermitido} por stock para "${linea.nombre}".`);
    }
    setCarrito((prev) => prev.map((ln) => (ln.id === id ? { ...ln, cantidad: q } : ln)));
  };

  const quitarLinea = (id) => {
    setCarrito((prev) => prev.filter((ln) => ln.id !== id));
    setError('');
  };

  const vaciarCarrito = () => {
    setCarrito([]);
    setError('');
  };

  const confirmarPedido = async (e) => {
    e.preventDefault();
    setError('');

    if (carrito.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }
    if (tipoEntrega === 'domicilio' && direccionEnvio.trim().length < 8) {
      setError('Para envío a domicilio escribí una dirección completa (mín. 8 caracteres).');
      return;
    }

    const payload = {
      tipo_entrega: tipoEntrega,
      direccion_envio: tipoEntrega === 'domicilio' ? direccionEnvio.trim() : '',
      items: carrito.map((ln) => ({
        codigo_lamina: ln.codigo,
        cantidad_laminas: ln.cantidad,
      })),
    };

    setConfirmando(true);
    try {
      let res;
      if (modoForm === 'editar' && editingNumero) {
        res = await fetch(`${API}/pedidos/grupo/${encodeURIComponent(editingNumero)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API}/pedidos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.mensaje || (modoForm === 'editar' ? 'Pedido actualizado.' : 'Pedido registrado.'));
        setShowForm(false);
        resetFormCrear();
        await fetchPedidos();
      } else {
        setError(data.error || data.mensaje || 'No se pudo guardar.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setConfirmando(false);
    }
  };

  const cerrarModal = () => {
    setShowForm(false);
    resetFormCrear();
    setError('');
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
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg">
        <h1 className="font-bold text-xl italic tracking-tighter">HAO MATERIALES</h1>
        <button
          type="button"
          onClick={logout}
          className="text-sm font-medium border-b border-white/50"
        >
          Salir
        </button>
      </nav>
      <main className="p-8">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-5xl mx-auto border-t-8 border-red-700">
          <h2 className="text-2xl font-bold text-slate-800">Mis Pedidos</h2>
          <p className="text-slate-500 mb-4 text-sm">
            Armá tu carrito, elegí recogida o domicilio, y gestioná pedidos pendientes.
          </p>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">Historial de pedidos</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Revisa tus pedidos anteriores, filtra por estado y edita o cancela los que aún estén pendientes.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white p-4 border border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-400">Total pedidos</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{resumenHistorial.TODAS}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 border border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-400">En proceso</p>
                <p className="mt-2 text-2xl font-black text-amber-900">{resumenHistorial.EN_PROCESO}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 border border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-400">Listas / canceladas</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{resumenHistorial.LISTAS + resumenHistorial.CANCELADAS}</p>
              </div>
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-black text-slate-800">Productos disponibles para compra</h3>
              <span className="text-xs text-slate-500">
                {catalogo.length} referencia(s) activa(s)
              </span>
            </div>
            {catalogo.length === 0 ? (
              <p className="text-sm text-slate-500">No hay productos cargados en catálogo.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {catalogo.map((item) => (
                  <article key={item.codigo} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="font-bold text-slate-800">{item.nombre}</p>
                    <p className="text-xs text-red-700 font-mono mt-1">{item.codigo}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="font-black text-slate-900">{formatoCOP(Number(item.precio) || 0)}</span>
                      <span className="text-slate-500">Stock: {item.stock}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {loading ? (
            <p className="text-slate-500 text-center py-10">Cargando…</p>
          ) : gruposPedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">
              <p className="text-slate-400">Aún no tienes pedidos registrados.</p>
              <button
                type="button"
                onClick={abrirNuevoPedido}
                className="mt-4 bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-red-900/20 hover:bg-red-800 transition-colors"
              >
                Hacer primer pedido
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <input
                    type="text"
                    value={filtroPedido}
                    onChange={(e) => setFiltroPedido(e.target.value)}
                    placeholder="Filtrar por ID de pedido (ej: HAO-...)"
                    className="w-full sm:w-80 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <select
                    value={filtroHistorial}
                    onChange={(e) => setFiltroHistorial(e.target.value)}
                    className="w-full sm:w-56 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <option value="TODOS">Todas ({resumenHistorial.TODAS})</option>
                    <option value="EN_PROCESO">En proceso ({resumenHistorial.EN_PROCESO})</option>
                    <option value="LISTAS">Listas ({resumenHistorial.LISTAS})</option>
                    <option value="CANCELADAS">Canceladas ({resumenHistorial.CANCELADAS})</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={abrirNuevoPedido}
                  className="bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-red-900/20 hover:bg-red-800 transition-colors"
                >
                  Nuevo pedido
                </button>
              </div>

              <div className="space-y-6">
                {gruposPedidosFiltrados.map((g) => (
                  <div
                    key={g.numero}
                    className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-50 border-b border-slate-100">
                      <div>
                        <p className="font-mono text-red-900 font-black text-lg">{g.numero}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Entrega: <span className="font-semibold text-slate-700">{g.fecha_entrega}</span>
                          {' · '}
                          {g.tipo_entrega === 'domicilio' ? (
                            <span className="text-red-700 font-bold">Envío a domicilio</span>
                          ) : (
                            <span className="font-semibold text-slate-700">Retiro en punto de venta</span>
                          )}
                        </p>
                        {g.tipo_entrega === 'domicilio' && g.direccion ? (
                          <p className="text-xs text-slate-600 mt-1 max-w-xl">
                            📍 {g.direccion}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase font-bold text-slate-400">Total del pedido</p>
                        <p className="mt-1">
                          <span
                            className={`px-2 py-1 rounded text-[11px] font-black ${
                              g.estadoHistorial === 'CANCELADAS'
                                ? 'bg-slate-200 text-slate-700'
                                : g.estadoHistorial === 'LISTAS'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {g.estadoHistorial === 'LISTAS'
                              ? 'LISTAS'
                              : g.estadoHistorial === 'CANCELADAS'
                                ? 'CANCELADAS'
                                : 'EN PROCESO'}
                          </span>
                        </p>
                        <p className="text-2xl font-black text-slate-900">{formatoCOP(g.total)}</p>
                        {g.recargo > 0 ? (
                          <p className="text-[11px] text-slate-500">
                            Productos {formatoCOP(g.subtotal)} + envío {formatoCOP(g.recargo)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500">Solo productos</p>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white text-slate-500 uppercase text-xs font-bold border-b border-slate-100">
                          <tr>
                            <th className="p-4">Producto</th>
                            <th className="p-4">Cantidad</th>
                            <th className="p-4">Estado línea</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {g.filas.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/80">
                              <td className="p-4">
                                <span className="font-semibold">{p.producto}</span>
                                <span className="ml-2 font-mono text-xs text-red-700">{p.codigo}</span>
                              </td>
                              <td className="p-4">{p.cantidad_laminas}</td>
                              <td className="p-4">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-black ${
                                    ESTADOS_CANCELADOS.has(p.estado)
                                      ? 'bg-slate-200 text-slate-700'
                                      : ETAPAS_PROCESO.has(p.estado)
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-emerald-100 text-emerald-900'
                                  }`}
                                >
                                  {p.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {g.puedeGestionar ? (
                      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => abrirEditarGrupo(g.numero)}
                          className="px-5 py-2 rounded-xl font-bold bg-white border-2 border-slate-200 text-slate-800 hover:border-red-300 hover:text-red-800"
                        >
                          Editar pedido
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelarGrupo(g.numero)}
                          className="px-5 py-2 rounded-xl font-bold bg-slate-200 text-slate-800 hover:bg-red-100 hover:text-red-900"
                        >
                          Cancelar pedido
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex justify-end gap-4">
                        {g.estadoVista === 'CANCELADO' ? (
                          <span>Este pedido fue cancelado.</span>
                        ) : (
                          <span>
                            Este pedido ya está en proceso. Para cambios comunicate con Hao Materiales.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {gruposPedidosFiltrados.length === 0 && (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500">
                    No hay pedidos que coincidan con ese ID.
                  </div>
                )}
              </div>
            </div>
          )}

          {showForm && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-200 my-8">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      {modoForm === 'editar' ? 'Editar pedido' : 'Nuevo pedido — carrito'}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      Elegí retiro gratis o envío con recargo fijo antes de confirmar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="text-slate-400 hover:text-slate-700 text-2xl leading-none px-2"
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                </div>

                <div className="p-6 grid lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                        Tipo de entrega
                      </legend>
                      <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-red-400 has-[:checked]:ring-2 has-[:checked]:ring-red-100">
                        <input
                          type="radio"
                          name="tipoEntrega"
                          checked={tipoEntrega === 'punto_venta'}
                          onChange={() => {
                            setTipoEntrega('punto_venta');
                            setDireccionEnvio('');
                          }}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-bold text-slate-800">Retiro en punto de venta</span>
                          <span className="block text-xs text-slate-500 mt-1">Sin costo de envío.</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 has-[:checked]:border-red-400 has-[:checked]:ring-2 has-[:checked]:ring-red-100">
                        <input
                          type="radio"
                          name="tipoEntrega"
                          checked={tipoEntrega === 'domicilio'}
                          onChange={() => setTipoEntrega('domicilio')}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-bold text-slate-800">Envío a domicilio</span>
                          <span className="block text-xs text-slate-500 mt-1">
                            Costo adicional fijo <strong>{formatoCOP(RECARGO_DOMICILIO_COP)}</strong>.
                          </span>
                        </span>
                      </label>
                    </fieldset>

                    {tipoEntrega === 'domicilio' ? (
                      <div>
                        <label className="text-xs font-black uppercase text-slate-400 tracking-wider block mb-2">
                          Dirección de envío
                        </label>
                        <textarea
                          value={direccionEnvio}
                          onChange={(e) => setDireccionEnvio(e.target.value)}
                          rows={3}
                          placeholder="Calle, número, barrio, ciudad, referencia…"
                          className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-red-600 text-sm resize-y min-h-[88px]"
                        />
                      </div>
                    ) : null}

                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Agregar al carrito</h4>
                      {catalogo.length === 0 ? (
                        <p className="text-amber-700 text-sm">
                          No hay productos en catálogo. Un administrador debe cargar el inventario primero.
                        </p>
                      ) : (
                        <form onSubmit={agregarAlCarrito} className="space-y-3">
                          <select
                            value={codigoSeleccionado}
                            onChange={(e) => setCodigoSeleccionado(e.target.value)}
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-red-600"
                            disabled={!catalogo.length}
                          >
                            {catalogo.map((c) => (
                              <option key={c.codigo} value={c.codigo}>
                                {c.codigo} — {c.nombre} (disponible {stockDisponibleCatalogo(c.codigo)})
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              value={cantidadAgregar}
                              onChange={(e) => setCantidadAgregar(e.target.value)}
                              className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-red-600"
                            />
                            <button
                              type="submit"
                              disabled={!catalogo.length}
                              className="px-5 py-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40"
                            >
                              Agregar
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                        Tu carrito
                      </h4>
                      {carrito.length > 0 && (
                        <button
                          type="button"
                          onClick={vaciarCarrito}
                          className="text-xs font-bold text-red-700 hover:underline"
                        >
                          Vaciar
                        </button>
                      )}
                    </div>

                    {carrito.length === 0 ? (
                      <p className="text-slate-400 text-sm py-6 text-center">El carrito está vacío.</p>
                    ) : (
                      <ul className="space-y-3 max-h-48 overflow-y-auto pr-1">
                        {carrito.map((ln) => (
                          <li
                            key={ln.id}
                            className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="font-bold text-slate-800 text-sm">{ln.nombre}</span>
                              <button
                                type="button"
                                onClick={() => quitarLinea(ln.id)}
                                className="text-xs text-red-600 font-bold shrink-0 hover:underline"
                              >
                                Quitar
                              </button>
                            </div>
                            <p className="text-xs font-mono text-red-900 mt-0.5">{ln.codigo}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <label className="text-xs text-slate-500">Cant.</label>
                              <input
                                type="number"
                                min={1}
                                value={ln.cantidad}
                                onChange={(e) => actualizarCantidadLinea(ln.id, e.target.value)}
                                className="w-16 p-2 rounded-lg border border-slate-200 text-sm"
                              />
                              <span className="text-xs text-slate-500 ml-auto">
                                {formatoCOP(ln.precio * ln.cantidad)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Subtotal productos</span>
                        <span className="font-semibold">{formatoCOP(subtotalProductos)}</span>
                      </div>
                      {tipoEntrega === 'domicilio' ? (
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Envío a domicilio (fijo)</span>
                          <span className="font-semibold text-red-900">{formatoCOP(recargoActual)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                        <span className="text-sm font-black uppercase text-slate-500">Total a pagar</span>
                        <span className="text-xl font-black text-red-800">{formatoCOP(totalConEnvio)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        La entrega puede ajustarse según cupo diario del taller.
                      </p>
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="px-6 pb-2">
                    <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>
                  </div>
                ) : null}

                <div className="p-6 pt-2 flex flex-col sm:flex-row gap-3 justify-end border-t border-slate-100 rounded-b-3xl">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="py-3 px-6 rounded-xl font-bold text-slate-500 hover:bg-slate-100 order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarPedido}
                    disabled={confirmando || !catalogo.length || carrito.length === 0}
                    className="py-3 px-8 rounded-xl font-black bg-red-700 text-white hover:bg-red-800 disabled:opacity-45 order-1 sm:order-2 shadow-lg shadow-red-900/15"
                  >
                    {confirmando
                      ? 'Guardando…'
                      : modoForm === 'editar'
                        ? 'Guardar cambios'
                        : 'Confirmar pedido'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
