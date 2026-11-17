import { randomBytes } from 'node:crypto';
import { rest } from './supabase.js';

export const newToken = () => randomBytes(16).toString('hex');
const eq = (v) => encodeURIComponent(v);

export const db = {
  async listLinks() {
    return rest('driver_links?select=*&order=created_at.asc&limit=100000');
  },
  async getLink(userId) {
    const rows = await rest(`driver_links?user_id=eq.${eq(userId)}&select=*`);
    return rows[0] ?? null;
  },
  async getLinkByToken(token) {
    const rows = await rest(`driver_links?telegram_token=eq.${eq(token)}&select=*`);
    return rows[0] ?? null;
  },
  async getLinkByChat(chatId) {
    const rows = await rest(`driver_links?telegram_chat_id=eq.${eq(chatId)}&select=*`);
    return rows[0] ?? null;
  },
  async upsertLink(row) {
    const rows = await rest('driver_links?on_conflict=user_id', {
      method: 'POST',
      body: row,
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0];
  },
  async updateLink(userId, patch) {
    await rest(`driver_links?user_id=eq.${eq(userId)}`, { method: 'PATCH', body: patch });
  },
  async deleteLink(userId) {
    await rest(`driver_links?user_id=eq.${eq(userId)}`, { method: 'DELETE' });
  },
  async recentFailures(userId, sinceIso) {
    const rows = await rest(
      `claim_attempts?user_id=eq.${eq(userId)}&ok=eq.false&at=gte.${eq(sinceIso)}&select=id&limit=10`,
    );
    return rows.length;
  },
  async logAttempt(userId, ok) {
    await rest('claim_attempts', { method: 'POST', body: { user_id: userId, ok } });
  },
  async getFeedState() {
    const rows = await rest('feed_state?id=eq.1&select=*');
    return rows[0] ?? null;
  },
  async setFeedState({ row_count, max_updated }) {
    await rest('feed_state?on_conflict=id', {
      method: 'POST',
      body: { id: 1, row_count, max_updated, checked_at: new Date().toISOString() },
      prefer: 'resolution=merge-duplicates',
    });
  },
};
