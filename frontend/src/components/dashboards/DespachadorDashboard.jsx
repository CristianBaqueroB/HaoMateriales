import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../lib/api.js';

const API = `${API_BASE}/api/despachador`;

/** @typedef {{ id: string, cliente?: string, producto?: string, cantidad_laminas: number, fecha_entrega: string, numero_pedido: string, tipo_entrega: 'domicilio' | 'punto_venta', direccion_envio?: string }} PedidoLin */

/** @typedef {{ action: 'iniciar' | 'entregar', pedido: PedidoLin }} ModalState */

function BadgeTipoEntrega({ tipo }) {
  if (tipo === 'domicilio') {
    return (
      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-1 rounded-md">
        Envío domicilio
      </span>
    );
  }
  return (
    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 px-2 py-1 rounded-md">
      Punto de venta
    </span>
  );
}

/**
 * Confirmación antes de acciones sensibles (taller / entrega), con observación opcional en el mismo diálogo.
 */
function ModalConfirmacion({
  abierto,
  titulo,
  descripcion,
  etiquetaPrincipal,
  observacion,
  onObservacionChange,
  onCerrar,
  onConfirmar,
  ocupado,
}) {
  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-despacho-titulo"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 id="confirm-despacho-titulo" className="text-lg font-black text-slate-900">
            {titulo}
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{descripcion}</p>
        </div>
        <div className="p-6 space-y-3">
          <label htmlFor="obs-despacho" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Observación (opcional)
          </label>
          <textarea
            id="obs-despacho"
            rows={3}
            value={observacion}
            onChange={(e) => onObservacionChange(e.target.value)}
            placeholder="Ej.: contacto no atiende, entregar solo en horario PM…"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-600/20 focus:border-red-700 outline-none resize-y min-h-[88px]"
          />
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            disabled={ocupado}
            onClick={onCerrar}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={onConfirmar}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 shadow-md"
          >
            {ocupado ? 'Procesando…' : etiquetaPrincipal}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListaPedidos({ titulo, vacio, subtitulo, children }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
      <div className="mb-4">
        <h2 className="font-black text-slate-900">{titulo}</h2>
        {subtitulo && <p className="text-xs text-slate-500 mt-1">{subtitulo}</p>}
      </div>
      {children?.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-8 text-center">{vacio}</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

export default function DespachadorDashboard() {
  /** @type {[PedidoLin[], React.Dispatch<React.SetStateAction<PedidoLin[]>>]} */
  const [pendientes, setPendientes] = useState([]);
  /** @type {[PedidoLin[], React.Dispatch<React.SetStateAction<PedidoLin[]>>]} */
  const [listos, setListos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  /** @type {[ModalState | null, React.Dispatch<React.SetStateAction<ModalState | null>>]} */
  const [modal, setModal] = useState(null);
  const [observacion, setObservacion] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    setCargando(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/pendientes`, { credentials: 'include' }),
        fetch(`${API}/listos`, { credentials: 'include' }),
      ]);
      if (r1.status === 401 || r2.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!r1.ok) {
        const d = await r1.json().catch(() => ({}));
        throw new Error(d.error || 'No se pudieron cargar los pendientes.');
      }
      if (!r2.ok) {
        const d = await r2.json().catch(() => ({}));
        throw new Error(d.error || 'No se pudieron cargar los listos.');
      }
      const d1 = await r1.json();
      const d2 = await r2.json();
      setPendientes(Array.isArray(d1.pedidos) ? d1.pedidos : []);
      setListos(Array.isArray(d2.pedidos) ? d2.pedidos : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red.');
      setPendientes([]);
      setListos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirModal = (action, pedido) => {
    setObservacion('');
    setModal({ action, pedido });
  };

  const cerrarModal = () => {
    if (ocupado) return;
    setModal(null);
    setObservacion('');
  };

  const ejecutarModal = async () => {
    if (!modal) return;
    const { action, pedido } = modal;
    const path = action === 'iniciar' ? 'iniciar' : 'entregar';
    setOcupado(true);
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id}/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ observacion: observacion.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || data.mensaje || 'No se pudo completar la acción.');
        return;
      }
      cerrarModal();
      await cargar();
    } catch {
      alert('Error de conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* sin bloque */
    }
    window.location.href = '/login';
  };

  const listosDomicilio = listos.filter((p) => p.tipo_entrega === 'domicilio');
  const listosPunto = listos.filter((p) => p.tipo_entrega !== 'domicilio');

  const textoModal =
    modal == null
      ? { titulo: '', descripcion: '', etiqueta: '' }
      : modal.action === 'iniciar'
        ? {
            titulo: '¿Enviar a taller?',
            descripcion:
              `Vas a poner la línea «${modal.pedido.producto ?? 'Producto'}» (${modal.pedido.cantidad_laminas} u.) del pedido ${modal.pedido.numero_pedido} en proceso de producción.`,
            etiqueta: 'Confirmar envío a taller',
          }
        : modal.pedido.tipo_entrega === 'domicilio'
          ? {
              titulo: '¿Confirmar envío a domicilio?',
              descripcion:
                `Marcar como entregado el despacho del pedido ${modal.pedido.numero_pedido} — cliente: ${modal.pedido.cliente ?? ''}. Dirección registrada: ${(modal.pedido.direccion_envio || '—').trim()}.`,
              etiqueta: 'Confirmar envío realizado',
            }
          : {
              titulo: '¿Confirmar entrega en punto de venta?',
              descripcion: `Registrar la entrega presencial para el pedido ${modal.pedido.numero_pedido} — cliente: ${modal.pedido.cliente ?? ''}.`,
              etiqueta: 'Confirmar retiro',
            };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <ModalConfirmacion
        abierto={modal != null}
        titulo={textoModal.titulo}
        descripcion={textoModal.descripcion}
        etiquetaPrincipal={textoModal.etiqueta}
        observacion={observacion}
        onObservacionChange={setObservacion}
        onCerrar={cerrarModal}
        onConfirmar={ejecutarModal}
        ocupado={ocupado}
      />

      <header className="bg-red-700 p-6 text-white shadow-xl flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Logística y despacho</h1>
          <p className="text-sm text-white/85 mt-1 max-w-xl">
            Envíos con domicilio y entregas en punto físico. Cada acción requiere confirmación; podés sumar una
            observación en el mismo aviso.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cargar()}
            disabled={cargando}
            className="text-xs font-bold uppercase tracking-wide bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-xs font-bold uppercase tracking-wide bg-white text-red-800 hover:bg-slate-100 px-4 py-2 rounded-lg"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-8 flex-grow space-y-8 max-w-5xl mx-auto w-full">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        )}

        {cargando ? (
          <p className="text-slate-500 text-sm py-12 text-center">Cargando bandejas…</p>
        ) : (
          <>
            <ListaPedidos
              titulo="Por validación — enviar a taller"
              subtitulo="Pedidos pendientes de despacho. Al confirmarlos pasan a producción."
              vacio="No hay líneas pendientes."
            >
              {pendientes.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 rounded-xl border-l-4 border-red-700"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900 truncate">{p.producto ?? 'Ítem'}</p>
                      <BadgeTipoEntrega tipo={p.tipo_entrega} />
                    </div>
                    <p className="text-xs text-slate-500">
                      Pedido <span className="font-mono font-semibold">{p.numero_pedido}</span> · Cliente{' '}
                      <span className="font-semibold">{p.cliente ?? '—'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.cantidad_laminas} láminas · Entrega pactada <span className="font-semibold">{p.fecha_entrega}</span>
                    </p>
                    {p.tipo_entrega === 'domicilio' && (p.direccion_envio || '').trim() && (
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="font-bold text-slate-700">Dirección:</span> {p.direccion_envio}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirModal('iniciar', p)}
                    className="shrink-0 bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-red-800"
                  >
                    Enviar a taller
                  </button>
                </div>
              ))}
            </ListaPedidos>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ListaPedidos
                titulo="Listos — envío a domicilio"
                subtitulo="Mercancía terminada para clientes que pagaron despacho."
                vacio="Nada pendiente por envío a domicilio."
              >
                {listosDomicilio.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-4 p-4 bg-amber-50/80 rounded-xl border border-amber-200/70"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <p className="font-bold text-slate-900">{p.producto ?? 'Ítem'}</p>
                        <BadgeTipoEntrega tipo="domicilio" />
                      </div>
                      <p className="text-xs text-slate-600">
                        {p.cliente ?? 'Cliente'} · {p.cantidad_laminas} u. · {p.numero_pedido}
                      </p>
                      <p className="text-xs text-slate-800">
                        <span className="font-bold">Enviar a:</span> {(p.direccion_envio || 'Sin dirección').trim()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirModal('entregar', p)}
                      className="w-full bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-amber-800"
                    >
                      Registrar envío / entrega
                    </button>
                  </div>
                ))}
              </ListaPedidos>

              <ListaPedidos
                titulo="Listos — retiro en punto"
                subtitulo="Entrega presencial en la sede (sin domicilio)."
                vacio="Nada pendiente por retiro en tienda."
              >
                {listosPunto.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-2">
                        <p className="font-bold text-slate-900">{p.producto ?? 'Ítem'}</p>
                        <BadgeTipoEntrega tipo={p.tipo_entrega} />
                      </div>
                      <p className="text-xs text-slate-600">
                        {p.cliente ?? 'Cliente'} · {p.cantidad_laminas} u. · {p.numero_pedido}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirModal('entregar', p)}
                      className="w-full bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-emerald-800"
                    >
                      Registrar retiro entregado
                    </button>
                  </div>
                ))}
              </ListaPedidos>
            </div>
          </>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          Para cerrar sesión usa el botón <strong>Salir</strong> en la parte superior.
        </p>
      </div>
    </div>
  );
}
