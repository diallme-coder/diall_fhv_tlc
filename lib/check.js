// The daily job. All I/O is injected so it can be tested with fakes.

export const etToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now); // YYYY-MM-DD

export function daysBetween(fromYmd, toYmd) {
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(toYmd) - t(fromYmd)) / 86400000);
}

export const EXPIRY_WARNING_DAYS = 30;
export const MISSED_CHECKS_BEFORE_ALERT = 2;

/** Skip the run if the feed looks stale or suspiciously smaller, so a TLC glitch never alerts everyone. */
export function feedIsHealthy(health, prev, today) {
  if (!health.maxUpdated || health.count < 1000) return false;
  if (daysBetween(today, health.maxUpdated) < -2) return false;
  if (prev?.row_count && health.count < prev.row_count * 0.9) return false;
  return true;
}

export const messages = {
  expiring: (l, days) =>
    `Heads up: your TLC FHV license ${l.license_number} expires on ${l.expiration_date} ` +
    `(${days} day${days === 1 ? '' : 's'} from now). Start your renewal with the TLC soon.`,
  removed: (l) =>
    `Your TLC FHV license ${l.license_number} no longer appears on the TLC active drivers list. ` +
    `This can mean a suspension, an expired or unrenewed license, or another status change. ` +
    `Check your status with the TLC directly: nyc.gov/tlc`,
  back: (l) =>
    `Good news: license ${l.license_number} is back on the TLC active drivers list` +
    (l.expiration_date ? ` (expires ${l.expiration_date}).` : '.'),
};

export async function runCheck({ db, socrata, telegram, today = etToday(), log = () => {} }) {
  const summary = { links: 0, feedHealthy: null, expiryAlerts: 0, removedAlerts: 0, backAlerts: 0, sendFailures: 0 };
  const links = await db.listLinks();
  summary.links = links.length;
  if (!links.length) return summary;

  const health = await socrata.feedHealth();
  const prev = await db.getFeedState();
  summary.feedHealthy = feedIsHealthy(health, prev, today);
  if (!summary.feedHealthy) {
    log('feed unhealthy, skipping run', health, prev);
    return summary;
  }
  await db.setFeedState({ row_count: health.count, max_updated: health.maxUpdated });

  const found = await socrata.fetchLicenses(links.map((l) => l.license_number));

  // 'sent' | 'no_chat' (nothing to deliver to yet) | 'failed' (retry on the next run)
  async function notify(link, text) {
    if (!link.telegram_chat_id) return 'no_chat';
    const res = await telegram.send(link.telegram_chat_id, text);
    if (res.ok) return 'sent';
    summary.sendFailures++;
    if (res.unreachable) {
      await db.updateLink(link.user_id, { telegram_chat_id: null });
      return 'no_chat';
    }
    return 'failed';
  }

  for (const link of links) {
    const rec = found.get(String(link.license_number));
    const patch = { last_checked_at: new Date().toISOString() };

    if (!rec) {
      patch.missed_checks = link.missed_checks + 1;
      if (patch.missed_checks >= MISSED_CHECKS_BEFORE_ALERT && link.status === 'active') {
        const r = await notify(link, messages.removed(link));
        if (r !== 'failed') patch.status = 'removed';
        if (r === 'sent') summary.removedAlerts++;
      }
    } else {
      patch.missed_checks = 0;
      patch.license_type = rec.type;
      patch.expiration_date = rec.expiration_date;
      patch.wheelchair_trained = rec.wheelchair_trained;
      const merged = { ...link, ...patch };

      if (link.status === 'removed') {
        const r = await notify(link, messages.back(merged));
        if (r !== 'failed') patch.status = 'active';
        if (r === 'sent') summary.backAlerts++;
      }

      if (rec.expiration_date) {
        const days = daysBetween(today, rec.expiration_date);
        if (days >= 0 && days <= EXPIRY_WARNING_DAYS && link.expiry_alerted_for !== rec.expiration_date) {
          const r = await notify(link, messages.expiring(merged, days));
          if (r === 'sent') {
            patch.expiry_alerted_for = rec.expiration_date;
            summary.expiryAlerts++;
          }
        }
      }
    }
    await db.updateLink(link.user_id, patch);
  }
  return summary;
}

/** Plain-language status line, used on the website and by the bot's /status command. */
export function describeStatus(link, today = etToday()) {
  if (link.status === 'removed') return 'Not on the TLC active list';
  if (!link.expiration_date) return 'Active';
  const d = daysBetween(today, link.expiration_date);
  if (d < 0) return `Active list shows an expiration date in the past (${link.expiration_date})`;
  return `Active, expires ${link.expiration_date} (${d} days)`;
}
