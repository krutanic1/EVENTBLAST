import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, RefreshCw, Trash2, CheckCircle2, Calendar,
  Clock, Link2, AlertCircle, ShieldCheck, Wifi,
  Star, StarOff, ExternalLink, XCircle,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useGoogleAccounts } from '../hooks/useGoogleAccounts';

// ─── Read persisted userId ────────────────────────────────
const getStoredUserId = () => localStorage.getItem('eventblast_userId') || '';

// ─── Google icon SVG ─────────────────────────────────────
function GoogleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Status config ────────────────────────────────────────
const STATUS = {
  active:   { label: 'Active',   dot: 'bg-emerald-400', pill: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/30' },
  revoked:  { label: 'Revoked',  dot: 'bg-rose-400',    pill: 'bg-rose-900/30 text-rose-300 border-rose-700/30' },
  expired:  { label: 'Expired',  dot: 'bg-amber-400',   pill: 'bg-amber-900/30 text-amber-300 border-amber-700/30' },
  error:    { label: 'Error',    dot: 'bg-rose-400',     pill: 'bg-rose-900/30 text-rose-300 border-rose-700/30' },
};

// ─── Toast ────────────────────────────────────────────────
function Toast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border text-sm font-medium fade-in ${
      type === 'success'
        ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-300'
        : 'bg-rose-900/20 border-rose-500/20 text-rose-300'
    }`}>
      {type === 'success'
        ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
        : <AlertCircle  size={15} className="flex-shrink-0 mt-0.5" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
        <XCircle size={14} />
      </button>
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────
function ConfirmDialog({ email, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm fade-in">
      <div className="glass rounded-2xl border border-rose-500/20 p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Trash2 size={18} className="text-rose-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Disconnect Account</h3>
            <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          Remove <span className="font-medium text-slate-200">{email}</span> from EventBlast?
          Any campaigns using this account will need to be re-linked.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-400 glass border border-indigo-500/20 rounded-xl hover:bg-white/5 transition-all"
            id="disconnect-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-all"
            id="disconnect-confirm"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────
function MiniStat({ label, value, icon: Icon, color }) {
  const colors = {
    indigo:  'text-indigo-400  bg-indigo-500/10  border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
    rose:    'text-rose-400    bg-rose-500/10    border-rose-500/20',
  };
  return (
    <div className="glass rounded-xl border border-indigo-500/10 px-5 py-4 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Account card ─────────────────────────────────────────
function AccountCard({ account, isActive, onSetActive, onDisconnect }) {
  const cfg         = STATUS[account.status] || STATUS.active;
  const connectedAt = account.connectedAt ? format(new Date(account.connectedAt), 'MMM d, yyyy') : '—';
  const lastUsed    = account.lastUsedAt
    ? formatDistanceToNow(new Date(account.lastUsedAt), { addSuffix: true })
    : 'Never';

  return (
    <div className={`relative glass rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 fade-in overflow-hidden ${
      isActive
        ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/10'
        : 'border-indigo-500/10 hover:border-indigo-500/25'
    }`}>

      {/* Active glow strip */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
      )}

      <div className="p-6">
        {/* ── Header ── */}
        <div className="flex items-start gap-4 mb-5">
          {/* Avatar with Google icon */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <GoogleIcon size={24} />
            </div>
            {/* Status dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-800 ${cfg.dot}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-100 truncate text-base">
                  {account.name || account.email}
                </p>
                <p className="text-sm text-slate-500 truncate">{account.email}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isActive && (
                  <span className="flex items-center gap-1 text-xs font-medium text-indigo-300 bg-indigo-600/15 border border-indigo-500/25 px-2.5 py-1 rounded-full">
                    <Star size={10} fill="currentColor" />
                    Active
                  </span>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.pill}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Details grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Detail icon={Calendar} label="Calendar">
            <span className="truncate">{account.calendarName || account.calendarId || 'Primary'}</span>
          </Detail>
          <Detail icon={ShieldCheck} label="Status">
            <span className={`capitalize ${account.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {account.status}
            </span>
          </Detail>
          <Detail icon={Link2} label="Connected">
            {connectedAt}
          </Detail>
          <Detail icon={Clock} label="Last Used">
            {lastUsed}
          </Detail>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-indigo-500/10 pt-4 flex items-center gap-2">
          {/* Use Account */}
          <button
            onClick={() => onSetActive(account._id)}
            disabled={isActive}
            id={`use-account-${account._id}`}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              isActive
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white glow'
            }`}
          >
            {isActive ? (
              <>
                <CheckCircle2 size={14} />
                In Use
              </>
            ) : (
              <>
                <Star size={14} />
                Use Account
              </>
            )}
          </button>

          {/* Disconnect */}
          <button
            onClick={() => onDisconnect(account)}
            id={`disconnect-${account._id}`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/10 transition-all flex-shrink-0"
          >
            <Trash2 size={14} />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-slate-600">{label}</p>
        <p className="text-sm text-slate-300 truncate mt-0.5">{children}</p>
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="glass rounded-2xl border border-indigo-500/10 p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="skeleton w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
      </div>
      <div className="skeleton h-10 rounded-xl" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────
function EmptyState({ onConnect }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 glass rounded-2xl border border-dashed border-indigo-500/20 text-center fade-in">
      {/* Animated icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
          <GoogleIcon size={36} />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 border-2 border-surface-900 flex items-center justify-center">
          <Plus size={12} className="text-white" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-200 mb-2">No Google accounts connected</h3>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6">
        Connect a Google account to start sending Calendar event invitations.
        You can add multiple accounts.
      </p>

      <button
        onClick={onConnect}
        id="empty-connect-btn"
        className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all glow"
      >
        <Plus size={16} />
        Connect Google Account
      </button>

      {/* Scopes preview */}
      <div className="mt-8 flex items-center gap-6 text-xs text-slate-700">
        {['Calendar Events', 'Profile & Email', 'Calendar List'].map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-indigo-500/50" />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── No userId warning ────────────────────────────────────
function NoUserWarning() {
  return (
    <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-amber-500/20 bg-amber-900/10 text-amber-300 text-sm mb-6">
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span>
        No User ID configured.{' '}
        <a href="/settings" className="underline underline-offset-2 hover:text-amber-200 transition-colors">
          Go to Settings
        </a>{' '}
        and enter your MongoDB User ID to connect Google accounts.
      </span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function AccountsPage() {
  const [userId]                    = useState(getStoredUserId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast,   setToast]         = useState(null);
  const [confirm, setConfirm]       = useState(null); // { account }

  const {
    accounts, loading, error,
    activeId, refetch, connect, disconnect, setActive,
  } = useGoogleAccounts(userId);

  // ── Handle OAuth redirect params ──────────────────────────
  useEffect(() => {
    const connected = searchParams.get('connected');
    const account   = searchParams.get('account');
    const oauthErr  = searchParams.get('error');

    if (connected === '1' && account) {
      showToast('success', `${decodeURIComponent(account)} connected successfully!`);
      setSearchParams({}, { replace: true });
      refetch();
    } else if (oauthErr) {
      showToast('error', decodeURIComponent(oauthErr));
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refetch]);

  const showToast = useCallback((type, message) => setToast({ type, message }), []);

  // ── Connect handler ───────────────────────────────────────
  const handleConnect = () => {
    try {
      connect(); // triggers window.location.href redirect
    } catch (err) {
      showToast('error', err.message);
    }
  };

  // ── Disconnect handler ────────────────────────────────────
  const handleDisconnectRequest = (account) => setConfirm({ account });

  const handleDisconnectConfirm = async () => {
    const { account } = confirm;
    setConfirm(null);
    try {
      await disconnect(account._id);
      showToast('success', `${account.email} has been disconnected.`);
    } catch (err) {
      showToast('error', `Failed to disconnect: ${err.message}`);
    }
  };

  // ── Derived stats ─────────────────────────────────────────
  const activeCount   = accounts.filter((a) => a.status === 'active').length;
  const revokedCount  = accounts.filter((a) => a.status !== 'active').length;

  return (
    <Layout
      title="Google Calendar Accounts"
      subtitle="Manage the Google accounts authorised to send Calendar invitations"
    >
      {/* ── Toast ── */}
      {toast && (
        <div className="mb-6">
          <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        </div>
      )}

      {/* ── No userId warning ── */}
      {!userId && <NoUserWarning />}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* Stats pills */}
          {!loading && accounts.length > 0 && (
            <>
              <span className="text-sm text-slate-500">
                <span className="font-semibold text-slate-200">{accounts.length}</span>{' '}
                account{accounts.length !== 1 ? 's' : ''} connected
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-sm text-emerald-400 font-medium">{activeCount} active</span>
              {revokedCount > 0 && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-sm text-rose-400 font-medium">{revokedCount} inactive</span>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={loading}
            id="accounts-refresh-btn"
            className="p-2.5 rounded-xl glass border border-indigo-500/20 text-slate-400 hover:text-slate-100 transition-all"
            aria-label="Refresh accounts"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleConnect}
            disabled={!userId}
            id="connect-google-btn"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all glow"
          >
            <Plus size={16} />
            Connect Google Account
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          <MiniStat label="Total Connected"  value={accounts.length}   icon={Link2}        color="indigo"  />
          <MiniStat label="Active"           value={activeCount}       icon={Wifi}         color="emerald" />
          <MiniStat label="Inactive"         value={revokedCount}      icon={AlertCircle}  color="rose"    />
          <MiniStat label="In Use"           value={activeId ? 1 : 0}  icon={Star}         color="amber"   />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-rose-500/20 bg-rose-900/10 text-rose-300 text-sm mb-6">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && [...Array(3)].map((_, i) => <SkeletonCard key={i} />)}

        {!loading && !error && accounts.length === 0 && (
          <EmptyState onConnect={handleConnect} />
        )}

        {!loading && accounts.map((account) => (
          <AccountCard
            key={account._id}
            account={account}
            isActive={activeId === account._id}
            onSetActive={setActive}
            onDisconnect={handleDisconnectRequest}
          />
        ))}
      </div>

      {/* ── Security note ── */}
      {accounts.length > 0 && (
        <div className="mt-8 flex items-start gap-3 px-5 py-4 rounded-2xl bg-indigo-600/5 border border-indigo-500/10 text-xs text-slate-600 leading-relaxed">
          <ShieldCheck size={14} className="text-indigo-500/60 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-slate-500">Security: </span>
            OAuth refresh tokens are encrypted at rest (AES-256-GCM) and never sent to the browser.
            EventBlast requests only the minimum Google permissions required to create Calendar invitations.{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
            >
              Manage in Google Account <ExternalLink size={10} />
            </a>
          </span>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirm && (
        <ConfirmDialog
          email={confirm.account.email}
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </Layout>
  );
}
