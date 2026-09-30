import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function reset() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const SendJob = (await import('./src/models/SendJob.js')).default;
  const Recipient = (await import('./src/models/Recipient.js')).default;
  await SendJob.updateMany({ status: 'failed' }, { $set: { status: 'pending', attempts: 0 } });
  await Recipient.updateMany({ status: 'failed' }, { $set: { status: 'pending', attempts: 0 } });
  console.log('Reset complete');
  process.exit(0);
}
reset();
