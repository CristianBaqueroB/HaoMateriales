export default function UserDashboard() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-red-700 p-4 text-white flex justify-between items-center shadow-lg">
        <h1 className="font-bold text-xl italic tracking-tighter">HAO MATERIALES</h1>
        <button onClick={() => window.location.href='/login'} className="text-sm font-medium border-b border-white/50">Salir</button>
      </nav>
      <main className="p-8">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-4xl mx-auto border-t-8 border-red-700">
          <h2 className="text-2xl font-bold text-slate-800">Mis Pedidos</h2>
          <p className="text-slate-500 mb-8 text-sm">Estado actual de tus solicitudes de herramientas y láminas.</p>
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">
             <p className="text-slate-400">Aún no tienes pedidos registrados.</p>
             <button className="mt-4 bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-red-900/20">Hacer Primer Pedido</button>
          </div>
        </div>
      </main>
    </div>
  );
}