import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/api.js';


const API = `${API_BASE}/api/operador`;
// Estas constantes están bien aquí afuera porque son valores fijos
const LIMITE_DIARIO = 30;
const FLUJO = ['CORTE', 'ENCHAPE', 'REFILADA', 'ZUNCHADA', 'LISTO'];
const ETAPAS_OPERADOR = [
  {
    etapa: 'Corte',
    descripcion: 'Dimensionar la lámina según plano y orden de producción, validando medidas antes de liberar la pieza.',
    epp: ['Guantes anticorte', 'Gafas de seguridad', 'Protección auditiva', 'Botas de seguridad'],
    calidad: [
      'Medidas exactas (largo, ancho y escuadra).',
      'Sin astillado visible en bordes de corte.',
      'Código/material correcto según la orden.',
    ],
  },
  {
    etapa: 'Enchape',
    descripcion: 'Aplicar canto al borde de la pieza con temperatura y presión adecuadas para asegurar adherencia uniforme.',
    epp: ['Guantes térmicos ligeros', 'Gafas de seguridad', 'Mascarilla para polvo fino', 'Botas de seguridad'],
    calidad: [
      'Canto continuo sin zonas levantadas.',
      'Color y referencia del canto coinciden con la pieza.',
      'Sin exceso de adhesivo visible.',
    ],
  },
  {
    etapa: 'Refilada',
    descripcion: 'Recortar excedentes del enchape y perfilar bordes para dejar acabado limpio y al ras.',
    epp: ['Gafas de seguridad', 'Protección auditiva', 'Guantes de agarre', 'Botas de seguridad'],
    calidad: [
      'Borde al ras, sin rebabas ni escalones.',
      'Sin quemaduras por fricción en el canto.',
      'Esquinas uniformes y sin golpes.',
    ],
  },
  {
    etapa: 'Zunchada',
    descripcion: 'Agrupar y asegurar piezas terminadas para evitar desplazamiento o daño durante manipulación interna y despacho.',
    epp: ['Guantes de protección mecánica', 'Gafas de seguridad', 'Botas de seguridad'],
    calidad: [
      'Zuncho firme sin deformar la lámina.',
      'Protección de cantos en puntos de presión.',
      'Etiquetado y trazabilidad del pedido visibles.',
    ],
  },
  {
    etapa: 'Entrega',
    descripcion: 'Verificar cantidad y estado final antes de transferir el pedido al área de despacho o retiro.',
    epp: ['Guantes de manipulación', 'Botas de seguridad', 'Chaleco reflectivo en zona de cargue'],
    calidad: [
      'Cantidad entregada coincide con la orden.',
      'Piezas sin rayones, golpes o humedad.',
      'Pedido marcado como completo y listo para cliente.',
    ],
  },
];

function nextEstado(estado) {
  const i = FLUJO.indexOf(estado);
  if (i < 0 || i >= FLUJO.length - 1) return null;
  return FLUJO[i + 1];
}

function etiquetaEstado(estado) {
  switch (estado) {
    case 'CORTE':
      return 'Corte';
    case 'ENCHAPE':
      return 'Enchape';
    case 'REFILADA':
      return 'Refilada';
    case 'ZUNCHADA':
      return 'Zunchada';
    case 'LISTO':
      return 'Listo (enviar a despacho)';
    default:
      return estado;
  }
}

