import { NextRequest, NextResponse } from 'next/server';
import { submitOrderToSheets } from '@/lib/sheets-client';
import { getServerConfig, toClientConfig } from '@/lib/config';
import type { SheetsResult } from '@/lib/sheets-client';

const MAX_BODY = 64 * 1024;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

// Last-resort in-memory duplicate guard for identical orderIds posted twice
// within 10s (e.g. double tap racing the button's disabled state). The
// Google Sheet itself is the authoritative idempotency layer.
const recentOrders = new Map<string, number>();
function markRecent(id: string) {
  recentOrders.set(id, Date.now());
  if (recentOrders.size > 200) {
    const now = Date.now();
    for (const [k, t] of recentOrders) if (now - t > 10_000) recentOrders.delete(k);
  }
}
const isRecent = (id: string) => {
  const t = recentOrders.get(id);
  return t !== undefined && Date.now() - t < 10_000;
};

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return json({ ok: false, error: 'Order payload too large.' }, 413);
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'Invalid order payload.' }, 400);
  }

  // Spam honeypot: a real customer never fills this hidden field. Pretend
  // success without touching the sheet so bots don't learn the endpoint.
  if (body.honeypotFilled === true) {
    return json({ ok: true, orderId: body.orderId ?? 'SKIPPED', duplicate: false, honeypot: true });
  }

  const orderId = String(body.orderId ?? '');
  const result: SheetsResult = await submitOrderToSheets(body as never);

  if (result.ok && orderId && !isRecent(orderId)) markRecent(orderId);

  return json(result, result.ok ? 200 : 400);
}

export async function GET() {
  const cfg = getServerConfig();
  const client = toClientConfig(cfg);
  return json({
    ok: true,
    service: 'cafe-mehfile-orders',
    configured: client.orderApiConfigured,
    version: 1,
  });
}