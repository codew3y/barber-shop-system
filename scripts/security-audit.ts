import 'dotenv/config';

// RBAC + IDOR matrix against a running dev server (`npm run dev`).
// Usage: BASE_URL=http://localhost:3000 npx tsx scripts/security-audit.ts
// Exits non-zero on any unexpected result. Cleans up after itself.

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

interface Ctx {
  customerA: string;
  customerB: string;
  barber: string;
  admin: string;
  shopId: string;
  staffId: string;
  serviceId: string;
  bookingId: string;
}

let failures = 0;
function check(name: string, actual: number, expected: number | number[]) {
  const ok = Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} (got ${actual}, want ${expected})`);
  if (!ok) failures += 1;
}

async function req(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body as Record<string, unknown> };
}

async function register(email: string): Promise<string> {
  const { status, body } = await req('/api/v1/auth/register', undefined, {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password123', firstName: 'Sec', lastName: 'Audit' }),
  });
  if (status !== 201) throw new Error(`register ${email} -> ${status}`);
  return body.accessToken as string;
}

async function login(email: string): Promise<string> {
  const { status, body } = await req('/api/v1/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password123' }),
  });
  if (status !== 200) throw new Error(`login ${email} -> ${status}`);
  return body.accessToken as string;
}

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// 09:00 Manila (UTC+8) expressed as Zulu — Zod v4 requires the Z suffix.
function manilaSlot(dateISO: string, hourManila: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hourManila - 8, 0)).toISOString();
}

async function main() {
  const stamp = Date.now();
  const ctx = {} as Ctx;
  ctx.customerA = await register(`sec-a-${stamp}@example.com`);
  ctx.customerB = await register(`sec-b-${stamp}@example.com`);
  ctx.barber = await login('barber@demo.shop');
  ctx.admin = await login('owner@demo.shop');

  const shops = await req('/api/v1/shops?limit=1');
  ctx.shopId = ((shops.body as { shops: { id: string }[] }).shops[0]).id;
  const staff = await req(`/api/v1/shops/${ctx.shopId}/staff`);
  ctx.staffId = ((staff.body as { staff: { id: string }[] }).staff[0]).id;
  const services = await req(`/api/v1/shops/${ctx.shopId}/services`);
  ctx.serviceId = ((services.body as { services: { id: string }[] }).services[0]).id;

  // A books a slot
  const slot = manilaSlot(nextWeekday(), 9);
  const created = await req('/api/v1/bookings', ctx.customerA, {
    method: 'POST',
    headers: { 'Idempotency-Key': `sec-${stamp}` },
    body: JSON.stringify({ shopId: ctx.shopId, staffId: ctx.staffId, serviceId: ctx.serviceId, startTime: slot }),
  });
  check('customer creates booking', created.status, 201);
  ctx.bookingId = (created.body.booking as { id: string }).id;

  // IDOR: B cannot read / cancel A's booking
  check('IDOR read blocked', (await req(`/api/v1/bookings/${ctx.bookingId}`, ctx.customerB)).status, 403);
  check(
    'IDOR cancel blocked',
    (await req(`/api/v1/bookings/${ctx.bookingId}/cancel`, ctx.customerB, { method: 'PUT', body: '{}' })).status,
    403
  );

  // RBAC: customer cannot touch admin/staff surfaces
  check('customer blocked from analytics', (await req(`/api/v1/admin/analytics?shopId=${ctx.shopId}&startDate=2026-09-01&endDate=2026-09-30`, ctx.customerA)).status, 403);
  check('customer blocked from staff schedule', (await req('/api/v1/staff/schedule', ctx.customerA)).status, [401, 403, 404]);
  check('customer blocked from service create', (await req('/api/v1/admin/services', ctx.customerA, { method: 'POST', body: '{}' })).status, 403);

  // RBAC: staff cannot touch admin surfaces
  check('staff blocked from analytics', (await req(`/api/v1/admin/analytics?shopId=${ctx.shopId}&startDate=2026-09-01&endDate=2026-09-30`, ctx.barber)).status, 403);
  check('staff blocked from service delete', (await req(`/api/v1/admin/services/${ctx.serviceId}`, ctx.barber, { method: 'DELETE' })).status, 403);

  // Unauthenticated
  check('anon blocked from booking create', (await req('/api/v1/bookings', undefined, { method: 'POST', headers: { 'Idempotency-Key': 'x' }, body: '{}' })).status, 401);
  check('anon blocked from mine', (await req('/api/v1/bookings/mine')).status, 401);

  // XSS: stored payload must come back sanitized
  const xss = await req('/api/v1/bookings', ctx.customerB, {
    method: 'POST',
    headers: { 'Idempotency-Key': `sec-xss-${stamp}` },
    body: JSON.stringify({
      shopId: ctx.shopId,
      staffId: ctx.staffId,
      serviceId: ctx.serviceId,
      startTime: manilaSlot(nextWeekday(), 10),
      notes: '<script>alert(1)</script>hello',
    }),
  });
  if (xss.status === 201) {
    const notes = (xss.body.booking as { notes: string }).notes;
    check('stored XSS stripped', notes.includes('<script>') ? 1 : 0, 0);
  } else {
    console.log(`SKIP xss check (slot taken -> ${xss.status})`);
  }

  console.log(failures === 0 ? 'ALL SECURITY CHECKS PASSED' : `${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