function colorEstado(estado) {
  switch (estado) {
    case 'CORTE':
      return 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/20';
    case 'ENCHAPE':
      return 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/20';
    case 'REFILADA':
      return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/20';
    case 'ZUNCHADA':
      return 'bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/20';
    case 'LISTO':
      return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/20';
    default:
      return 'bg-white/10 text-white/80 ring-1 ring-white/10';
  }
}
export default function OperadorDashboard() {
  // --- LOS HOOKS SIEMPRE DEBEN IR AQUÍ ADENTRO ---
  const [cola, setCola] = useState([]);
  const [totalLaminasHoy, setTotalLaminasHoy] = useState(0); // Movido adentro
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ocupadoId, setOcupadoId] = useState(null);

  const cargar = useCallback(async () => {
    setError('');
    setCargando(true);
    try {
      const res = await fetch(`${API}/pedidos`, { credentials: 'include' });
      const data = await res.json().catch(() => null);
      
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      
      if (!res.ok) {
        setCola([]);
        setError(data?.error || data?.mensaje || 'No se pudo cargar la cola.');
        return;
      }

      const lista = Array.isArray(data?.cola) ? data.cola : [];
      setCola(lista);

      // Cálculo de láminas trabajadas (las que ya no están en CORTE)
      const total = lista.reduce((acc, p) => {
  // Solo sumamos los pedidos que ya están en ENCHAPE, REFILADA, ZUNCHADA o LISTO
  const estaEnProceso = p.estado !== 'CORTE';
  return estaEnProceso ? acc + (Number(p.cantidad_laminas) || 0) : acc;
}, 0);
      setTotalLaminasHoy(total);

    } catch (err) {
      setCola([]);
      setError('Error de red. ¿El backend está corriendo?');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const it of cola) {
      const k = it.estado || 'OTRO';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
    const estadosOrden = [...FLUJO, ...[...map.keys()].filter((e) => !FLUJO.includes(e))];
    return estadosOrden
      .filter((e) => map.has(e))
      .map((e) => ({ estado: e, items: map.get(e) }));
  }, [cola]);

  const avanzar = async (pedido) => {
    const siguiente = nextEstado(pedido.estado);
    if (!siguiente) return;

    const ok = window.confirm(
      `¿Mover a "${siguiente}"?\n\nPedido de ${pedido.cliente || 'cliente'} · ${pedido.lamina || 'lámina'} · ${pedido.cantidad_laminas} u.`
    );
    if (!ok) return;

    setOcupadoId(pedido.id);
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id}/avanzar`, {
        method: 'PUT',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.mensaje || data?.error || 'No se pudo avanzar el proceso.');
        return;
      }
      await cargar();
    } catch {
      alert('Error de red al avanzar el proceso.');
    } finally {
      setOcupadoId(null);
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
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-red-800 p-4 flex justify-between items-center">
        <div>
          <h1 className="font-black tracking-tight">CONTROL DE TALLER</h1>
         
<div className="mt-4 bg-slate-700 p-3 rounded-xl border border-white/10">
  <div className="flex justify-between text-xs mb-1">
    <span>Producción diaria: <strong>{totalLaminasHoy} / {LIMITE_DIARIO}</strong> láminas</span>
    <span>{Math.round((totalLaminasHoy/LIMITE_DIARIO)*100)}%</span>
  </div>
  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
    <div 
      className={`h-full transition-all ${totalLaminasHoy >= LIMITE_DIARIO ? 'bg-red-500' : 'bg-emerald-500'}`}
      style={{ width: `${Math.min((totalLaminasHoy / LIMITE_DIARIO) * 100, 100)}%` }}
    />
  </div>
  {totalLaminasHoy >= LIMITE_DIARIO && (
    <p className="text-[10px] text-red-400 mt-2 font-bold uppercase italic">
      ⚠️ Capacidad máxima alcanzada. Los nuevos pedidos quedarán para el próximo turno.
    </p>
  )}
</div>
          <p className="text-xs text-white/80 mt-1">
            Avanzá las láminas por proceso. Cuando quede <strong>LISTO</strong>, pasará a despacho.
          </p>
        </div>
        
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="text-xs font-bold uppercase bg-white/10 hover:bg-white/15 px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {cargando ? 'Cargando…' : 'Actualizar'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-xs font-bold uppercase bg-white text-red-900 hover:bg-slate-100 px-4 py-2 rounded-xl"
          >
            Salir
          </button>
        </div>
      </nav>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-red-400 font-black">Cola de producción</h3>
            <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/70">
              Activos: {cola.length}
            </span>
          </div>

          {error && <div className="mb-4 text-sm text-amber-200 bg-amber-500/10 ring-1 ring-amber-500/20 p-3 rounded-xl">{error}</div>}

          {cargando ? (
            <p className="text-sm text-white/70 py-10 text-center">Cargando trabajos…</p>
          ) : cola.length === 0 ? (
            <p className="text-sm text-white/70 py-10 text-center">
              No hay trabajos activos. Los pedidos aparecen aquí cuando despacho los autoriza (pasan de PENDIENTE a CORTE).
            </p>
          ) : (
            <div className="space-y-5">
              {grupos.map((g) => (
                <div key={g.estado} className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-lg text-xs font-black ${colorEstado(g.estado)}`}>
                        {etiquetaEstado(g.estado)}
                      </span>
                      <span className="text-xs text-white/70">{g.items.length} línea(s)</span>
                    </div>
                    <span className="text-[11px] text-white/50">Orden: {FLUJO.join(' → ')}</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {g.items.map((p) => {
  const sig = nextEstado(p.estado);
  const ocupado = ocupadoId === p.id;

  // REGLA DE BLOQUEO: 
  // Solo bloqueamos si el pedido está en CORTE y ya llegamos al límite de 30.
  // Los pedidos que ya pasaron a ENCHAPE o REFILADA pueden seguir avanzando normal.
  const bloqueoPorLimite = p.estado === 'CORTE' && totalLaminasHoy >= LIMITE_DIARIO;

  return (
    <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
      <div className="min-w-0">
        <p className="font-bold truncate">
          {p.lamina || 'Lámina'} <span className="text-white/60 font-medium">· {p.cantidad_laminas} u.</span>
        </p>
        <p className="text-xs text-white/70 mt-1">
          Cliente: <span className="font-semibold">{p.cliente || '—'}</span> · Entrega: {p.fecha_entrega}
        </p>
      </div>

      <button
        type="button"
        onClick={() => avanzar(p)}
        // Agregamos 'bloqueoPorLimite' al disabled
        disabled={!sig || ocupadoId != null || bloqueoPorLimite}
        className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors
          ${bloqueoPorLimite 
            ? 'bg-slate-700 text-white/30 cursor-not-allowed' 
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          } disabled:opacity-50`}
      >
        {ocupado 
          ? 'Procesando…' 
          : bloqueoPorLimite 
            ? 'Cupo diario lleno' // Texto informativo para el operador
            : sig 
              ? `Avanzar a ${sig}` 
              : 'Finalizado'}
      </button>
    </div>
  );
})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-red-400 font-black mb-3">Guía técnica por etapa</h3>
          <div className="space-y-3">
            {ETAPAS_OPERADOR.map((item) => (
              <article key={item.etapa} className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                <p className="font-black text-white">{item.etapa}</p>
                <p className="text-xs text-white/70 mt-1">{item.descripcion}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-red-300 mt-3">EPP obligatorio</p>
                <p className="text-xs text-white/75 mt-1">{item.epp.join(' · ')}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300 mt-3">Control de calidad</p>
                <ul className="text-xs text-white/75 mt-1 space-y-1">
                  {item.calidad.map((punto) => (
                    <li key={punto}>- {punto}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}