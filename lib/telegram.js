// Telegram Bot API. Plain-text messages only (no markup), so nothing needs escaping.
export async function send(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing env TELEGRAM_BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (res.ok) return { ok: true };
  // 403 = the driver blocked the bot or deleted the chat; 400 = chat not found.
  return { ok: false, unreachable: res.status === 403 || res.status === 400 };
}

export const botLink = (token) =>
  `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;
