import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Sparkles, Calendar, Clock, Globe, Users, Upload,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronDown,
  FileText, Trash2, ArrowRight, Info, Star, Edit3,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useGoogleAccounts } from '../hooks/useGoogleAccounts';
import { parseCSV, analyseCSV, buildFinalRecipients } from '../lib/csvParser';
import api from '../lib/api';

// ─── Constants ────────────────────────────────────────────
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Sao_Paulo',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Pacific/Fiji',
];

const STORED_USER_ID = () => localStorage.getItem('eventblast_userId') || '';

// ─── Shared input styles ──────────────────────────────────
const inputCls = (err) =>
  `w-full px-3.5 py-2.5 rounded-xl text-sm bg-surface-700 border ${
    err ? 'border-rose-500/50 focus:border-rose-400/70' : 'border-indigo-500/20 focus:border-indigo-500/50'
  } text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all`;

// ─── Section wrapper ──────────────────────────────────────
function Section({ step, title, subtitle, children }) {
  return (
    <div className="glass rounded-2xl border border-indigo-500/15 overflow-hidden">
      <div className="px-6 py-4 border-b border-indigo-500/10 flex items-center gap-3">
        <span className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
          {step}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────
function Field({ label, error, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-400 flex items-center gap-1"><XCircle size={11}/>{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
    </div>
  );
}

// ─── Google Account picker ────────────────────────────────
function AccountPicker({ accounts, loading, value, onChange, error }) {
  if (loading) return <div className="skeleton h-20 rounded-xl" />;
  if (accounts.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-amber-900/10 border border-amber-500/20 text-amber-300 text-sm">
        <AlertCircle size={15} className="flex-shrink-0" />
        <span>
          No active Google accounts connected.{' '}
          <a href="/dashboard/accounts" className="underline hover:text-amber-200 transition-colors">
            Connect one first
          </a>
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${error ? 'ring-1 ring-rose-500/30 rounded-xl' : ''}`}>
      {accounts
        .filter((a) => a.status === 'active')
        .map((account) => {
          const isSelected = value === account._id;
          return (
            <button
              key={account._id}
              type="button"
              onClick={() => onChange(account._id)}
              id={`account-select-${account._id}`}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                  : 'bg-surface-700/50 border-indigo-500/10 hover:border-indigo-500/25 hover:bg-white/3'
              }`}
            >
              {/* Radio indicator */}
              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600'
              }`}>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>

              {/* Google G */}
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{account.name || account.email}</p>
                <p className="text-xs text-slate-500 truncate">{account.email}</p>
              </div>

              {account.calendarName && (
                <span className="flex items-center gap-1 text-xs text-indigo-400/70 flex-shrink-0">
                  <Calendar size={10} />
                  {account.calendarName}
                </span>
              )}

              {isSelected && <Star size={13} className="text-indigo-400 flex-shrink-0" fill="currentColor" />}
            </button>
          );
        })}
    </div>
  );
}

// ─── CSV Dropzone ─────────────────────────────────────────
function CSVDropzone({ onFile, isDragOver, onDragEnter, onDragLeave, onDrop }) {
  const inputRef = useRef(null);

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center py-10 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
        isDragOver
          ? 'border-indigo-500/70 bg-indigo-600/10'
          : 'border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-600/5'
      }`}
      id="csv-dropzone"
    >
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-all ${
        isDragOver ? 'bg-indigo-600/20 border border-indigo-500/40' : 'bg-surface-700 border border-indigo-500/15'
      }`}>
        <Upload size={22} className={isDragOver ? 'text-indigo-400' : 'text-slate-500'} />
      </div>
      <p className="text-sm font-medium text-slate-300 mb-1">
        {isDragOver ? 'Drop your CSV here' : 'Upload recipient CSV'}
      </p>
      <p className="text-xs text-slate-600 text-center">
        Drag & drop or <span className="text-indigo-400 underline underline-offset-2">browse</span> · Max 10 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        id="csv-file-input"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}

// ─── Analysis stat chip ───────────────────────────────────
function StatChip({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-900/30 border-emerald-700/30 text-emerald-300',
    rose:    'bg-rose-900/30    border-rose-700/30    text-rose-300',
    amber:   'bg-amber-900/30   border-amber-700/30   text-amber-300',
    indigo:  'bg-indigo-900/30  border-indigo-700/30  text-indigo-300',
    slate:   'bg-slate-800/60   border-slate-700/30   text-slate-400',
  };
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl border ${colors[color]}`}>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

