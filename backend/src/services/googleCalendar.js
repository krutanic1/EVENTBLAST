import { google } from 'googleapis';
import crypto from 'crypto';
import { decrypt } from '../lib/crypto.js';

/**
 * Deterministically generates a valid Google Calendar Event ID.
 * Google requires: lowercase base32hex (a-v, 0-9), length 5 to 1024.
 * A sha256 hash in hex (0-9, a-f) fits this requirement perfectly.
 * 
 * We generate it deterministically based on Campaign ID + (first) Recipient ID
 * to prevent creating duplicate events on the Google side if the application
 * crashes and retries.
 */
function generateDeterministicEventId(campaignId, recipientId) {
  const input = `${campaignId}-${recipientId}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Create a calendar event for the specified recipients.
 * 
 * @param {Object} params
 * @param {Object} params.googleAccount - The GoogleAccount document (must include encrypted refresh token)
 * @param {Object} params.campaign - The Campaign document
 * @param {Array<Object>} params.recipients - Array of Recipient documents to invite
 * @returns {Promise<{ eventId: string, htmlLink: string }>}
 */
export async function createCalendarEvent({ googleAccount, campaign, recipients }) {
  try {
    // ── Step 1: Check refresh token ──────────────────────────
    console.log('[GCal] Step 1: checking refreshTokenEncrypted');
    if (!googleAccount.refreshTokenEncrypted) {
      throw new Error('Google Account is missing a refresh token.');
    }

    // ── Step 2: Decrypt the refresh token ────────────────────
    console.log('[GCal] Step 2: decrypting refresh token');
    const refreshToken = decrypt(googleAccount.refreshTokenEncrypted);

    // ── Step 3: Init OAuth2 client ───────────────────────────
    console.log('[GCal] Step 3: init oauth2 client');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // ── Step 4: Init Calendar API ────────────────────────────
    console.log('[GCal] Step 4: init calendar api');
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // ── Step 5: Build attendees list ─────────────────────────
    console.log('[GCal] Step 5: building attendees, count:', recipients.length);
    const attendees = recipients.map((r) => ({
      email: r.email,
      displayName: r.name || undefined,
    }));

    // ── Step 6: Generate deterministic event ID ──────────────
    console.log('[GCal] Step 6: generating event ID');
    console.log('[GCal]   campaign._id:', campaign._id, 'type:', typeof campaign._id);
    const primaryRecipient = recipients.length > 0 ? recipients[0] : null;
    const primaryRecipientId = primaryRecipient
      ? (primaryRecipient._id ? primaryRecipient._id.toString() : primaryRecipient.email)
      : 'empty';
    console.log('[GCal]   primaryRecipientId:', primaryRecipientId);
    const eventId = generateDeterministicEventId(campaign._id.toString(), primaryRecipientId);
    console.log('[GCal]   eventId:', eventId);

    // ── Step 7: Build event params ───────────────────────────
    console.log('[GCal] Step 7: building eventParams');
    console.log('[GCal]   isAllDay:', campaign.isAllDay, 'startTime:', campaign.startTime, 'endTime:', campaign.endTime);
    const eventParams = {
      calendarId: googleAccount.calendarId || 'primary',
      sendUpdates: 'all',
      requestBody: {
        id: eventId,
        summary: campaign.title,
        description: campaign.description,
        start: campaign.isAllDay
          ? { date: new Date(campaign.startTime).toISOString().split('T')[0] }
          : {
              dateTime: new Date(campaign.startTime).toISOString(),
              timeZone: campaign.timezone,
            },
        end: campaign.isAllDay
          ? { date: new Date(new Date(campaign.endTime).getTime() + 86400000).toISOString().split('T')[0] }
          : {
              dateTime: new Date(campaign.endTime).toISOString(),
              timeZone: campaign.timezone,
            },
        attendees,
        transparency: 'transparent',
        guestsCanSeeOtherGuests: campaign.guestsCanSeeOtherGuests ?? false,
      },
    };

    // ── Step 8: Insert Event ─────────────────────────────────
    console.log('[GCal] Step 8: calling calendar.events.insert');
    try {
      const res = await calendar.events.insert(eventParams);
      console.log('[GCal] Step 8: success, eventId:', res.data.id);
      return {
        success: true,
        eventId: res.data.id,
        htmlLink: res.data.htmlLink,
      };
    } catch (insertErr) {
      // ── 409 Conflict: event already exists ──────────────────
      // This happens when a previous attempt timed out after Google
      // created the event but before we received the response.
      // The email was already sent — treat this as a success.
      if (insertErr.code === 409) {
        console.log('[GCal] Step 8: 409 conflict — event already exists, treating as success');
        // Try to fetch the existing event to get its htmlLink
        try {
          const existing = await calendar.events.get({
            calendarId: googleAccount.calendarId || 'primary',
            eventId,
          });
          return {
            success: true,
            eventId: existing.data.id,
            htmlLink: existing.data.htmlLink,
          };
        } catch {
          // Can't fetch it, but we know it exists — still a success
          return { success: true, eventId, htmlLink: null };
        }
      }

      console.error('[GCal] ERROR:', insertErr.message);
      console.error('[GCal] STACK:', insertErr.stack);
      return {
        success: false,
        error: insertErr.message || 'Failed to create Google Calendar event',
        code: insertErr.code,
      };
    }

  } catch (err) {
    console.error('[GCal] ERROR:', err.message);
    console.error('[GCal] STACK:', err.stack);
    return {
      success: false,
      error: err.message || 'Failed to create Google Calendar event',
      code: err.code,
    };
  }
}
