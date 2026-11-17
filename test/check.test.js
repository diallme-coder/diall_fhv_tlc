import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck, daysBetween, feedIsHealthy } from '../lib/check.js';

const TODAY = '2026-11-17';

function setup({ links, active = [], health = { count: 180000, maxUpdated: '2026-11-16' }, prev = null, sendResult = { ok: true } }) {
  const updates = [];
  const sent = [];
  const db = {
    listLinks: async () => links,
    getFeedState: async () => prev,
    setFeedState: async () => {},
    updateLink: async (id, patch) => updates.push([id, patch]),
  };
  const socrata = {
    feedHealth: async () => health,
    fetchLicenses: async () => new Map(active.map((r) => [r.license_number, r])),
  };
  const telegram = { send: async (chat, text) => (sent.push([chat, text]), sendResult) };
  return { db, socrata, telegram, updates, sent };
}

const link = (o = {}) => ({
  user_id: 'u1', license_number: 5000001, status: 'active', missed_checks: 0,
  telegram_chat_id: 111, expiry_alerted_for: null, expiration_date: '2028-01-01', ...o,
});
const rec = (o = {}) => ({ license_number: '5000001', name: 'DOE,JANE', type: 'For Hire Vehicle Driver', expiration_date: '2028-01-01', wheelchair_trained: null, ...o });

test('daysBetween', () => {
  assert.equal(daysBetween('2026-11-17', '2026-12-17'), 30);
  assert.equal(daysBetween('2026-11-17', '2026-11-16'), -1);
});

test('feed health guards', () => {
  assert.equal(feedIsHealthy({ count: 180000, maxUpdated: '2026-11-16' }, null, TODAY), true);
  assert.equal(feedIsHealthy({ count: 500, maxUpdated: '2026-11-16' }, null, TODAY), false); // tiny feed
  assert.equal(feedIsHealthy({ count: 180000, maxUpdated: '2026-11-10' }, null, TODAY), false); // stale
  assert.equal(feedIsHealthy({ count: 100000, maxUpdated: '2026-11-16' }, { row_count: 180000 }, TODAY), false); // big drop
});

test('expiry alert at 30 days, once', async () => {
  const s = setup({ links: [link()], active: [rec({ expiration_date: '2026-12-17' })] });
  const out = await runCheck({ ...s, today: TODAY });
  assert.equal(out.expiryAlerts, 1);
  assert.equal(s.sent.length, 1);
  assert.match(s.sent[0][1], /expires on 2026-12-17/);
  assert.equal(s.updates[0][1].expiry_alerted_for, '2026-12-17');

  const s2 = setup({ links: [link({ expiry_alerted_for: '2026-12-17' })], active: [rec({ expiration_date: '2026-12-17' })] });
  await runCheck({ ...s2, today: TODAY });
  assert.equal(s2.sent.length, 0); // already warned
});

test('no expiry alert at 31 days', async () => {
  const s = setup({ links: [link()], active: [rec({ expiration_date: '2026-12-18' })] });
  await runCheck({ ...s, today: TODAY });
  assert.equal(s.sent.length, 0);
});

test('expiry not marked as alerted when no Telegram chat yet', async () => {
  const s = setup({ links: [link({ telegram_chat_id: null })], active: [rec({ expiration_date: '2026-12-01' })] });
  await runCheck({ ...s, today: TODAY });
  assert.equal(s.sent.length, 0);
  assert.equal(s.updates[0][1].expiry_alerted_for, undefined);
});

test('removal alert only after 2 consecutive misses', async () => {
  const first = setup({ links: [link({ missed_checks: 0 })], active: [] });
  await runCheck({ ...first, today: TODAY });
  assert.equal(first.sent.length, 0);
  assert.equal(first.updates[0][1].missed_checks, 1);

  const second = setup({ links: [link({ missed_checks: 1 })], active: [] });
  const out = await runCheck({ ...second, today: TODAY });
  assert.equal(out.removedAlerts, 1);
  assert.match(second.sent[0][1], /no longer appears/);
  assert.equal(second.updates[0][1].status, 'removed');
});

test('send failure keeps status active so it retries', async () => {
  const s = setup({ links: [link({ missed_checks: 1 })], active: [], sendResult: { ok: false, unreachable: false } });
  const out = await runCheck({ ...s, today: TODAY });
  assert.equal(out.sendFailures, 1);
  assert.equal(s.updates[0][1].status, undefined);
});

test('blocked bot clears the chat id', async () => {
  const s = setup({ links: [link({ missed_checks: 1 })], active: [], sendResult: { ok: false, unreachable: true } });
  await runCheck({ ...s, today: TODAY });
  assert.deepEqual(s.updates[0], ['u1', { telegram_chat_id: null }]);
});

test('back-on-list alert resets status', async () => {
  const s = setup({ links: [link({ status: 'removed', missed_checks: 3 })], active: [rec()] });
  const out = await runCheck({ ...s, today: TODAY });
  assert.equal(out.backAlerts, 1);
  const patch = s.updates.at(-1)[1];
  assert.equal(patch.status, 'active');
  assert.equal(patch.missed_checks, 0);
});

test('unhealthy feed changes nothing and alerts no one', async () => {
  const s = setup({ links: [link({ missed_checks: 1 })], active: [], health: { count: 50, maxUpdated: '2026-11-16' } });
  const out = await runCheck({ ...s, today: TODAY });
  assert.equal(out.feedHealthy, false);
  assert.equal(s.sent.length, 0);
  assert.equal(s.updates.length, 0);
});
