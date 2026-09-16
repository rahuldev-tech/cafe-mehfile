// Server-only Google Sheets submission client. Called by the /api/orders route.
// Validates the order against the source menu, attaches the secret token
// (kept server-side), and posts to the Google Apps Script web app.

import { getServerConfig } from './config';
import { validateOrderPayload, type OrderPayload } from './order-core';

export type SheetsResult =
  | { ok: true; orderId: string; duplicate: boolean; serverTotal?: number; honeypot?: boolean }
  | { ok: false; error: string; retryable: boolean };

export function orderApiConfigured(): boolean {
  const cfg = getServerConfig();
  return Boolean(cfg.webhookUrl && cfg.webhookToken);
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export async function submitOrderToSheets(payload: OrderPayload): Promise<SheetsResult> {
  const cfg = getServerConfig();

  const vErr = validateOrderPayload(payload);
  if (vErr) return { ok: false, error: vErr, retryable: false };

  if (!cfg.webhookUrl) {
    return {
      ok: false,
      retryable: false,
      error:
        'Order storage is not connected yet (GOOGLE_SHEETS_WEBHOOK_URL is not set). Please ask the café to finish the setup — nothing was recorded.',
    };
  }
  if (!cfg.webhookToken) {
    return {
      ok: false,
      retryable: false,
      error:
        'Order storage is not configured (GOOGLE_SHEETS_WEBHOOK_TOKEN is not set). Nothing was recorded.',
    };
  }

  // text/plain, not application/json: Apps Script rejects the CORS preflight
  // that application/json triggers, so we send a simple request instead.
  const body = JSON.stringify({ ...(payload as object), token: cfg.webhookToken });

  try {
    const res = await fetchWithTimeout(
      cfg.webhookUrl,
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body },
      18000,
    );

    let data: { ok?: boolean; error?: string; orderId?: string; duplicate?: boolean; serverTotal?: number } | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        retryable: res.status >= 500 || res.status === 429,
        error: data?.error || `The order service responded with ${res.status}. Please retry.`,
      };
    }
    if (data && data.ok === true) {
      return {
        ok: true,
        orderId: data.orderId || payload.orderId,
        duplicate: Boolean(data.duplicate),
        serverTotal: data.serverTotal,
      };
    }
    return {
      ok: false,
      retryable: true,
      error: data?.error || 'The café order sheet did not accept the order. Please retry.',
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      retryable: true,
      error: aborted
        ? 'The café order sheet took too long to respond. Please try again.'
        : 'Network error — please check your internet connection and try again.',
    };
  }
}