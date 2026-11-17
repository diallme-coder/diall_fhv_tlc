import { send, requireUser, publicLink } from '../lib/http.js';
import { db, newToken } from '../lib/db.js';
import { botLink } from '../lib/telegram.js';
import { describeStatus } from '../lib/check.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (!user) return send(res, 401, { error: 'Please sign in first.' });

    if (req.method === 'DELETE') {
      await db.deleteLink(user.id); // removes the license link, Telegram link and all stored data
      return send(res, 200, { deleted: true });
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

    let link = await db.getLink(user.id);
    if (!link) return send(res, 200, { email: user.email, link: null });

    // Hand out a fresh one-time Telegram token if the driver isn't linked and has none.
    if (!link.telegram_chat_id && !link.telegram_token) {
      const token = newToken();
      await db.updateLink(user.id, { telegram_token: token });
      link = { ...link, telegram_token: token };
    }
    const deep = link.telegram_token ? botLink(link.telegram_token) : null;
    send(res, 200, { email: user.email, link: publicLink(link, deep, describeStatus(link)) });
  } catch (e) {
    console.error('me failed', e.message);
    send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
