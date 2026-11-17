// Public values the browser needs. The anon key is designed to be public; tables are locked by RLS.
import { send } from '../lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return send(res, 500, { error: 'Server is not configured' });
  }
  send(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}
