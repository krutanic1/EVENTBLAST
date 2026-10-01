import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

/**
 * Manages Google accounts for the given userId.
 * Provides: accounts list, loading/error state, connect(), disconnect(), setActive().
 *
 * "Active" account is persisted to localStorage only — it is the account
 * that will be pre-selected when creating a new campaign.
 */
export function useGoogleAccounts(userId) {
  const [accounts,  setAccounts]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [activeId,  setActiveId]  = useState(
    () => localStorage.getItem('eventblast_active_google_account') || null
  );

  // ── Fetch ────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/google/accounts', { params: { userId } });
      setAccounts(res.data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // ── Connect ──────────────────────────────────────────────
  // Full browser redirect — backend generates OAuth URL and sends 302 to Google.
  // React is NOT involved in the OAuth exchange.
  const connect = useCallback(() => {
    if (!userId) {
      throw new Error('No userId — save your User ID in Settings first.');
    }
    window.location.href = `${api.defaults.baseURL}/google/auth?userId=${encodeURIComponent(userId)}&frontendUrl=${encodeURIComponent(window.location.origin)}`;
  }, [userId]);

  // ── Disconnect ───────────────────────────────────────────
  const disconnect = useCallback(async (accountId) => {
    await api.delete(`/google/accounts/${accountId}`, { params: { userId } });
    setAccounts((prev) => prev.filter((a) => a._id !== accountId));
    // Clear active if this was it
    if (activeId === accountId) {
      setActiveId(null);
      localStorage.removeItem('eventblast_active_google_account');
    }
  }, [userId, activeId]);

  // ── Set Active ────────────────────────────────────────────
  // Marks one account as the default for campaign sends.
  // Stored only in localStorage — no refresh token involved.
  const setActive = useCallback((accountId) => {
    setActiveId(accountId);
    localStorage.setItem('eventblast_active_google_account', accountId);
  }, []);

  return {
    accounts,
    loading,
    error,
    activeId,
    refetch: fetchAccounts,
    connect,
    disconnect,
    setActive,
  };
}
