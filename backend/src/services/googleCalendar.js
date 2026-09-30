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
  if (!googleAccount.refreshTokenEncrypted) {
    throw new Error('Google Account is missing a refresh token.');
  }

  // 1. Decrypt the refresh token
  const refreshToken = decrypt(googleAccount.refreshTokenEncrypted);

  // 2. Initialise the OAuth2 Client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // 3. Initialise the Calendar API Client
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // 4. Prepare Event Details
  const attendees = recipients.map((r) => ({
    email: r.email,
    displayName: r.name || undefined,
  }));

  // Create deterministic ID based on campaign and the primary recipient
  // (Assuming typical 1:1 send job per recipient, or deterministic for the batch)
  const primaryRecipientId = recipients.length > 0 ? recipients[0]._id.toString() : 'empty';
  const eventId = generateDeterministicEventId(campaign._id.toString(), primaryRecipientId);

  const eventParams = {
    calendarId: googleAccount.calendarId || 'primary',
    sendUpdates: 'all', // Send email notifications to attendees
    requestBody: {
      id: eventId,
      summary: campaign.title,
      description: campaign.description,
      start: {
        dateTime: new Date(campaign.startTime).toISOString(),
        timeZone: campaign.timezone,
      },
      end: {
        dateTime: new Date(campaign.endTime).toISOString(),
        timeZone: campaign.timezone,
      },
      attendees: attendees,
      // Default to transparent so the organizer isn't marked as "busy" for thousands of events
      // if they do 1:1 sends.
      transparency: 'transparent',
    },
  };

  try {
    // 5. Insert Event
    const res = await calendar.events.insert(eventParams);
    
    return {
      success: true,
      eventId: res.data.id,
      htmlLink: res.data.htmlLink,
    };
  } catch (err) {
    // Handle specific Google API errors gracefully if possible
    return {
      success: false,
      error: err.message || 'Failed to create Google Calendar event',
      code: err.code,
    };
  }
}
