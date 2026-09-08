import 'dotenv/config';

// Concurrent-booking race test: N parallel requests for the SAME slot.
// Exactly 1 must succeed (201), the rest 409 — enforced by the
// application check + the Postgres exclusion constraint.
// Usage: BASE_URL=http://localhost:3000 N=20 npx tsx scripts/load-test.ts
// Cleans up the winning booking afterwards.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const N = Number(process.env.N ?? 20);

async function req(path: string, token: string, key: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data as Record<string, unknown> };
}

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 4);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const stamp = Date.now();
  const email = `race-${stamp}@example.com`;
  const reg = await fetch(`${BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', firstName: 'Race', lastName: 'Test' }),
  });
  const { accessToken: token } = (await reg.json()) as { accessToken: string };

  const shops = (await (await fetch(`${BASE}/api/v1/shops?limit=1`)).json()) as { shops: { id: string }[] };
  const shopId = shops.shops[0].id;
  const staff = (await (await fetch(`${BASE}/api/v1/shops/${shopId}/staff`)).json()) as { staff: { id: string }[] };
  const services = (await (await fetch(`${BASE}/api/v1/shops/${shopId}/services`)).json()) as { services: { id: string }[] };
  const payload = {
    shopId,
    staffId: staff.staff[0].id,
    serviceId: services.services[0].id,
    startTime: new Date(`${nextWeekday()}T01:00:00Z`).toISOString(), // 09:00 Manila
  };

  const results = await Promise.all(
    Array.from({ length: N }, (_, i) => req('/api/v1/bookings', token, `race-${stamp}-${i}`, payload))
  );
  const created = results.filter((r) => r.status === 201);
  const conflicted = results.filter((r) => r.status === 409);
  const other = results.filter((r) => r.status !== 201 && r.status !== 409);
  console.log(`racers: ${N} | created: ${created.length} | conflicts: ${conflicted.length} | other: ${other.length}`);
  if (other.length > 0) console.log('unexpected:', other.slice(0, 3));

  // Cleanup: cancel the winner + delete the race user via API-visible paths.
  for (const w of created) {
    const id = (w.body.booking as { id: string }).id;
    await fetch(`${BASE}/api/v1/bookings/${id}/cancel`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
  }

  const pass = created.length === 1 && other.length === 0;
  console.log(pass ? 'RACE TEST PASSED: no double-booking' : 'RACE TEST FAILED');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
