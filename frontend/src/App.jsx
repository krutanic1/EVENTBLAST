import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from './lib/api';
import Dashboard          from './pages/Dashboard';
import EventsPage         from './pages/EventsPage';
import NewEventPage       from './pages/NewEventPage';
import EventDetailPage    from './pages/EventDetailPage';
import EditEventPage      from './pages/EditEventPage';
import SettingsPage       from './pages/SettingsPage';
import AccountsPage       from './pages/AccountsPage';
import NewCampaignPage    from './pages/NewCampaignPage';
import CampaignReviewPage from './pages/CampaignReviewPage';
import CampaignsPage      from './pages/CampaignsPage';
import RecipientsPage     from './pages/RecipientsPage';

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Automatically issue/refresh the HTTP-only JWT cookie 
    // This is a demo stand-in for a real login flow.
    api.post('/auth/init')
      .then((res) => {
        localStorage.setItem('eventblast_userId', res.data.data._id);
      })
      .catch(console.error)
      .finally(() => setAuthReady(true));
  }, []);

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-900 text-indigo-400">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                                      element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"                             element={<Dashboard />} />
        <Route path="/dashboard/campaigns"                   element={<CampaignsPage />} />
        <Route path="/dashboard/recipients"                  element={<RecipientsPage />} />
        <Route path="/events"                                element={<EventsPage />} />
        <Route path="/events/new"                            element={<NewEventPage />} />
        <Route path="/events/:id"                            element={<EventDetailPage />} />
        <Route path="/events/:id/edit"                       element={<EditEventPage />} />
        <Route path="/dashboard/accounts"                    element={<AccountsPage />} />
        <Route path="/dashboard/campaigns/new"               element={<NewCampaignPage />} />
        <Route path="/dashboard/campaigns/:id/review"        element={<CampaignReviewPage />} />
        <Route path="/settings"                              element={<SettingsPage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
