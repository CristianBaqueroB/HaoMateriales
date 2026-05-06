export default function OperadorDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-red-800 p-4 flex justify-between items-center">
        <h1 className="font-bold">CONTROL DE TALLER</h1>
        <span className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/70">Terminal 01</span>
      </nav>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-red-500 font-bold mb-4">Tareas en Proceso</h3>
          <div className="space-y-3">
             <div className="p-3 bg-slate-700 rounded-lg flex justify-between">
                <span>Corte de Lámina Galv.</span>
                <span className="text-yellow-400 font-bold">70%</span>
             </div>
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-red-500 font-bold mb-4">Insumos Críticos</h3>
          <div className="text-sm text-slate-400">Todo el material está disponible para hoy.</div>
        </div>
      </div>
    </div>
  );
}