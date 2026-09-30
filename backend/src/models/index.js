/**
 * Barrel export for all Mongoose models.
 *
 * Import pattern:
 *   import { User, Campaign, Recipient } from '../models/index.js';
 */

export { default as Event         } from './Event.js';
export { default as User          } from './User.js';
export { default as GoogleAccount } from './GoogleAccount.js';
export { default as Campaign      } from './Campaign.js';
export { default as Recipient     } from './Recipient.js';
export { default as SendJob       } from './SendJob.js';
export { default as Unsubscribe   } from './Unsubscribe.js';