// ─── Analysis panel ───────────────────────────────────────
function AnalysisPanel({ stats, checkingUnsub, fileName, onClear }) {
  const { totalRows, validRows, invalidRows, duplicateRows, uniqueRows, unsubscribed, finalCount } = stats;

  return (
    <div className="mt-4 space-y-4 fade-in">
      {/* File badge */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-700/60 border border-indigo-500/10 rounded-xl">
        <div className="flex items-center gap-2.5 text-sm text-slate-300">
          <FileText size={14} className="text-indigo-400" />
          <span className="font-medium truncate max-w-xs">{fileName}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-slate-600 hover:text-rose-400 transition-colors"
          title="Remove file"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-4 gap-2">
        <StatChip label="Uploaded"    value={totalRows}             color="slate"   />
        <StatChip label="Valid"       value={validRows.length}      color="emerald" />
        <StatChip label="Invalid"     value={invalidRows.length}    color={invalidRows.length > 0 ? 'rose' : 'slate'} />
        <StatChip label="Duplicates"  value={duplicateRows.length}  color={duplicateRows.length > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Detail rows */}
      <div className="space-y-2 text-sm">
        <DetailRow icon={CheckCircle2} color="emerald" label={`Valid: ${validRows.length} email${validRows.length !== 1 ? 's' : ''} ready for processing`} />

        {invalidRows.length > 0 && (
          <DetailRow icon={XCircle} color="rose"
            label={`Invalid: ${invalidRows.length} format error${invalidRows.length !== 1 ? 's' : ''}`}
            sub={invalidRows.slice(0, 5).map((r) => r.email).join(', ') + (invalidRows.length > 5 ? ` +${invalidRows.length - 5} more` : '')}
          />
        )}

        {duplicateRows.length > 0 && (
          <DetailRow icon={AlertCircle} color="amber" label={`Duplicates: ${duplicateRows.length} removed`} />
        )}

        <DetailRow
          icon={checkingUnsub ? RefreshCw : AlertCircle}
          color={unsubscribed?.length > 0 ? 'rose' : 'slate'}
          label={
            checkingUnsub
              ? 'Checking unsubscribe list…'
              : `Unsubscribed: ${unsubscribed?.length || 0} excluded`
          }
          iconSpin={checkingUnsub}
        />
      </div>

      {/* Final count */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-xl border ${
        finalCount > 0
          ? 'bg-indigo-600/10 border-indigo-500/30'
          : 'bg-rose-900/10 border-rose-500/20'
      }`}>
        <div className="flex items-center gap-2.5">
          <Users size={16} className={finalCount > 0 ? 'text-indigo-400' : 'text-rose-400'} />
          <span className="text-sm font-semibold text-slate-200">Ready</span>
        </div>
        <span className={`text-3xl font-bold ${finalCount > 0 ? 'text-indigo-300' : 'text-rose-300'}`}>
          {checkingUnsub ? '…' : finalCount}
        </span>
      </div>

      {finalCount === 0 && !checkingUnsub && (
        <p className="text-xs text-rose-400 text-center">
          No valid recipients after filtering. Please upload a different CSV.
        </p>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, color, label, sub, iconSpin }) {
  const colors = {
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
    amber:   'text-amber-400',
    slate:   'text-slate-600',
  };
  return (
    <div className="flex items-start gap-2.5 text-slate-400">
      <Icon size={14} className={`flex-shrink-0 mt-0.5 ${colors[color]} ${iconSpin ? 'animate-spin' : ''}`} />
      <div>
        <span className="text-sm">{label}</span>
        {sub && <p className="text-xs text-slate-600 mt-0.5 font-mono">{sub}</p>}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function NewCampaignPage() {
  const navigate   = useNavigate();
  const userId     = STORED_USER_ID();
  const { accounts, loading: accsLoading } = useGoogleAccounts(userId);

  // ── Form state ───────────────────────────────────────────
  const [form, setForm] = useState({
    title:           '',
    description:     '',
    date:            '',
    startTime:       '',
    endTime:         '',
    timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    googleAccountId: '',
  });
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // ── CSV state ────────────────────────────────────────────
  const [csvFileName,   setCsvFileName]   = useState('');
  const [csvStats,      setCsvStats]      = useState(null);
  const [checkingUnsub, setCheckingUnsub] = useState(false);
  const [unsubscribed,  setUnsubscribed]  = useState([]);
  const [finalRecipients, setFinalRecipients] = useState([]);
  const [isDragOver,    setIsDragOver]    = useState(false);
  const [inputMode,     setInputMode]     = useState('upload'); // 'upload' | 'paste'
  const [pastedEmails,  setPastedEmails]  = useState('');

  // Auto-select first active account
  useEffect(() => {
    if (!form.googleAccountId && accounts.length > 0) {
      const active = accounts.find((a) => a.status === 'active');
      if (active) setForm((f) => ({ ...f, googleAccountId: active._id }));
    }
  }, [accounts]);

  // ── Field helpers ─────────────────────────────────────────
  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // ── CSV handling ──────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors((e) => ({ ...e, csv: 'File must be under 10 MB' }));
      return;
    }
    if (!file.name.endsWith('.csv')) {
      setErrors((e) => ({ ...e, csv: 'Only .csv files are accepted' }));
      return;
    }

    setErrors((e) => ({ ...e, csv: '' }));
    setCsvFileName(file.name);
    setUnsubscribed([]);
    setFinalRecipients([]);

    const text  = await file.text();
    const rows  = parseCSV(text);
    const stats = analyseCSV(rows);
    setCsvStats(stats);

    // Check unsubscribe list if we have valid unique rows + a userId
    if (stats.uniqueRows.length > 0 && userId) {
      setCheckingUnsub(true);
      try {
        const res = await api.post(
          '/campaigns/validate-recipients',
          { emails: stats.uniqueRows.map((r) => r.email) },
          { params: { userId } }
        );
        const unsub = res.data.data.unsubscribed || [];
        setUnsubscribed(unsub);
        setFinalRecipients(buildFinalRecipients(stats.uniqueRows, unsub));
      } catch {
        // Non-fatal — just skip the unsub check
        setFinalRecipients(stats.uniqueRows);
      } finally {
        setCheckingUnsub(false);
      }
    } else {
      setFinalRecipients(stats.uniqueRows);
    }
  }, [userId]);

  const processPastedEmails = useCallback(async () => {
    if (!pastedEmails.trim()) {
      setErrors((e) => ({ ...e, csv: 'Please enter at least one email' }));
      return;
    }
    setErrors((e) => ({ ...e, csv: '' }));
    
    // Extract all emails using regex (handles commas, spaces, newlines)
    const matches = pastedEmails.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    
    setCsvFileName('Pasted Emails');
    setUnsubscribed([]);
    setFinalRecipients([]);

    const rows = matches.map(email => ({ email: email.toLowerCase(), name: '' }));
    const stats = analyseCSV(rows);
    setCsvStats(stats);

    if (stats.uniqueRows.length > 0 && userId) {
      setCheckingUnsub(true);
      try {
        const res = await api.post(
          '/campaigns/validate-recipients',
          { emails: stats.uniqueRows.map((r) => r.email) },
          { params: { userId } }
        );
        const unsub = res.data.data.unsubscribed || [];
        setUnsubscribed(unsub);
        setFinalRecipients(buildFinalRecipients(stats.uniqueRows, unsub));
      } catch {
        setFinalRecipients(stats.uniqueRows);
      } finally {
        setCheckingUnsub(false);
      }
    } else {
      setFinalRecipients(stats.uniqueRows);
    }
  }, [pastedEmails, userId]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const clearCSV = () => {
    setCsvFileName('');
    setCsvStats(null);
    setUnsubscribed([]);
    setFinalRecipients([]);
    setPastedEmails('');
    setErrors((e) => ({ ...e, csv: '' }));
  };

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.title.trim())          errs.title  = 'Event title is required';
    if (!form.date)                  errs.date   = 'Date is required';
    if (!form.startTime)             errs.startTime = 'Start time is required';
    if (!form.endTime)               errs.endTime   = 'End time is required';
    if (!form.timezone)              errs.timezone  = 'Timezone is required';
    if (!form.googleAccountId)       errs.googleAccountId = 'Please select a Google account';
    if (!csvFileName)                errs.csv    = 'Please upload a recipient CSV';
    if (finalRecipients.length === 0 && csvFileName)
                                     errs.csv    = 'No valid recipients after filtering';

    if (form.date && form.startTime && form.endTime) {
      const start = new Date(`${form.date}T${form.startTime}`);
      const end   = new Date(`${form.date}T${form.endTime}`);
      if (end <= start) errs.endTime = 'End time must be after start time';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError('');

    try {
      const startISO = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endISO   = new Date(`${form.date}T${form.endTime}`).toISOString();

      const payload = {
        title:           form.title.trim(),
        description:     form.description.trim(),
        startTime:       startISO,
        endTime:         endISO,
        timezone:        form.timezone,
        googleAccountId: form.googleAccountId,
        recipients:      finalRecipients,
      };

      const res = await api.post('/campaigns', payload, { params: { userId } });
      const campaignId = res.data.data.campaignId;
      navigate(`/dashboard/campaigns/${campaignId}/review`);
    } catch (err) {
      setServerError(err.message);
      setSubmitting(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────
  const statsForPanel = csvStats
    ? {
        ...csvStats,
        unsubscribed,
        finalCount: checkingUnsub ? '…' : finalRecipients.length,
      }
    : null;

  const canSubmit =
    !submitting && !checkingUnsub &&
    form.title && form.date && form.startTime && form.endTime &&
    form.googleAccountId && finalRecipients.length > 0;

  // ─────────────────────────────────────────────────────────
  return (
    <Layout
      title="New Campaign"
      subtitle="Configure your event invitation campaign"
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-5 pb-10" noValidate>

        {/* Server error */}
        {serverError && (
          <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-rose-500/20 bg-rose-900/10 text-rose-300 text-sm fade-in">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            {serverError}
          </div>
        )}

        {/* ── 1. Event Details ── */}
        <Section step="1" title="Event Details" subtitle="What is this calendar invitation about?">
          <div className="space-y-4">
            <Field label="Event Title" required error={errors.title}>
              <input
                id="campaign-title"
                className={inputCls(errors.title)}
                placeholder="Q3 Kickoff · Team All-Hands · Product Launch"
                value={form.title}
                onChange={set('title')}
                maxLength={300}
              />
            </Field>

            <Field label="Description">
              <textarea
                id="campaign-description"
                className={`${inputCls()} resize-none h-28`}
                placeholder="Add an agenda, joining instructions, or any relevant notes for attendees…"
                value={form.description}
                onChange={set('description')}
                maxLength={5000}
              />
              <p className="mt-1 text-right text-xs text-slate-700">
                {form.description.length}/5000
              </p>
            </Field>
          </div>
        </Section>

        {/* ── 2. Date & Time ── */}
        <Section step="2" title="Date & Time" subtitle="When does the event take place?">
          <div className="space-y-4">
            <Field label="Date" required error={errors.date}>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="campaign-date"
                  type="date"
                  className={`${inputCls(errors.date)} pl-9`}
                  value={form.date}
                  onChange={set('date')}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Time" required error={errors.startTime}>
                <div className="relative">
                  <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="campaign-start-time"
                    type="time"
                    className={`${inputCls(errors.startTime)} pl-9`}
                    value={form.startTime}
                    onChange={set('startTime')}
                  />
                </div>
              </Field>

              <Field label="End Time" required error={errors.endTime}>
                <div className="relative">
                  <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="campaign-end-time"
                    type="time"
                    className={`${inputCls(errors.endTime)} pl-9`}
                    value={form.endTime}
                    onChange={set('endTime')}
                  />
                </div>
              </Field>
            </div>

            <Field label="Timezone" required error={errors.timezone}>
              <div className="relative">
                <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <select
                  id="campaign-timezone"
                  className={`${inputCls(errors.timezone)} pl-9 pr-9 appearance-none`}
                  value={form.timezone}
                  onChange={set('timezone')}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 3. Google Account ── */}
        <Section
          step="3"
          title="Google Calendar Organiser"
          subtitle="Which connected account will create and send the calendar invitations?"
        >
          <Field error={errors.googleAccountId}>
            <AccountPicker
              accounts={accounts}
              loading={accsLoading}
              value={form.googleAccountId}
              onChange={(id) => setForm((f) => ({ ...f, googleAccountId: id }))}
              error={errors.googleAccountId}
            />
          </Field>

          {!userId && (
            <p className="mt-3 text-xs text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={12} />
              Set your User ID in Settings to load connected accounts.
            </p>
          )}
        </Section>

        {/* ── 4. Recipients ── */}
        <Section
          step="4"
          title="Recipients"
          subtitle="Upload a CSV with one recipient per row. Duplicates and unsubscribes are filtered automatically."
        >
          {/* Format hint */}
          <div className="mb-4 px-4 py-3 rounded-xl bg-indigo-600/5 border border-indigo-500/10 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2 font-medium text-slate-400 mb-1.5">
              <Info size={12} className="text-indigo-400" />
              Required CSV format
            </div>
            <div className="font-mono bg-surface-800 rounded-lg px-3 py-2 text-slate-400 space-y-0.5">
              <p className="text-slate-600">email,name</p>
              <p>john@example.com,John Smith</p>
              <p>mary@example.com,Mary Jones</p>
            </div>
            <p className="pt-1">Header row is optional — it's detected and skipped automatically.</p>
          </div>

          {/* Dropzone or analysis */}
          {!csvFileName ? (
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex bg-surface-700/50 p-1 rounded-xl border border-indigo-500/10 w-fit">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    inputMode === 'upload' ? 'bg-indigo-600/20 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload size={14} /> Upload CSV
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    inputMode === 'paste' ? 'bg-indigo-600/20 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Edit3 size={14} /> Paste Emails
                </button>
              </div>

              {inputMode === 'upload' ? (
                <CSVDropzone
                  onFile={processFile}
                  isDragOver={isDragOver}
                  onDragEnter={() => setIsDragOver(true)}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                />
              ) : (
                <div className="space-y-3 fade-in">
                  <textarea
                    className={`${inputCls()} h-32 resize-none`}
                    placeholder="john@example.com, mary@example.com&#10;or paste a list separated by newlines..."
                    value={pastedEmails}
                    onChange={(e) => setPastedEmails(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={processPastedEmails}
                    disabled={!pastedEmails.trim() || checkingUnsub}
                    className="btn-secondary w-full"
                  >
                    Process Emails
                  </button>
                </div>
              )}
            </div>
          ) : (
            statsForPanel && (
              <AnalysisPanel
                stats={statsForPanel}
                checkingUnsub={checkingUnsub}
                fileName={csvFileName}
                onClear={clearCSV}
              />
            )
          )}

          {errors.csv && (
            <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
              <XCircle size={12} /> {errors.csv}
            </p>
          )}
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={!canSubmit}
            id="review-campaign-btn"
            className={`flex items-center gap-2.5 px-7 py-3 text-sm font-semibold rounded-xl transition-all ${
              canSubmit
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white glow'
                : 'bg-surface-700 border border-indigo-500/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Review Campaign
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>

        {/* Readiness summary */}
        {(form.title || csvFileName) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { label: 'Event details',  ok: !!form.title && !!form.date },
              { label: 'Date & time',    ok: !!form.startTime && !!form.endTime },
              { label: 'Google account', ok: !!form.googleAccountId },
              { label: 'Recipients',     ok: finalRecipients.length > 0 },
            ].map(({ label, ok }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                  ok
                    ? 'bg-emerald-900/15 border-emerald-700/25 text-emerald-400'
                    : 'bg-surface-700/50 border-indigo-500/10 text-slate-600'
                }`}
              >
                {ok
                  ? <CheckCircle2 size={12} />
                  : <div className="w-3 h-3 rounded-full border border-slate-600" />}
                {label}
              </div>
            ))}
          </div>
        )}
      </form>
    </Layout>
  );
}
