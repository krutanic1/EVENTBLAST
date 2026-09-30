import { format } from 'date-fns';
import { Calendar, MapPin, Users, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  draft:      'bg-slate-700/50 text-slate-400 border-slate-600/50',
  scheduled:  'bg-blue-900/40 text-blue-300 border-blue-700/50',
  sent:       'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  cancelled:  'bg-rose-900/40 text-rose-300 border-rose-700/50',
};

export default function EventCard({ event, onDelete }) {
  const dateStr = event.eventDate
    ? format(new Date(event.eventDate), 'MMM d, yyyy · h:mm a')
    : '—';

  return (
    <div className="glass rounded-2xl p-5 border border-indigo-500/10 hover:border-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 fade-in group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate text-base group-hover:text-indigo-300 transition-colors">
            {event.title}
          </h3>
          {event.description && (
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">{event.description}</p>
          )}
        </div>
        <span
          className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLES[event.status] || STATUS_STYLES.draft}`}
        >
          {event.status}
        </span>
      </div>

      {/* Meta */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Calendar size={13} className="text-indigo-400 flex-shrink-0" />
          <span>{dateStr}</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <MapPin size={13} className="text-indigo-400 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users size={13} className="text-indigo-400 flex-shrink-0" />
          <span>
            {Array.isArray(event.invitees) ? event.invitees.length : 0} invitee
            {(event.invitees?.length ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-indigo-500/10 pt-4">
        <Link
          to={`/events/${event._id}`}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <ExternalLink size={12} />
          View
        </Link>
        <Link
          to={`/events/${event._id}/edit`}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors ml-3"
        >
          <Pencil size={12} />
          Edit
        </Link>
        <button
          onClick={() => onDelete?.(event._id)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-400 transition-colors ml-auto"
          aria-label={`Delete event ${event.title}`}
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
}
