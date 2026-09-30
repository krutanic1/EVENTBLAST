import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  Settings,
  Zap,
  Activity,
  Megaphone,
  Users,
} from 'lucide-react';

// ─── Google icon (inline SVG) ─────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Nav groups definition ────────────────────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard',  end: true },
      { to: '/dashboard/campaigns', icon: Megaphone,   label: 'All Campaigns',     end: true },
      { to: '/dashboard/recipients', icon: Users,      label: 'Recipients',     end: false },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      {
        to: '/dashboard/campaigns/new',
        icon: PlusCircle,
        iconEl: null,
        label: 'New Campaign',
        end: false,
      },
    ],
  },
  {
    label: 'Google',
    items: [
      {
        to: '/dashboard/accounts',
        icon: null,
        iconEl: <GoogleIcon />,
        label: 'Calendar Accounts',
        end: false,
      },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings', end: false },
    ],
  },
];

// ─── NavItem ──────────────────────────────────────────────
function NavItem({ to, icon: Icon, iconEl, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group border ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`flex-shrink-0 w-[18px] flex items-center justify-center transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'
            }`}
          >
            {iconEl ?? (Icon ? <Icon size={17} /> : null)}
          </span>
          <span className="flex-1 truncate">{label}</span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot flex-shrink-0" />
          )}
        </>
      )}
    </NavLink>
  );
}

// ─── Sidebar ──────────────────────────────────────────────
export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col glass border-r border-indigo-500/10">

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-indigo-500/10">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 glow">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold gradient-text tracking-tight">EventBlast</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-700 uppercase tracking-widest">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-4 border-t border-indigo-500/10">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity size={12} className="text-emerald-400" />
          <span>System operational</span>
        </div>
        <div className="mt-1 text-xs text-slate-600">v1.0.0</div>
      </div>
    </aside>
  );
}
