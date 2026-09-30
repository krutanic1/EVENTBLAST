import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Layout from '../components/Layout';
import EventForm from '../components/EventForm';
import { eventsApi } from '../services/eventService';

export default function NewEventPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (data) => {
    setLoading(true);
    setServerError('');
    try {
      await eventsApi.create(data);
      navigate('/events', { state: { toast: 'Event created successfully!' } });
    } catch (err) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  return (
    <Layout title="New Event" subtitle="Set up your event invitation details">
      <div className="max-w-2xl mx-auto">
        <div className="glass rounded-2xl border border-indigo-500/15 p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Event Details</h2>
              <p className="text-sm text-slate-500">Fill in the details for your event</p>
            </div>
          </div>

          {serverError && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-900/10 text-rose-400 text-sm">
              {serverError}
            </div>
          )}

          <EventForm
            onSubmit={handleSubmit}
            onCancel={() => navigate('/events')}
            loading={loading}
          />
        </div>
      </div>
    </Layout>
  );
}
