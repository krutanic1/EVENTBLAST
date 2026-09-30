import { useState } from 'react';
import { X, Calendar, MapPin, Users, FileText, Globe } from 'lucide-react';

const INITIAL = {
  title: '',
  description: '',
  eventDate: '',
  location: '',
  isVirtual: false,
  meetingLink: '',
  inviteesRaw: '',
  status: 'draft',
};

export default function EventForm({ initialData, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initialData ? {
    ...INITIAL,
    ...initialData,
    eventDate: initialData.eventDate
      ? new Date(initialData.eventDate).toISOString().slice(0, 16)
      : '',
    inviteesRaw: (initialData.invitees || []).join(', '),
  } : INITIAL);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) =>
    setForm((prev) => ({
      ...prev,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.eventDate) errs.eventDate = 'Event date is required';
    const emails = form.inviteesRaw.split(',').map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) errs.inviteesRaw = 'At least one invitee email is required';
    const invalid = emails.filter((e) => !/^\S+@\S+\.\S+$/.test(e));
    if (invalid.length > 0) errs.inviteesRaw = `Invalid emails: ${invalid.join(', ')}`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      eventDate: new Date(form.eventDate).toISOString(),
      location: form.location.trim(),
      isVirtual: form.isVirtual,
      meetingLink: form.meetingLink.trim(),
      invitees: form.inviteesRaw.split(',').map((e) => e.trim()).filter(Boolean),
      status: form.status,
    };
    onSubmit(payload);
  };

  const Field = ({ label, error, children }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  );

  const inputCls = (err) =>
    `w-full px-3 py-2.5 rounded-lg text-sm bg-surface-700 border ${
      err ? 'border-rose-500/60' : 'border-indigo-500/20'
    } text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Event Title *" error={errors.title}>
        <div className="relative">
          <FileText size={14} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
          <input
            id="event-title"
            className={`${inputCls(errors.title)} pl-9`}
            placeholder="Team Q3 Kickoff"
            value={form.title}
            onChange={set('title')}
          />
        </div>
      </Field>

      <Field label="Description">
        <textarea
          id="event-description"
          className={`${inputCls()} resize-none h-24`}
          placeholder="Add event details…"
          value={form.description}
          onChange={set('description')}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Date & Time *" error={errors.eventDate}>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
            <input
              id="event-date"
              type="datetime-local"
              className={`${inputCls(errors.eventDate)} pl-9`}
              value={form.eventDate}
              onChange={set('eventDate')}
            />
          </div>
        </Field>

        <Field label="Status">
          <select
            id="event-status"
            className={inputCls()}
            value={form.status}
            onChange={set('status')}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
      </div>

      <Field label="Location">
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
          <input
            id="event-location"
            className={`${inputCls()} pl-9`}
            placeholder="Conference Room A or Zoom link"
            value={form.location}
            onChange={set('location')}
          />
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <input
          id="event-virtual"
          type="checkbox"
          className="w-4 h-4 accent-indigo-500 rounded"
          checked={form.isVirtual}
          onChange={set('isVirtual')}
        />
        <label htmlFor="event-virtual" className="text-sm text-slate-400 cursor-pointer flex items-center gap-1.5">
          <Globe size={13} /> Virtual event
        </label>
      </div>

      {form.isVirtual && (
        <Field label="Meeting Link">
          <input
            id="event-meeting-link"
            className={inputCls()}
            placeholder="https://meet.google.com/xxx"
            value={form.meetingLink}
            onChange={set('meetingLink')}
          />
        </Field>
      )}

      <Field label="Invitee Emails * (comma-separated)" error={errors.inviteesRaw}>
        <div className="relative">
          <Users size={14} className="absolute left-3 top-3 text-slate-500 pointer-events-none" />
          <textarea
            id="event-invitees"
            className={`${inputCls(errors.inviteesRaw)} pl-9 resize-none h-20`}
            placeholder="alice@example.com, bob@example.com"
            value={form.inviteesRaw}
            onChange={set('inviteesRaw')}
          />
        </div>
      </Field>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-100 bg-surface-700 border border-indigo-500/20 rounded-lg hover:bg-white/5 transition-all"
          >
            <X size={14} />
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all glow"
          id="event-form-submit"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            initialData ? 'Save Changes' : 'Create Event'
          )}
        </button>
      </div>
    </form>
  );
}
