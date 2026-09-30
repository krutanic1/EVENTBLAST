import { Event, User, GoogleAccount, Campaign, Recipient, SendJob, Unsubscribe } from '../src/models/index.js';

const models = { Event, User, GoogleAccount, Campaign, Recipient, SendJob, Unsubscribe };

for (const [name, Model] of Object.entries(models)) {
  const paths = Object.keys(Model.schema.paths).filter((p) => !p.startsWith('_'));
  console.log(`✅  ${name.padEnd(15)} — ${paths.length} fields: ${paths.slice(0, 7).join(', ')}…`);
}

console.log('\n✅  All 7 models loaded and schemas compiled successfully.\n');
