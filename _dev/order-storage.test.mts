import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderPayload, makeOrderId, type CartLine } from '../lib/order-core.ts';
import { byCode } from '../lib/menu-data.ts';
import { startServer, PORT } from './mock-sheets-server.mjs';

const BASE = `http://127.0.0.1:${PORT}/exec`;
const TOKEN = 'test-storage-token-xyz';

let server: import('node:http').Server;

function line(code: string, qty: number, size: string | null = null, addOns: string[] = []): CartLine {
  const item = byCode.get(code)!;
  return { code, name: item.name, size, addOns, qty, lineNote: '' };
}

function validPayload(orderId?: string) {
  const cart: CartLine[] = [line('0-0', 2), line('1-0', 1, 'Full', ['ext-cheese']), line('14-9', 1)];
  const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: 'Extra napkins' };
  const payload = buildOrderPayload(input, cart, orderId ?? makeOrderId());
  return { ...payload, token: TOKEN };
}

async function clearStore() {
  await fetch(BASE, { method: 'DELETE' });
}

async function postOrder(body: object) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('Order storage — full lifecycle', () => {
  before(async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN = TOKEN;
    server = await startServer();
    await clearStore();
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN;
  });

  // ── Health ──────────────────────────────────────────────
  it('GET returns healthy status', async () => {
    const res = await fetch(BASE);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.service, 'mock-sheets');
  });

  it('DELETE clears the store', async () => {
    await postOrder(validPayload());
    const clearRes = await fetch(BASE, { method: 'DELETE' });
    assert.equal(clearRes.status, 200);
    const clearData = (await clearRes.json()) as Record<string, unknown>;
    assert.equal(clearData.ok, true);
  });

  it('returns 404 for wrong path', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/wrong`);
    assert.equal(res.status, 404);
  });

  it('returns 405 for unsupported method', async () => {
    const res = await fetch(BASE, { method: 'PUT' });
    assert.equal(res.status, 405);
  });

  // ── Valid orders ────────────────────────────────────────
  it('stores a valid order and returns ok with serverTotal', async () => {
    await clearStore();
    const payload = validPayload();
    const { status, json } = await postOrder(payload);
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.duplicate, false);
    assert.match(String(json.orderId), /^ORD-/);
    assert.equal(json.serverTotal, 516);
  });

  it('returns the stored orderId in the response', async () => {
    await clearStore();
    const id = makeOrderId();
    const { json } = await postOrder(validPayload(id));
    assert.equal(json.ok, true);
    assert.equal(json.orderId, id);
  });

  // ── Duplicate detection ────────────────────────────────
  it('same orderId returns duplicate: true', async () => {
    await clearStore();
    const payload = validPayload();
    await postOrder(payload);
    const { json } = await postOrder(payload);
    assert.equal(json.ok, true);
    assert.equal(json.duplicate, true);
    assert.equal(json.serverTotal, undefined);
  });

  it('different orderId succeeds', async () => {
    await clearStore();
    const { json } = await postOrder(validPayload(makeOrderId()));
    assert.equal(json.ok, true);
    assert.equal(json.duplicate, false);
  });

  // ── Validation errors ──────────────────────────────────
  it('rejects invalid orderId format', async () => {
    await clearStore();
    const { status, json } = await postOrder({ ...validPayload(), orderId: 'NOT-A-VALID-ID' });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /order id/i);
  });

  it('rejects missing customer name', async () => {
    const { status, json } = await postOrder({ ...validPayload(), customerName: '' });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /customer name/i);
  });

  it('rejects invalid phone number', async () => {
    const { status, json } = await postOrder({ ...validPayload(), whatsappNumber: '12345' });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /mobile number/i);
  });

  it('rejects empty items array', async () => {
    const { status, json } = await postOrder({ ...validPayload(), items: [] });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /no items/i);
  });

  it('rejects unknown item code', async () => {
    const p = validPayload();
    p.items = [{ ...p.items[0], code: 'zzz-99' }];
    const { status, json } = await postOrder(p);
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /unknown item/i);
  });

  it('rejects subtotal mismatch', async () => {
    const { status, json } = await postOrder({ ...validPayload(), subtotal: 99999 });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /mismatch/i);
  });

  it('rejects total mismatch', async () => {
    const p = validPayload();
    const { status, json } = await postOrder({ ...p, total: p.total + 50 });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /mismatch/i);
  });

  // ── Token auth ──────────────────────────────────────────
  it('rejects order with wrong token', async () => {
    const { status, json } = await postOrder({ ...validPayload(), token: 'wrong-token' });
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /token/i);
  });

  it('rejects order with missing token', async () => {
    const { token: _, ...noToken } = validPayload();
    const { status, json } = await postOrder(noToken);
    assert.equal(status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /token/i);
  });

  // ── serverTotal accuracy ───────────────────────────────
  it('computes serverTotal without add-ons', async () => {
    await clearStore();
    const cart: CartLine[] = [line('0-0', 3)];
    const input = { name: 'Test', phone: '9876543210', table: 'T01', orderType: 'Dine-in' as const, note: '' };
    const { json } = await postOrder({ ...buildOrderPayload(input, cart, makeOrderId()), token: TOKEN });
    assert.equal(json.ok, true);
    assert.equal(json.serverTotal, 237);
  });

  it('computes serverTotal with add-ons', async () => {
    await clearStore();
    const cart: CartLine[] = [line('0-0', 1, null, ['ext-cheese', 'ext-mayo'])];
    const input = { name: 'Test', phone: '9876543210', table: 'T01', orderType: 'Dine-in' as const, note: '' };
    const { json } = await postOrder({ ...buildOrderPayload(input, cart, makeOrderId()), token: TOKEN });
    assert.equal(json.ok, true);
    assert.equal(json.serverTotal, 129);
  });

  it('computes serverTotal for sized items', async () => {
    await clearStore();
    const cart: CartLine[] = [line('1-0', 2, 'Half')];
    const input = { name: 'Test', phone: '9876543210', table: 'T01', orderType: 'Dine-in' as const, note: '' };
    const { json } = await postOrder({ ...buildOrderPayload(input, cart, makeOrderId()), token: TOKEN });
    assert.equal(json.ok, true);
    // Veg momos Half = 109, Full = 119
    assert.equal(json.serverTotal, 218); // 2 × 109
  });

  it('computes serverTotal for multiple mixed items', async () => {
    await clearStore();
    const cart: CartLine[] = [line('0-0', 2), line('1-0', 1, 'Full', ['ext-cheese']), line('14-9', 1)];
    const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: '' };
    const { json } = await postOrder({ ...buildOrderPayload(input, cart, makeOrderId()), token: TOKEN });
    assert.equal(json.ok, true);
    assert.equal(json.serverTotal, 516);
  });

  // ── Malformed requests ──────────────────────────────────
  it('rejects invalid JSON body', async () => {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not-json{{{',
    });
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 400);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /json|invalid/i);
  });

  it('rejects empty body', async () => {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '',
    });
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 400);
    assert.equal(json.ok, false);
  });

  // ── Batch / stress ─────────────────────────────────────
  it('stores 5 different orders successfully', async () => {
    await clearStore();
    for (let i = 0; i < 5; i++) {
      const { json } = await postOrder(validPayload(makeOrderId()));
      assert.equal(json.ok, true);
      assert.equal(json.duplicate, false);
    }
  });

  it('detects duplicates in rapid succession', async () => {
    await clearStore();
    const id = makeOrderId();
    const payload = validPayload(id);
    const results = await Promise.all([postOrder(payload), postOrder(payload), postOrder(payload)]);
    const duplicates = results.filter((r) => r.json.duplicate === true);
    assert.ok(duplicates.length >= 1, 'at least one duplicate expected');
  });
});
