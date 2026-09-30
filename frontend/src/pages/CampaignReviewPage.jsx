import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Pause, Play, XCircle, RotateCcw, AlertCircle, CheckCircle2,
  Send, Users, ChevronLeft, Loader2
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../lib/api';

const STORED_USER_ID = () => localStorage.getItem('eventblast_userId') || '';

function StatBox({ label, count, color }) {
  const colors = {
    slate: 'bg-surface-700/50 border-slate-700 text-slate-300',
    indigo: 'bg-indigo-900/20 border-indigo-500/30 text-indigo-300',
    emerald: 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300',
    rose: 'bg-rose-900/20 border-rose-500/30 text-rose-300',
    amber: 'bg-amber-900/20 border-amber-500/30 text-amber-300',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]} flex flex-col items-center justify-center text-center`}>
      <span className="text-xs uppercase tracking-wider font-semibold opacity-70 mb-1">{label}</span>
      <span className="text-2xl font-bold">{count}</span>
    </div>
  );
}

export default function CampaignReviewPage() {
  const { id } = useParams();
  const userId = STORED_USER_ID();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = () => {
    if (!id || !userId) return;
    api.get(`/campaigns/${id}/stats`, { params: { userId } })
      .then((r) => setStats(r.data.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Poll every 5 seconds if active
  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      if (stats?.campaign?.status === 'active' || stats?.campaign?.status === 'draft') {
        fetchStats();
      }
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId, stats?.campaign?.status]);

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      await api.post(`/campaigns/${id}/${action}`, {}, { params: { userId } });
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <Layout title="Campaign Progress">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-400" size={32} />
        </div>
      </Layout>
    );
  }

  if (error || !stats) {
    return (
      <Layout title="Campaign Progress">
        <div className="max-w-2xl mx-auto flex flex-col items-center py-20 text-center gap-4">
          <AlertCircle size={32} className="text-rose-400" />
          <p className="text-slate-400">{error || 'Campaign not found.'}</p>
          <Link to="/dashboard" className="text-indigo-400 underline text-sm">Return to Dashboard</Link>
        </div>
      </Layout>
    );
  }

  const { campaign, counts } = stats;
  const isDraft = campaign.status === 'draft';
  const isActive = campaign.status === 'active';
  const isPaused = campaign.status === 'paused';
  const isCancelled = campaign.status === 'cancelled';
  const isComplete = campaign.status === 'completed' || (counts.pending === 0 && counts.processing === 0 && counts.retrying === 0 && !isDraft && !isCancelled);

  // Calculate progress percentage
  const totalProcessed = counts.sent + counts.failed + counts.cancelled;
  const progressPercent = counts.total > 0 ? Math.round((totalProcessed / counts.total) * 100) : 0;

  return (
    <Layout title={isDraft ? "Review Campaign" : "Campaign Progress"} subtitle={campaign.title}>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">

        {/* Status Banner */}
        <div className="flex items-center justify-between glass rounded-2xl border border-indigo-500/15 p-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-slate-100">Status: <span className="capitalize">{campaign.status}</span></h2>
              {isActive && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
            </div>
            <p className="text-sm text-slate-400">
              {isDraft && "Review your configuration and click start to begin sending."}
              {isActive && "Campaign is actively being processed by the worker queue."}
              {isPaused && "Campaign is paused. No new emails are being sent."}
              {isCancelled && "Campaign was stopped. Remaining jobs were cancelled."}
              {isComplete && !isCancelled && "Campaign processing is complete!"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isDraft && (
              <button onClick={() => handleAction('resume')} disabled={actionLoading} className="btn-primary">
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Start Campaign
              </button>
            )}
            
            {isActive && (
              <button onClick={() => handleAction('pause')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-colors text-sm font-semibold">
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} />}
                Pause
              </button>
            )}

            {isPaused && (
              <button onClick={() => handleAction('resume')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-colors text-sm font-semibold">
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Resume
              </button>
            )}

            {(isActive || isPaused || isDraft) && !isComplete && (
              <button onClick={() => { if(window.confirm('Are you sure? This will cancel all remaining pending jobs.')) handleAction('cancel'); }} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl hover:bg-rose-500/30 transition-colors text-sm font-semibold">
                <XCircle size={16} />
                STOP CAMPAIGN
              </button>
            )}

            {counts.failed > 0 && (
              <button onClick={() => handleAction('retry-failed')} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/30 transition-colors text-sm font-semibold">
                <RotateCcw size={16} />
                Retry Failed
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="glass rounded-2xl border border-indigo-500/15 p-6">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-semibold text-slate-300">Overall Progress</span>
            <span className="text-2xl font-bold text-indigo-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-surface-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Total" count={counts.total} color="slate" />
          <StatBox label="Pending" count={counts.pending} color="slate" />
          <StatBox label="Processing" count={counts.processing} color="indigo" />
          <StatBox label="Sent" count={counts.sent} color="emerald" />
          <StatBox label="Failed" count={counts.failed} color="rose" />
          <StatBox label="Retrying" count={counts.retrying} color="amber" />
          <StatBox label="Cancelled" count={counts.cancelled} color="slate" />
        </div>

      </div>
    </Layout>
  );
}
