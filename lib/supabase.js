// Minimal Supabase REST helpers (no SDK, so there is nothing to install).
const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

export async function getUser(accessToken) {
  const res = await fetch(`${need('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: need('SUPABASE_ANON_KEY'), Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.id ? { id: u.id, email: u.email ?? null } : null;
}

export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const key = need('SUPABASE_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${need('SUPABASE_URL')}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]} ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
