import { timingSafeEqual } from 'node:crypto';
import { getUser } from './supabase.js';

export function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns {id, email} for a valid Supabase session token, else null. */
export async function requireUser(req) {
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return token ? getUser(token) : null;
}

/** Shape returned to the browser. Never includes the Telegram chat id or other users' data. */
export function publicLink(link, deepLink, statusText) {
  return {
    license_number: String(link.license_number),
    driver_name: link.driver_name,
    license_type: link.license_type,
    expiration_date: link.expiration_date,
    wheelchair_trained: link.wheelchair_trained,
    status: link.status,
    status_text: statusText,
    telegram_linked: Boolean(link.telegram_chat_id),
    telegram_link: link.telegram_chat_id ? null : deepLink,
  };
}
