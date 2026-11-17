// Daily job. Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
import { send, safeEqual } from '../lib/http.js';
import { db } from '../lib/db.js';
import * as socrata from '../lib/socrata.js';
import * as telegram from '../lib/telegram.js';
import { runCheck } from '../lib/check.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 500, { error: 'CRON_SECRET is not set' });
  const auth = String(req.headers.authorization ?? '');
  if (!safeEqual(auth, `Bearer ${secret}`)) return send(res, 401, { error: 'Unauthorized' });
  try {
    const summary = await runCheck({ db, socrata, telegram, log: console.log });
    console.log('daily check', JSON.stringify(summary));
    send(res, 200, summary);
  } catch (e) {
    console.error('daily check failed', e.message);
    send(res, 500, { error: 'Daily check failed' });
  }
}
