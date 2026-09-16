import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderPayload, makeOrderId, type CartLine } from '../lib/order-core.ts';
import { byCode } from '../lib/menu-data.ts';
import { startServer, PORT } from './mock-sheets-server.mjs';

const BASE = `http://127.0.0.1:${PORT}/exec`;
const TOKEN = 'test-webhook-token-123456';

let server: import('node:http').Server;

function line(code: string, qty: number, size: string | null = null, addOns: string[] = []): CartLine {
  const item = byCode.get(code)!;
  return { code, name: item.name, size, addOns, qty, lineNote: '' };
}

function validPayload() {
  const cart: CartLine[] = [line('0-0', 2), line('1-0', 1, 'Full')];
  const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: '' };
  const payload = buildOrderPayload(input, cart, makeOrderId());
  return { ...payload, token: TOKEN };
}

async function clearStore() {
  const res = await fetch(BASE, { method: 'DELETE' });
  assert.equal(res.status, 200);
}

async function postOrder(body: object) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe('mock sheets server integration', () => {
  before(async () => {
    process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN = TOKEN;
    server = await startServer();
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN;
  });

  it('GET /exec returns ok', async () => {
    const res = await fetch(BASE);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'mock-sheets');
  });

  it('POST valid order → ok with serverTotal', async () => {
    await clearStore();
    const { status, json } = await postOrder(validPayload());
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.duplicate, false);
    assert.equal(json.serverTotal, 277);
    assert.match(String(json.orderId), /^ORD-\d{8}-\d{6}-[0-9A-F]{4}$/);
  });

  it('POST order with sized items + add-ons → ok with correct total', async () => {
    await clearStore();
    const cart: CartLine[] = [line('0-0', 2), line('1-0', 1, 'Full', ['ext-cheese']), line('14-9', 1)];
    const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: '' };
    const payload = buildOrderPayload(input, cart, makeOrderId(), byCode);
    const { status, json } = await postOrder({ ...payload, token: TOKEN });
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    // Masala maggie 2×79 + (Full momos 119 + extra cheese 30) + Nutella shake 209
    assert.equal(json.serverTotal, 158 + 149 + 209);
  });

  it('POST duplicate orderId → duplicate true', async () => {
    await clearStore();
    const payload = validPayload();
    const first = await postOrder(payload);
    assert.equal(first.json.ok, true);
    const second = await postOrder(payload);
    assert.equal(second.json.ok, true);
    assert.equal(second.json.duplicate, true);
  });

  it('POST invalid orderId format → error', async () => {
    await clearStore();
    const payload = validPayload();
    const { json } = await postOrder({ ...payload, orderId: 'NOT-A-VALID-ID' });
    assert.equal(json.ok, false);
    assert.ok(String(json.error).length > 0);
  });

  it('POST mismatched total → error', async () => {
    await clearStore();
    const payload = validPayload();
    const { json } = await postOrder({ ...payload, subtotal: Number(payload.subtotal) + 100 });
    assert.equal(json.ok, false);
    assert.match(String(json.error), /mismatch/i);
  });

  it('POST missing token → error', async () => {
    await clearStore();
    const payload = validPayload();
    const { token: _token, ...noToken } = payload;
    const { json } = await postOrder(noToken);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /token/i);
  });

  it('POST unknown item code → error', async () => {
    await clearStore();
    const payload = validPayload();
    payload.items = [{ ...payload.items[0], code: 'zzz-99' }];
    const { json } = await postOrder(payload);
    assert.equal(json.ok, false);
    assert.match(String(json.error), /unknown/i);
  });
});