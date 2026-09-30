import { useState, useEffect, useCallback } from 'react';
import { eventsApi } from '../services/eventService';

export function useEvents(initialPage = 1, pageSize = 10) {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.getAll({ page, limit: pageSize });
      setEvents(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = async (data) => {
    const res = await eventsApi.create(data);
    await fetchEvents();
    return res.data.data;
  };

  const updateEvent = async (id, data) => {
    const res = await eventsApi.update(id, data);
    setEvents((prev) =>
      prev.map((e) => (e._id === id ? res.data.data : e))
    );
    return res.data.data;
  };

  const deleteEvent = async (id) => {
    await eventsApi.remove(id);
    setEvents((prev) => prev.filter((e) => e._id !== id));
    setPagination((prev) => ({ ...prev, total: prev.total - 1 }));
  };

  return {
    events,
    pagination,
    page,
    setPage,
    loading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
