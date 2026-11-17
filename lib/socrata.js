// Live queries against the NYC Open Data (Socrata) FHV Active Drivers dataset.
const BASE = 'https://data.cityofnewyork.us/resource/xjfq-wh2d.json';
const LICENSE_RE = /^\d{4,9}$/;

export function isValidLicense(v) {
  return LICENSE_RE.test(String(v));
}

async function query(params) {
  const url = `${BASE}?${new URLSearchParams(params)}`;
  const headers = { Accept: 'application/json' };
  if (process.env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Socrata ${res.status}`);
  return res.json();
}

const day = (ts) => (ts ? String(ts).slice(0, 10) : null);

function shape(r) {
  return {
    license_number: String(r.license_number),
    name: r.name ?? '',
    type: r.type ?? null,
    expiration_date: day(r.expiration_date),
    wheelchair_trained: r.wheelchair_accessible_trained ?? null,
  };
}

/** Map<licenseNumberString, record> for the licenses currently on the active list. */
export async function fetchLicenses(numbers) {
  const clean = [...new Set(numbers.map(String))].filter(isValidLicense);
  const out = new Map();
  for (let i = 0; i < clean.length; i += 200) {
    const chunk = clean.slice(i, i + 200);
    const rows = await query({
      $where: `license_number in (${chunk.join(',')})`,
      $limit: '1000',
    });
    for (const r of rows) out.set(String(r.license_number), shape(r));
  }
  return out;
}

export async function fetchLicense(number) {
  const m = await fetchLicenses([number]);
  return m.get(String(number)) ?? null;
}

/** Row count and newest update date of the whole feed. */
export async function feedHealth() {
  const [r] = await query({ $select: 'count(*) as n, max(last_date_updated) as m' });
  return { count: Number(r?.n ?? 0), maxUpdated: day(r?.m) };
}
