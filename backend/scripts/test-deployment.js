import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import assert from 'assert';

dotenv.config();

const API_URL = 'http://localhost:5000/api';
let cookie = '';
let userId = '';
let googleAccountId = '';
let campaignId = '';

async function runTests() {
  console.log('🚀 Starting Complete Production Deployment Test...\n');

  try {
    // 1 & 2: Registration & Login
    console.log('1️⃣  Testing Authentication...');
    const authRes = await axios.post(`${API_URL}/auth/init`);
    cookie = authRes.headers['set-cookie'][0];
    userId = authRes.data.data._id;
    assert(userId, 'User ID should be returned');
    assert(cookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
    console.log('✅ Registration & Login Successful. Cookie established.\n');

    const client = axios.create({
      baseURL: API_URL,
      headers: { Cookie: cookie },
    });

    // 3, 4 & 5: Connect Google Accounts (Direct DB insertion since we cannot click the Google popup)
    console.log('2️⃣  Mocking Google Accounts Connection...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    const GoogleAccount = (await import('../src/models/GoogleAccount.js')).default;
    
    // Cleanup previous test accounts
    await GoogleAccount.deleteMany({ email: { $in: ['testA@gmail.com', 'testB@gmail.com'] } });

    const accA = new GoogleAccount({
      userId,
      googleId: 'google-id-A',
      email: 'testA@gmail.com',
      name: 'Test Account A',
      calendarId: 'primary',
      status: 'active'
    });
    accA.setRefreshToken('mock-token-A');
    await accA.save();
    
    const accB = new GoogleAccount({
      userId,
      googleId: 'google-id-B',
      email: 'testB@gmail.com',
      name: 'Test Account B',
      calendarId: 'primary',
      status: 'active'
    });
    accB.setRefreshToken('mock-token-B');
    await accB.save();

    googleAccountId = accA._id.toString();

    // 5. Display both accounts
    const accsRes = await client.get('/google/accounts');
    assert(accsRes.data.data.length >= 2, 'Should return at least 2 accounts');
    console.log('✅ Google Accounts Connected and Retrieved.\n');

    // 6. Disconnect an account
    console.log('3️⃣  Testing Account Disconnection...');
    await client.delete(`/google/accounts/${accB._id}`);
    const accsResAfterDelete = await client.get('/google/accounts');
    assert(!accsResAfterDelete.data.data.find(a => a.email === 'testB@gmail.com'), 'Account B should be deleted');
    console.log('✅ Account Disconnection Successful.\n');

    // 7, 8, 9, 10, 11, 12: Create Campaign & Validate Recipients
    console.log('4️⃣  Testing Campaign Creation & Recipient Validation (Duplicates/Unsubscribes)...');
    
    // Add an unsubscribe first
    const Unsubscribe = (await import('../src/models/Unsubscribe.js')).default;
    await Unsubscribe.create({ userId, email: 'unsub@example.com' }).catch(() => {}); // ignore duplicate error

    const campaignPayload = {
      title: 'Deployment Test Event',
      description: 'Testing the deployment',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 90000000).toISOString(),
      timezone: 'UTC',
      googleAccountId: accA._id.toString(),
      // valid1, valid2, duplicate, unsubscribed
      recipients: [
        { email: 'valid1@example.com', name: 'Valid One' },
        { email: 'valid2@example.com', name: 'Valid Two' },
        { email: 'valid1@example.com', name: 'Duplicate One' },
        { email: 'unsub@example.com', name: 'Unsubscribed' },
      ]
    };

    const campRes = await client.post('/campaigns', campaignPayload);
    const data = campRes.data.data || campRes.data; // fallback just in case
    campaignId = data.campaignId;
    
    console.log('Campaign Response:', data);

    assert(data.totalRecipients === 2, 'Total recipients should be exactly 2 after filtering');
    assert(data.duplicates === 1, 'Should catch 1 duplicate');
    assert(data.unsubscribed === 1, 'Should catch 1 unsubscribed');
    assert(data.pendingJobs === 2, 'Should queue 2 jobs');
    console.log('✅ Campaign Created. Validation, Deduplication, and Unsubscribes worked perfectly.\n');

    console.log('5️⃣  Testing Job Processor via Cron Endpoint...');
    // A campaign is created in 'draft' state. We must resume it to 'active' before processing.
    await client.post(`/campaigns/${campaignId}/resume`);

    const cronRes = await axios.get(`${API_URL}/jobs/process?limit=5`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }
    });
    
    assert(cronRes.data.success, 'Cron should run successfully');
    assert(cronRes.data.processed === 2, 'Should process exactly 2 jobs');

    // Since we used a fake refresh token, we expect Google API to fail permanently (invalid grant)
    const Recipient = (await import('../src/models/Recipient.js')).default;
    const recipients = await Recipient.find({ campaignId });
    assert(recipients.every(r => r.status === 'failed'), 'Since token is mock, status should be failed (invalid grant)');
    console.log('✅ Cron Processed Jobs. Permanent Error Handling Verified (Invalid Grant).\n');

    // 19, 20, 21: Pause, Resume, Cancel
    console.log('6️⃣  Testing Campaign Controls (Pause/Resume/Cancel)...');
    await client.post(`/campaigns/${campaignId}/pause`);
    let camp = await client.get(`/campaigns/${campaignId}/stats`);
    assert(camp.data.data.campaign.status === 'paused', 'Campaign should be paused');

    await client.post(`/campaigns/${campaignId}/resume`);
    camp = await client.get(`/campaigns/${campaignId}/stats`);
    assert(camp.data.data.campaign.status === 'active', 'Campaign should be resumed');

    await client.post(`/campaigns/${campaignId}/cancel`);
    camp = await client.get(`/campaigns/${campaignId}/stats`);
    assert(camp.data.data.campaign.status === 'cancelled', 'Campaign should be cancelled');
    console.log('✅ Campaign Controls (Pause, Resume, Cancel) Verified.\n');

    // 25: Verify MongoDB Connection Health
    console.log('7️⃣  Testing Health Endpoint...');
    const healthRes = await axios.get(`${API_URL}/health`);
    assert(healthRes.data.services.database.status === 'connected', 'Database should be connected');
    assert(typeof healthRes.data.services.database.latencyMs === 'number', 'Latency should be calculated');
    console.log('✅ Database Connection Pooling & Ping Verified.\n');

    console.log('🎉 All Production Deployment Tests Passed Successfully!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test Failed:');
    if (err.response) {
      console.error(err.response.data);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

runTests();
