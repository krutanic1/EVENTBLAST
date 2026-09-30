import { useEffect, useState } from 'react';
import { Loader2, Search, Mail } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import api from '../lib/api';

const STORED_USER_ID = () => localStorage.getItem('eventblast_userId') || '';

export default function RecipientsPage() {
  const userId = STORED_USER_ID();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load campaigns for filter
  useEffect(() => {
    if (!userId) return;
    api.get('/campaigns', { params: { userId } })
      .then(res => {
        setCampaigns(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedCampaign(res.data.data[0]._id);
        }
      })
      .catch(console.error);
  }, [userId]);

  // Load recipients for selected campaign
  useEffect(() => {
    if (!userId || !selectedCampaign) return;
    setLoading(true);
    api.get(`/campaigns/${selectedCampaign}/recipients`, { params: { userId, page, limit: 50 } })
      .then(res => {
        setRecipients(res.data.data);
        setTotalPages(res.data.pagination.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, selectedCampaign, page]);

  return (
    <Layout title="Recipients" subtitle="View recipient status and delivery logs">
      <div className="space-y-6 pb-10">
        
        {/* Filters */}
        <div className="glass p-4 rounded-xl border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full flex items-center gap-3">
            <Mail size={18} className="text-slate-500" />
            <select
              value={selectedCampaign}
              onChange={(e) => { setSelectedCampaign(e.target.value); setPage(1); }}
              className="w-full md:max-w-xs bg-surface-800 border border-white/5 text-sm text-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500/50"
            >
              {campaigns.length === 0 && <option value="">No campaigns available</option>}
              {campaigns.map(c => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
          ) : recipients.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No recipients found for this campaign.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-surface-800/50 text-slate-500 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Email</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Consent</th>
                    <th className="px-6 py-4 font-semibold">Attempts</th>
                    <th className="px-6 py-4 font-semibold">Last Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recipients.map((r) => (
                    <tr key={r._id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-200">{r.email}</td>
                      <td className="px-6 py-4">{r.name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold capitalize ${
                          r.status === 'sent' ? 'bg-emerald-900/30 text-emerald-400' :
                          r.status === 'failed' ? 'bg-rose-900/30 text-rose-400' :
                          r.status === 'retrying' ? 'bg-amber-900/30 text-amber-400' :
                          r.status === 'cancelled' ? 'bg-slate-700 text-slate-300' :
                          'bg-surface-700 text-slate-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-1 bg-surface-700 rounded text-slate-400 capitalize">{r.consentStatus}</span>
                      </td>
                      <td className="px-6 py-4">{r.attempts}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={r.error || r.sentAt}>
                        {r.error || (r.sentAt ? `Sent at ${format(new Date(r.sentAt), 'PPp')}` : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-surface-800 border border-white/5 rounded-md text-slate-400 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-slate-400">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-surface-800 border border-white/5 rounded-md text-slate-400 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
