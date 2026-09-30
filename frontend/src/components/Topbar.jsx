import { Bell, Search } from 'lucide-react';

export default function Topbar({ title, subtitle }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 glass border-b border-indigo-500/10">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:flex items-center">
          <Search
            size={15}
            className="absolute left-3 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search events…"
            className="pl-9 pr-4 py-2 text-sm bg-surface-700 border border-indigo-500/20 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all w-52"
          />
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg bg-surface-700 border border-indigo-500/20 text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 pulse-dot" />
        </button>

        {/* Avatar placeholder */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition-all">
          U
        </div>
      </div>
    </header>
  );
}
