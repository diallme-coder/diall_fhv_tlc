import { send, requireUser, publicLink } from '../lib/http.js';
import { db, newToken } from '../lib/db.js';
import { fetchLicense, isValidLicense } from '../lib/socrata.js';
import { nameMatches } from '../lib/names.js';
import { botLink } from '../lib/telegram.js';
import { describeStatus } from '../lib/check.js';

const MAX_FAILURES_PER_HOUR = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    if (!user) return send(res, 401, { error: 'Please sign in first.' });

    const license = String(req.body?.license_number ?? '').trim();
    const name = String(req.body?.name ?? '').trim().slice(0, 100);
    if (!isValidLicense(license) || name.length < 3) {
      return send(res, 400, { error: 'Enter your FHV license number (digits only) and your full name.' });
    }

    const since = new Date(Date.now() - 3600_000).toISOString();
    if ((await db.recentFailures(user.id, since)) >= MAX_FAILURES_PER_HOUR) {
      return send(res, 429, { error: 'Too many attempts. Please try again in an hour.' });
    }

    const rec = await fetchLicense(license);
    if (!rec || !nameMatches(name, rec.name)) {
      await db.logAttempt(user.id, false);
      return send(res, 404, {
        error:
          "We couldn't match that license number and name on the TLC active drivers list. " +
          'Check both, or your license may not currently be active.',
      });
    }
    await db.logAttempt(user.id, true);

    const existing = await db.getLink(user.id);
    const row = {
      user_id: user.id,
      license_number: Number(license),
      driver_name: rec.name,
      license_type: rec.type,
      expiration_date: rec.expiration_date,
      wheelchair_trained: rec.wheelchair_trained,
      status: 'active',
      missed_checks: 0,
      last_checked_at: new Date().toISOString(),
    };
    if (existing && String(existing.license_number) !== license) row.expiry_alerted_for = null;
    if (!existing?.telegram_chat_id && !existing?.telegram_token) row.telegram_token = newToken();

    const link = await db.upsertLink(row);
    send(res, 200, publicLink(link, link.telegram_token ? botLink(link.telegram_token) : null, describeStatus(link)));
  } catch (e) {
    console.error('claim failed', e.message);
    send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
