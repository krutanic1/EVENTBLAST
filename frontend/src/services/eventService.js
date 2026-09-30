import api from '../lib/api';

export const eventsApi = {
  getAll: (params = {}) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.patch(`/events/${id}`, data),
  remove: (id) => api.delete(`/events/${id}`),
};

export const healthApi = {
  check: () => api.get('/health'),
};
