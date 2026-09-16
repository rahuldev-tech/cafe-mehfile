// Mock Google Apps Script web app for local E2E testing.
// Reuses the real lib validation so the mock behaves exactly like the
// Node-side authority (the deployed docs/orders-apps-script.gs.txt mirrors
// the same rules, including sizes and add-ons).
//
//   - POST /exec  → validates + stores order, dedupes by orderId (10s TTL)
//   - GET  /exec  → health
//   - DELETE /exec → clears store (test isolation)
//
// Requires Node 22+ with --experimental-strip-types (for the .ts imports).

import http from 'node:http';
import { validateOrderPayload, calcCart } from '../lib/order-core.ts';

const PORT = parseInt(process.env.PORT || '8787', 10);
const LISTEN_PATH = process.env.E2E_PATH && process.env.E2E_PATH.startsWith('/') ? process.env.E2E_PATH : '/exec';

const store = new Map();

function clear() {
  store.clear();
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, ts] of store) {
    if (now - ts > 10_000) store.delete(id);
  }
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

function handleGet(_req, res) {
  sendJson(res, { ok: true, service: 'mock-sheets', version: 1 });
}

function handleDelete(_req, res) {
  clear();
  sendJson(res, { ok: true, cleared: true });
}

function handlePost(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      const expectedToken = process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN || '';
      if (expectedToken && data.token !== expectedToken) {
        return sendJson(res, { ok: false, error: 'Invalid token' }, 400);
      }

      purgeExpired();

      if (!data.orderId || store.has(String(data.orderId))) {
        return sendJson(res, { ok: true, orderId: String(data.orderId), duplicate: true });
      }

      const validation = validateOrderPayload(data);
      if (validation) {
        return sendJson(res, { ok: false, error: validation }, 400);
      }

      store.set(String(data.orderId), Date.now());
      const totals = calcCart(
        data.items.map((it) => ({
          code: it.code,
          name: it.name,
          size: it.size ?? null,
          addOns: it.addOns ?? [],
          qty: it.qty,
          lineNote: it.note ?? '',
        })),
      );
      return sendJson(res, {
        ok: true,
        orderId: String(data.orderId),
        duplicate: false,
        serverTotal: totals.subtotal,
      });
    } catch (err) {
      return sendJson(res, { ok: false, error: 'Server error: ' + (err && err.message ? err.message : String(err)) }, 400);
    }
  });
}

function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== LISTEN_PATH) return sendJson(res, { ok: false, error: 'Not found' }, 404);
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  if (req.method === 'DELETE') return handleDelete(req, res);
  sendJson(res, { ok: false, error: 'Method not allowed' }, 405);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(PORT, () => {
      console.log(`Mock sheets server listening on ${PORT}`);
      resolve(server);
    });
  });
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('mock-sheets-server.mjs') || process.argv[1].endsWith('mock-sheets-server.js'));

if (isDirectRun) {
  startServer();
}

export { store, clear, startServer, PORT, handler };