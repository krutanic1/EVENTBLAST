import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Settings as SettingsIcon, Lock, Globe, Bell, Palette,
  CheckCircle, XCircle, Plus, Trash2, RefreshCw,
  Calendar, AlertCircle, ExternalLink,
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../lib/api';

// ─── Temporary: hard-coded demo userId ───────────────────
// TODO: replace with real auth context once JWT is wired in.
const DEMO_USER_ID = localStorage.getItem('eventblast_userId') || '';

// ─── Sub-components ───────────────────────────────────────

function Toast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`flex items-start gap-3 px-5 py-4 rounded-xl border text-sm font-medium fade-in ${
        type === 'success'
          ? 'bg-emerald-900/20 border-emerald-500/20 text-emerald-300'
          : 'bg-rose-900/20 border-rose-500/20 text-rose-300'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
      )}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity ml-2">
        <XCircle size={14} />
      </button>
    </div>
  );
}

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-indigo-500/10 last:border-0">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mt-0.5">
          <Icon size={14} className="text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-300">{label}</p>
          {description && <p className="text-xs text-slate-600 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="ml-4 flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ defaultChecked }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
      <div className="w-10 h-5 bg-slate-700 peer-checked:bg-indigo-600 rounded-full transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
    </label>
  );
}

const STATUS_PILL = {
  active:  'bg-emerald-900/30 text-emerald-300 border-emerald-700/40',
  revoked: 'bg-rose-900/30 text-rose-300 border-rose-700/40',
  expired: 'bg-amber-900/30 text-amber-300 border-amber-700/40',
  error:   'bg-rose-900/30 text-rose-300 border-rose-700/40',
};

// ─── GoogleAccountsPanel ──────────────────────────────────
function GoogleAccountsPanel({ userId, onMessage }) {
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(null);

  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await api.get('/google/accounts', { params: { userId } });
      setAccounts(res.data.data || []);
    } catch (err) {
      onMessage('error', `Failed to load accounts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [userId, onMessage]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleConnect = () => {
    if (!userId) {
      onMessage('error', 'No user ID found. Set your User ID below first.');
      return;
    }
    // Navigate to backend OAuth initiation — this is a full browser redirect.
    // The backend will redirect to Google, and Google will call back to
    // /api/google/callback, which redirects back here with query params.
    window.location.href = `${api.defaults.baseURL}/google/auth?userId=${encodeURIComponent(userId)}&frontendUrl=${encodeURIComponent(window.location.origin)}`;
  };

  const handleDisconnect = async (accountId, email) => {
    if (!window.confirm(`Disconnect ${email}? Campaigns using this account will need a new account linked.`)) return;
    setDeleting(accountId);
    try {
      await api.delete(`/google/accounts/${accountId}`, { params: { userId } });
      setAccounts((prev) => prev.filter((a) => a._id !== accountId));
      onMessage('success', `${email} has been disconnected.`);
    } catch (err) {
      onMessage('error', `Failed to disconnect: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Connected Google Accounts</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Each account can be used to create Google Calendar event invitations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="p-2 rounded-lg glass border border-indigo-500/20 text-slate-400 hover:text-slate-100 transition-all"
            aria-label="Refresh accounts"
            id="google-accounts-refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleConnect}
            id="google-connect-btn"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all glow"
          >
            <Plus size={14} /> Connect Account
          </button>
        </div>
      </div>

      {/* Accounts list */}
      {loading && (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-indigo-500/20 text-center">
          <Calendar size={28} className="text-indigo-500/40 mb-3" />
          <p className="text-sm text-slate-500">No Google accounts connected yet</p>
          <p className="text-xs text-slate-700 mt-1">
            Click "Connect Account" to authorise EventBlast to create Calendar events.
          </p>
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account._id}
              className="flex items-center gap-4 px-4 py-3.5 glass rounded-xl border border-indigo-500/10 hover:border-indigo-500/20 transition-all"
            >
              {/* Google icon */}
              <div className="w-9 h-9 rounded-full bg-white/5 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{account.name || account.email}</p>
                <p className="text-xs text-slate-500 truncate">{account.email}</p>
                {account.calendarName && (
                  <p className="text-xs text-indigo-400/70 mt-0.5 truncate flex items-center gap-1">
                    <Calendar size={10} />
                    {account.calendarName}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_PILL[account.status] || STATUS_PILL.active}`}>
                  {account.status}
                </span>
                <button
                  onClick={() => handleDisconnect(account._id, account.email)}
                  disabled={deleting === account._id}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-40"
                  aria-label={`Disconnect ${account.email}`}
                  id={`disconnect-${account._id}`}
                >
                  {deleting === account._id ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scopes note */}
      <div className="mt-4 px-4 py-3 rounded-xl bg-indigo-600/5 border border-indigo-500/10 text-xs text-slate-600 leading-relaxed">
        <p className="font-medium text-slate-500 mb-1">Permissions requested:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Read your email address and profile name</li>
          <li>Create and manage Google Calendar events</li>
          <li>Read your calendar list (to identify your primary calendar)</li>
        </ul>
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Manage app permissions in Google Account <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

// ─── UserIdConfig (temporary dev helper) ─────────────────
function UserIdConfig({ userId, onSave }) {
  const [val, setVal] = useState(userId);
  return (
    <div className="flex items-center gap-3">
      <input
        id="settings-user-id"
        className="flex-1 px-3 py-2 text-sm bg-surface-700 border border-indigo-500/20 text-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/30 font-mono"
        placeholder="MongoDB ObjectId of your user"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button
        onClick={() => onSave(val.trim())}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all"
        id="settings-save-userid-btn"
      >
        Save
      </button>
    </div>
  );
}

// ─── Main SettingsPage ────────────────────────────────────
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast]     = useState(null);
  const [userId, setUserId]   = useState(DEMO_USER_ID);

  // Handle redirect params from OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const account   = searchParams.get('account');
    const error     = searchParams.get('error');

    if (connected === '1' && account) {
      setToast({ type: 'success', message: `✅ ${decodeURIComponent(account)} connected successfully!` });
      setSearchParams({}, { replace: true });
    } else if (error) {
      setToast({ type: 'error', message: decodeURIComponent(error) });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const saveUserId = (id) => {
    setUserId(id);
    localStorage.setItem('eventblast_userId', id);
    setToast({ type: 'success', message: 'User ID saved locally.' });
  };

  const showMessage = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  return (
    <Layout title="Settings" subtitle="Configure your EventBlast workspace">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Toast */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        {/* ── Google Accounts ─────────────────────────────── */}
        <section className="glass rounded-2xl border border-indigo-500/15 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
              <Lock size={15} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-300">Google OAuth</h2>
              <p className="text-xs text-slate-600">Connect Google accounts to send Calendar invitations</p>
            </div>
          </div>
          <GoogleAccountsPanel userId={userId} onMessage={showMessage} />
        </section>

        {/* ── Dev: User ID config ─────────────────────────── */}
        <section className="glass rounded-2xl border border-amber-500/15 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">Developer — User ID</h2>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Temporary: paste your MongoDB User ObjectId here. This will be replaced by JWT auth.
          </p>
          <UserIdConfig userId={userId} onSave={saveUserId} />
        </section>

        {/* ── General ─────────────────────────────────────── */}
        <section className="glass rounded-2xl border border-indigo-500/15 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">General</h2>
          <SettingRow icon={Globe} label="Timezone" description="Events are scheduled in this timezone">
            <select className="text-sm bg-surface-700 border border-indigo-500/20 text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30">
              <option>UTC</option>
              <option>Asia/Kolkata</option>
              <option>America/New_York</option>
              <option>Europe/London</option>
            </select>
          </SettingRow>
          <SettingRow icon={Palette} label="Dark Mode" description="Always-on dark theme">
            <Toggle defaultChecked={true} />
          </SettingRow>
        </section>

        {/* ── Notifications ───────────────────────────────── */}
        <section className="glass rounded-2xl border border-indigo-500/15 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Notifications</h2>
          <SettingRow icon={Bell} label="Email reminders" description="Send reminders 24h before events">
            <Toggle defaultChecked={true} />
          </SettingRow>
          <SettingRow icon={Bell} label="Invite confirmations" description="Notify when invitees respond">
            <Toggle defaultChecked={false} />
          </SettingRow>
        </section>

        {/* ── About ───────────────────────────────────────── */}
        <section className="glass rounded-2xl border border-indigo-500/15 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">About</h2>
          <div className="space-y-1 text-sm text-slate-600">
            <p>EventBlast v1.0.0</p>
            <p>Built with React · Express · MongoDB Atlas · Google Calendar API</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
