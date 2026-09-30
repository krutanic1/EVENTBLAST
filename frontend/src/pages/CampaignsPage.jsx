import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import api from '../lib/api';

const STORED_USER_ID = () => localStorage.getItem('eventblast_userId') || '';

export default function CampaignsPage() {
  const userId = STORED_USER_ID();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.get('/campaigns', { params: { userId } })
      .then(res => setCampaigns(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
    
    try {
      await api.delete(`/campaigns/${id}`, { params: { userId } });
      setCampaigns(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <Layout title="Campaigns" subtitle="Manage your event invitations">
      <div className="space-y-6 pb-10">
        <div className="flex justify-end">
          <Link to="/dashboard/campaigns/new" className="btn-primary shadow-lg shadow-indigo-500/20">
            <Plus size={16} /> New Campaign
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
        ) : (
          <div className="grid gap-4">
            {campaigns.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center border border-white/5">
                <Calendar size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-300">No campaigns yet</h3>
                <p className="text-slate-500 mt-2">Create your first campaign to start sending invitations.</p>
              </div>
            ) : (
              campaigns.map(camp => (
                <Link 
                  key={camp._id} 
                  to={`/dashboard/campaigns/${camp._id}/review`}
                  className="glass p-6 rounded-2xl border border-white/5 flex items-center justify-between hover:border-indigo-500/30 transition-colors group"
                >
                  <div>
                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{camp.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {format(new Date(camp.createdAt), 'MMMM d, yyyy')} • {camp.googleAccountId?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Progress</p>
                      <p className="text-sm font-medium text-slate-300">{camp.successful} / {camp.totalRecipients} sent</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize tracking-wide ${
                      camp.status === 'active' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20' :
                      camp.status === 'draft' ? 'bg-amber-900/30 text-amber-400 border border-amber-500/20' :
                      camp.status === 'paused' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' :
                      'bg-surface-700 text-slate-300 border border-white/5'
                    }`}>
                      {camp.status}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, camp._id)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-2"
                      title="Delete Campaign"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
