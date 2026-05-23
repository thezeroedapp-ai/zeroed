const { onRequest }  = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const app            = require('./server');
const db             = require('./db/database');
const { syncAllAccounts } = require('./services/plaidService');
const payoffEngine   = require('./services/payoffEngine');

// HTTPS function — all /api/* requests
exports.api = onRequest(app);

// Scheduled daily sync at 8am CT
exports.dailySync = onSchedule({ schedule: '0 8 * * *', timeZone: 'America/Chicago' }, async () => {
  console.log('[dailySync] Starting…');
  try {
    const users = await db.getAllUsers();
    for (const u of users) {
      const result   = await syncAllAccounts(u.uid);
      const accounts = (await db.getAccountsByUser(u.uid)).filter(a => a.type === 'credit');
      const alerts   = payoffEngine.checkAlerts(accounts);
      console.log(`[dailySync] ${u.uid}: ${result.accounts} accounts, ${result.transactions} txs. ${alerts.length} alert(s)`);
    }
  } catch (err) {
    console.error('[dailySync] Failed:', err.message);
  }
});
