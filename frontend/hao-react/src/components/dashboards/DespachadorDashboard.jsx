export default function DespachadorDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-red-700 p-6 text-white shadow-xl">
        <h1 className="text-2xl font-black">LOGÍSTICA Y DESPACHO</h1>
      </header>
      <div className="p-8 flex-grow">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="font-bold text-slate-800 mb-4">Envíos Pendientes Valledupar</h2>
          <div className="space-y-4">
             {/* Lista de despachos ficticia */}
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border-l-4 border-red-700">
                <div>
                   <p className="font-bold text-slate-800">Entrega #0452 - Barrio Don Carmelo</p>
                   <p className="text-xs text-slate-400">12 Láminas de Acero de 2mm</p>
                </div>
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Despachar</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}