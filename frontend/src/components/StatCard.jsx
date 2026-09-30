export default function StatCard({ label, value, icon: Icon, trend, color = 'indigo' }) {
  const colors = {
    indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400',
    rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/20 text-rose-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl glass border bg-gradient-to-br ${colors[color]} p-6 fade-in transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 group`}
    >
      {/* Background glow blob */}
      <div
        className={`absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl bg-gradient-to-br ${colors[color]}`}
      />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{label}</p>
          <p className="mt-2 text-4xl font-bold text-slate-100">{value}</p>
          {trend && (
            <p className="mt-1 text-xs text-slate-500">
              {trend}
            </p>
          )}
        </div>
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} border`}
        >
          <Icon size={22} className="opacity-90" />
        </div>
      </div>
    </div>
  );
}
