import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Calendar, MapPin, Users, Globe, Pencil, Trash2,
  ArrowLeft, Tag, Clock
} from 'lucide-react';
import Layout from '../components/Layout';
import { eventsApi } from '../services/eventService';

const STATUS_STYLES = {
  draft:      'bg-slate-700/50 text-slate-300 border-slate-600/50',
  scheduled:  'bg-blue-900/40 text-blue-300 border-blue-700/50',
  sent:       'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  cancelled:  'bg-rose-900/40 text-rose-300 border-rose-700/50',
};

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    eventsApi.getById(id)
      .then((res) => setEvent(res.data.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this event permanently?')) return;
    try {
      await eventsApi.remove(id);
      navigate('/events');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <Layout title="Event Detail">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-8 w-1/2 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </Layout>
  );

  if (error || !event) return (
    <Layout title="Event Detail">
      <div className="p-5 rounded-xl border border-rose-500/20 bg-rose-900/10 text-rose-400 text-sm max-w-xl">
        {error || 'Event not found'}
      </div>
    </Layout>
  );

  return (
    <Layout title={event.title} subtitle="Event details">
      <div className="max-w-3xl mx-auto fade-in">
        {/* Back + Actions */}
        <div className="flex items-center justify-between mb-5">
          <Link
            to="/events"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Events
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to={`/events/${id}/edit`}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-300 glass border border-indigo-500/20 rounded-lg hover:bg-white/5 transition-all"
            >
              <Pencil size={13} /> Edit
            </Link>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-rose-400 glass border border-rose-500/20 rounded-lg hover:bg-rose-500/10 transition-all"
              id="event-detail-delete-btn"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-indigo-500/15 p-8 space-y-6">
          {/* Title & status */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-slate-100">{event.title}</h1>
            <span className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border ${STATUS_STYLES[event.status]}`}>
              {event.status}
            </span>
          </div>

          {event.description && (
            <p className="text-slate-400 leading-relaxed">{event.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-indigo-500/10 pt-6">
            <Detail icon={Calendar} label="Date & Time">
              {format(new Date(event.eventDate), 'PPPP · p')}
            </Detail>

            {event.location && (
              <Detail icon={MapPin} label="Location">{event.location}</Detail>
            )}

            {event.isVirtual && event.meetingLink && (
              <Detail icon={Globe} label="Meeting Link">
                <a href={event.meetingLink} target="_blank" rel="noreferrer"
                   className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all">
                  {event.meetingLink}
                </a>
              </Detail>
            )}

            <Detail icon={Tag} label="Status">{event.status}</Detail>
            <Detail icon={Clock} label="Created">
              {format(new Date(event.createdAt), 'PPP')}
            </Detail>
          </div>

          {/* Invitees */}
          {event.invitees?.length > 0 && (
            <div className="border-t border-indigo-500/10 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-indigo-400" />
                <span className="text-sm font-medium text-slate-300">
                  Invitees ({event.invitees.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {event.invitees.map((email) => (
                  <span
                    key={email}
                    className="text-xs px-3 py-1.5 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-300"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-indigo-400" />
      </div>
      <div>
        <p className="text-xs text-slate-600 mb-0.5">{label}</p>
        <p className="text-sm text-slate-300">{children}</p>
      </div>
    </div>
  );
}
