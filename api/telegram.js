// Telegram webhook. Set it with the secret_token option so only Telegram can call it (see README).
import { send, safeEqual } from '../lib/http.js';
import { db, newToken } from '../lib/db.js';
import { send as tg } from '../lib/telegram.js';
import { describeStatus } from '../lib/check.js';

const HELP =
  'I send alerts for your TLC FHV license: a warning 30 days before it expires, and a message if it ' +
  'drops off the TLC active drivers list.\n\n' +
  'To connect, sign in on the website and tap "Connect Telegram".\n' +
  'Commands: /status  /stop\n\n' +
  'Unofficial service, not affiliated with the TLC.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!safeEqual(req.headers['x-telegram-bot-api-secret-token'], process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return send(res, 401, { error: 'Unauthorized' });
  }
  try {
    const msg = req.body?.message;
    const chatId = msg?.chat?.id;
    if (!chatId || msg.chat.type !== 'private') return send(res, 200, { ok: true });
    const text = String(msg.text ?? '').trim();

    const start = text.match(/^\/start(?:@\w+)?\s+([a-f0-9]{32})$/i);
    if (start) {
      const link = await db.getLinkByToken(start[1].toLowerCase());
      if (!link) {
        await tg(chatId, 'That link has expired. Open the website and tap "Connect Telegram" again.');
      } else {
        await db.updateLink(link.user_id, { telegram_chat_id: chatId, telegram_token: null });
        await tg(
          chatId,
          `Connected. License ${link.license_number}: ${describeStatus(link)}.\n` +
            "I'll message you 30 days before it expires, or if it drops off the TLC active list.",
        );
      }
    } else if (/^\/stop(?:@\w+)?$/i.test(text)) {
      const link = await db.getLinkByChat(chatId);
      if (link) await db.updateLink(link.user_id, { telegram_chat_id: null, telegram_token: newToken() });
      await tg(chatId, 'Alerts stopped. You can reconnect any time from the website.');
    } else if (/^\/status(?:@\w+)?$/i.test(text)) {
      const link = await db.getLinkByChat(chatId);
      await tg(chatId, link ? `License ${link.license_number}: ${describeStatus(link)}` : HELP);
    } else {
      await tg(chatId, HELP);
    }
    send(res, 200, { ok: true });
  } catch (e) {
    console.error('telegram webhook failed', e.message);
    send(res, 200, { ok: true }); // always 200 so Telegram doesn't retry-storm
  }
}
