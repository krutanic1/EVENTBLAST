import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import EventForm from '../components/EventForm';
import { eventsApi } from '../services/eventService';

export default function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    eventsApi.getById(id)
      .then((res) => setEvent(res.data.data))
      .catch((err) => setServerError(err.message))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (data) => {
    setLoading(true);
    setServerError('');
    try {
      await eventsApi.update(id, data);
      navigate(`/events/${id}`);
    } catch (err) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  if (fetching) return (
    <Layout title="Edit Event">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-8 w-1/3 rounded-xl" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    </Layout>
  );

  return (
    <Layout title="Edit Event" subtitle="Update the event details">
      <div className="max-w-2xl mx-auto">
        <Link
          to={`/events/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-5"
        >
          <ArrowLeft size={14} /> Back to Event
        </Link>

        <div className="glass rounded-2xl border border-indigo-500/15 p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Pencil size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Edit Event</h2>
              <p className="text-sm text-slate-500">Modify the event details below</p>
            </div>
          </div>

          {serverError && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-900/10 text-rose-400 text-sm">
              {serverError}
            </div>
          )}

          {event && (
            <EventForm
              initialData={event}
              onSubmit={handleSubmit}
              onCancel={() => navigate(`/events/${id}`)}
              loading={loading}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
