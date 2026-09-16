// Server-side configuration. NEVER imported from a client component.
// For local/all-in-one w/ .env.local, see .env.local.example.

import type { OpenHours } from './order-core';

export type CafeConfig = {
  whatsappNumber: string;
  upiId: string;
  upiPayee: string;
  upiQrImage: string;
  tableCount: number;
  openHours: readonly OpenHours[];
  webhookUrl: string;
  webhookToken: string;
};

export type ClientConfig = Omit<CafeConfig, 'webhookUrl' | 'webhookToken'> & {
  orderApiConfigured: boolean;
};

function intEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function getServerConfig(): CafeConfig {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL ?? '';
  const webhookToken = process.env.GOOGLE_SHEETS_WEBHOOK_TOKEN ?? '';
  return {
    whatsappNumber: process.env.CAFE_WHATSAPP_NUMBER ?? '919373861759',
    upiId: process.env.CAFE_UPI_ID ?? '',
    upiPayee: process.env.CAFE_UPI_PAYEE ?? 'Cafe Mehfile',
    upiQrImage: process.env.CAFE_UPI_QR_IMAGE ?? '',
    tableCount: intEnv('CAFE_TABLE_COUNT', 20),
    openHours: [{ start: '09:00', end: '22:30' }],
    webhookUrl,
    webhookToken,
  };
}

export function toClientConfig(cfg: CafeConfig): ClientConfig {
  const { webhookUrl, webhookToken, ...rest } = cfg;
  return { ...rest, orderApiConfigured: Boolean(webhookUrl && webhookToken) };
}