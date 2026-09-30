import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, RefreshCw, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../components/Layout';
import EventCard from '../components/EventCard';
import { useEvents } from '../hooks/useEvents';

const STATUS_FILTERS = ['all', 'draft', 'scheduled', 'sent', 'cancelled'];

export default function EventsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { events, pagination, page, setPage, loading, error, refetch, deleteEvent } =
    useEvents(1, 9);

  const filtered =
    statusFilter === 'all' ? events : events.filter((e) => e.status === statusFilter);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try { await deleteEvent(id); } catch { /* handled */ }
  };

  return (
    <Layout
      title="Events"
      subtitle={`${pagination.total} event${pagination.total !== 1 ? 's' : ''} total`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Status filter tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-indigo-500/10">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              id={`filter-${s}`}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="p-2 rounded-lg glass border border-indigo-500/20 text-slate-400 hover:text-slate-100 transition-all"
            aria-label="Refresh events"
            id="events-refresh-btn"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            to="/events/new"
            id="events-new-btn"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all glow"
          >
            <PlusCircle size={15} />
            New Event
          </Link>
        </div>
      </div>

      {/* Grid */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-5 rounded-xl border border-rose-500/20 bg-rose-900/10 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 glass rounded-2xl border border-indigo-500/10">
          <CalendarDays size={40} className="text-indigo-500/40 mb-4" />
          <p className="text-slate-400">
            No {statusFilter !== 'all' ? statusFilter : ''} events found
          </p>
          <Link
            to="/events/new"
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-all"
          >
            <PlusCircle size={14} /> Create one
          </Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <EventCard key={event._id} event={event} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 glass border border-indigo-500/20 rounded-lg hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            id="events-prev-page"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="text-sm text-slate-500">
            Page {page} / {pagination.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page >= pagination.pages}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 glass border border-indigo-500/20 rounded-lg hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            id="events-next-page"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      )}
    </Layout>
  );
}
