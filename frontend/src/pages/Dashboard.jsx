import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Mail, CheckCircle2, XCircle, Clock,
  Calendar, Loader2, Plus, ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import api from '../lib/api';

const STORED_USER_ID = () => localStorage.getItem('eventblast_userId') || '';

function StatCard({ title, value, icon: Icon, colorClass }) {
  return (
    <div className="glass p-5 rounded-2xl border border-white/5 flex items-start justify-between hover:border-indigo-500/20 transition-colors">
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">{title}</p>
        <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      </div>
      <div className={`p-3 rounded-xl bg-surface-800 border border-white/5 ${colorClass}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const userId = STORED_USER_ID();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.get('/dashboard/stats', { params: { userId } })
      .then(res => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <Layout title="Dashboard" subtitle="Welcome back to EventBlast">
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
      </Layout>
    );
  }

  if (!stats) return <Layout title="Dashboard" />;

  return (
    <Layout title="Dashboard" subtitle="Overview of your event campaigns">
      <div className="space-y-8 pb-10">
        
        {/* Actions Row */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-200">Quick Stats</h2>
          <Link to="/dashboard/campaigns/new" className="btn-primary shadow-lg shadow-indigo-500/20">
            <Plus size={16} /> New Campaign
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Total Campaigns" value={stats.totalCampaigns} icon={Calendar} colorClass="text-slate-200" />
          <StatCard title="Total Recipients" value={stats.totalRecipients} icon={Users} colorClass="text-indigo-400" />
          <StatCard title="Successful" value={stats.successful} icon={CheckCircle2} colorClass="text-emerald-400" />
          <StatCard title="Failed" value={stats.failed} icon={XCircle} colorClass="text-rose-400" />
          <StatCard title="Pending" value={stats.pending} icon={Clock} colorClass="text-amber-400" />
          <StatCard title="Google Accounts" value={stats.connectedAccounts} icon={Mail} colorClass="text-purple-400" />
        </div>

        {/* Recent Campaigns Table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface-800/20">
            <h3 className="text-base font-semibold text-slate-200">Recent Campaigns</h3>
            <Link to="/dashboard/campaigns" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-surface-800/50 text-slate-500 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Campaign</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Organizer</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Recipients</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.recentCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                      No campaigns created yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentCampaigns.map((camp) => (
                    <tr key={camp._id} className="hover:bg-surface-800/30 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-200">
                        <Link to={`/dashboard/campaigns/${camp._id}/review`} className="group-hover:text-indigo-400 transition-colors">
                          {camp.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{camp.googleAccountId?.email || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-xs font-medium">
                          <span className="text-slate-300 bg-surface-700 px-2 py-1 rounded">Total: {camp.totalRecipients}</span>
                          <span className="text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded">✓ {camp.successful}</span>
                          {camp.failed > 0 && <span className="text-rose-400 bg-rose-900/20 px-2 py-1 rounded">✗ {camp.failed}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold capitalize tracking-wide ${
                          camp.status === 'active' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20' :
                          camp.status === 'draft' ? 'bg-amber-900/30 text-amber-400 border border-amber-500/20' :
                          camp.status === 'paused' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' :
                          'bg-surface-700 text-slate-300 border border-white/5'
                        }`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {format(new Date(camp.createdAt), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}
