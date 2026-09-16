// Pure ordering logic — no DOM, no env. Shared by the browser UI, the Next.js
// API route, and Node tests. TypeScript here is intentionally "erasable"
// (types/interfaces only) so Node can run it directly with
// `node --experimental-strip-types`.

import { MENU_ITEMS, byCode, type MenuItem } from './menu-data.ts';

export type AddOn = { code: string; name: string; price: number };

/** Add-ons offered on every item in the detail sheet. One-time per cart line
 *  (formula: Item Total = Qty × Item Price + Add-ons). */
export const ADD_ONS: readonly AddOn[] = [
  { code: 'ext-cheese', name: 'Extra cheese', price: 30 },
  { code: 'ext-paneer', name: 'Extra paneer', price: 30 },
  { code: 'ext-icecream', name: 'Extra ice cream (1 cube)', price: 30 },
  { code: 'ext-mayo', name: 'Mayonnaise', price: 20 },
  { code: 'ext-schezwan', name: 'Schezwan sauce', price: 20 },
];

export const ADD_ON_BY_CODE = new Map<string, AddOn>(ADD_ONS.map((a) => [a.code, a]));

export type CartLine = {
  code: string;
  name: string;
  size: string | null;
  addOns: string[];
  qty: number;
  lineNote: string;
};

export type CartRow = {
  line: CartLine;
  item: MenuItem;
  unit: number;
  addOnTotal: number;
  addOnLabels: string[];
  lineTotal: number;
  label: string;
  sub: string;
};

export type CartTotals = { rows: CartRow[]; subtotal: number; count: number };

export type OrderItem = {
  code: string;
  name: string;
  size: string | null;
  qty: number;
  addOns: string[];
  note: string;
  unitPrice: number;
  lineTotal: number;
};

export type OrderPayload = {
  orderId: string;
  customerName: string;
  whatsappNumber: string;
  tableNumber: string;
  orderType: 'Dine-in' | 'Pickup';
  items: OrderItem[];
  customizations: string;
  specialInstructions: string;
  subtotal: number;
  total: number;
  paymentStatus: 'Pending';
  orderStatus: 'Placed';
};

export type CheckoutInput = {
  name: string;
  phone: string;
  table: string;
  orderType: 'Dine-in' | 'Pickup';
  note: string;
};

export type FieldErrors = Partial<
  Record<'name' | 'phone' | 'table' | 'note' | 'cart', string>
>;

export type TableParsed =
  | { ok: true; table: string; num: number }
  | { ok: false; table: null; state: 'missing' | 'invalid' };

export type OpenHours = { start: string; end: string };

// ────────────────────────────────────────────────────────────
// Formatting
// ────────────────────────────────────────────────────────────
export function rup(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ────────────────────────────────────────────────────────────
// Table number handling
// ────────────────────────────────────────────────────────────
export function tableLabel(num: number): string {
  return 'T' + String(num).padStart(2, '0');
}

export function parseTable(raw: string | null | undefined, count: number): TableParsed {
  if (raw === null || raw === undefined) return { ok: false, table: null, state: 'missing' };
  let s = String(raw).trim().replace(/\s+/g, '');
  if (!s) return { ok: false, table: null, state: 'missing' };
  s = s.replace(/^table/i, '').replace(/^tbl/i, '');
  s = s.replace(/^t/i, '');
  if (!/^\d+$/.test(s) || s.length > 4) return { ok: false, table: null, state: 'invalid' };
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > count) {
    return { ok: false, table: null, state: 'invalid' };
  }
  return { ok: true, table: tableLabel(n), num: n };
}

export function tableOptions(count: number, withTakeaway = true): string[] {
  const opts = Array.from({ length: count }, (_, i) => tableLabel(i + 1));
  return withTakeaway ? ['Takeaway', ...opts] : opts;
}

// ────────────────────────────────────────────────────────────
// Phone number handling (Indian, 10-digit mobile)
// ────────────────────────────────────────────────────────────
export function normalizePhone(raw: string): { ok: boolean; phone: string; reason?: string } {
  let s = String(raw || '').replace(/[\s.\-()]/g, '');
  if (s.startsWith('+91')) s = s.slice(3);
  else if (/^91\d{10}$/.test(s)) s = s.slice(2);
  else if (s.startsWith('0') && /^0[6-9]\d{9}$/.test(s)) s = s.slice(1);
  if (/^[6-9]\d{9}$/.test(s)) return { ok: true, phone: s };
  return { ok: false, phone: s, reason: 'valid 10-digit mobile number required' };
}

// ────────────────────────────────────────────────────────────
// Order id (unique, human-readable, stable across retries)
// ────────────────────────────────────────────────────────────
function randomToken(len: number): string {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const b = new Uint8Array(Math.ceil(len / 2));
    c.getRandomValues(b);
    return Array.from(b)
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, len)
      .toUpperCase();
  }
  let out = '';
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out.toUpperCase();
}

const p2 = (n: number) => String(n).padStart(2, '0');

export function makeOrderId(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = p2(d.getMonth() + 1);
  const day = p2(d.getDate());
  const h = p2(d.getHours());
  const min = p2(d.getMinutes());
  const sec = p2(d.getSeconds());
  return `ORD-${y}${m}${day}-${h}${min}${sec}-${randomToken(4)}`;
}

// ────────────────────────────────────────────────────────────
// Pricing (always recomputed from the source menu — never from the UI)
// ────────────────────────────────────────────────────────────
export function unitPrice(item: MenuItem, size: string | null): number | null {
  if (!item.sizes) return item.price;
  if (!size) return null;
  const s = item.sizes.find((x) => x.label === size);
  return s ? s.price : null;
}

export function addOnTotal(codes: string[]): number {
  return (codes || []).reduce((t, c) => {
    const a = ADD_ON_BY_CODE.get(c);
    return t + (a ? a.price : 0);
  }, 0);
}

export function addOnLabels(codes: string[]): string[] {
  return (codes || []).map((c) => {
    const a = ADD_ON_BY_CODE.get(c);
    return a ? a.name : '';
  }).filter(Boolean);
}

export function lineTotal(item: MenuItem, size: string | null, addOns: string[], qty: number): { unit: number; lineTotal: number; ok: boolean } {
  const unit = unitPrice(item, size);
  if (unit === null) return { unit: 0, lineTotal: 0, ok: false };
  const q = clampQty(qty);
  return { unit, lineTotal: q * unit + addOnTotal(addOns), ok: true };
}

export function clampQty(q: number): number {
  return Math.max(1, Math.min(50, Math.round(q || 1)));
}

/** Merge key — same item+size+add-ons collapse into one cart line (note is
 *  informational and overwritten on edit, so it is NOT part of the key). */
export function cartLineKey(item: MenuItem, size: string | null, addOns: string[]): string {
  return `${item.code}::${size || ''}::${[...addOns].sort().join('|')}`;
}

export function cartRow(line: CartLine, item: MenuItem): CartRow | null {
  const price = lineTotal(item, line.size, line.addOns, line.qty);
  if (!price.ok) return null;
  const labels = addOnLabels(line.addOns);
  const label = line.size ? `${item.name} (${line.size})` : item.name;
  const sub =
    labels.length > 0
      ? `${line.qty} × ${rup(price.unit)} + ${labels.join(', ')}`
      : `${line.qty} × ${rup(price.unit)}`;
  return {
    line,
    item,
    unit: price.unit,
    addOnTotal: price.lineTotal - price.unit * clampQty(line.qty),
    addOnLabels: labels,
    lineTotal: price.lineTotal,
    label,
    sub,
  };
}

export function calcCart(lines: readonly CartLine[]): CartTotals {
  const rows: CartRow[] = [];
  let subtotal = 0;
  let count = 0;
  for (const line of lines) {
    const item = byCode.get(line.code);
    if (!item) continue;
    const row = cartRow(line, item);
    if (!row) continue;
    subtotal += row.lineTotal;
    count += clampQty(line.qty);
    rows.push(row);
  }
  return { rows, subtotal, count };
}

/** Drop unknown/duplicated/out-of-range lines on cart hydration and recompute
 *  unit prices from source data (never trust a stored price). */
export function sanitizeCart(lines: readonly CartLine[]): CartLine[] {
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (const raw of lines) {
    const item = byCode.get(String(raw.code));
    if (!item) continue;
    let size: string | null = null;
    if (item.sizes) {
      if (!raw.size) continue;
      if (!item.sizes.some((s) => s.label === raw.size)) continue;
      size = String(raw.size);
    }
    const addOns = [...new Set((raw.addOns || []).map(String))].filter((c) => ADD_ON_BY_CODE.has(c)).sort();
    const qty = clampQty(Number(raw.qty));
    const key = cartLineKey(item, size, addOns);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code: item.code,
      name: item.name,
      size,
      addOns,
      qty,
      lineNote: String(raw.lineNote || '').slice(0, 100).trim(),
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Checkout validation
// ────────────────────────────────────────────────────────────
export const NAME_MAX = 50;
export const NOTE_MAX = 200;

export function validateCheckout(input: CheckoutInput, cartCount: number, tableCount: number): FieldErrors {
  const errors: FieldErrors = {};
  if (cartCount < 1) errors.cart = 'Your cart is empty.';
  const name = input.name.trim();
  if (name.length < 2) errors.name = 'Please enter your name (min 2 characters).';
  else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer.`;
  const ph = normalizePhone(input.phone);
  if (!ph.ok) errors.phone = ph.reason || 'Invalid phone number.';
  if (input.orderType === 'Dine-in') {
    const t = parseTable(input.table, tableCount);
    if (!t.ok || input.table === 'Takeaway') errors.table = 'Please select your table number.';
  } else {
    if (input.table !== 'Takeaway') errors.table = 'Invalid table for Takeaway.';
  }
  if (input.note.length > NOTE_MAX) errors.note = `Note must be ${NOTE_MAX} characters or fewer.`;
  return errors;
}

// ────────────────────────────────────────────────────────────
// Order payload construction + server-side validation
// ────────────────────────────────────────────────────────────
export function buildOrderPayload(
  input: CheckoutInput,
  cart: readonly CartLine[],
  orderId: string,
  menu: ReadonlyMap<string, MenuItem> = byCode,
): OrderPayload {
  const totals = calcCart(cart);
  const items: OrderItem[] = totals.rows.map((r) => ({
    code: r.line.code,
    name: r.item.name,
    size: r.line.size,
    qty: clampQty(r.line.qty),
    addOns: r.line.addOns,
    note: r.line.lineNote,
    unitPrice: r.unit,
    lineTotal: r.lineTotal,
  }));
  return {
    orderId,
    customerName: input.name.trim(),
    whatsappNumber: normalizePhone(input.phone).phone,
    tableNumber: input.orderType === 'Pickup' ? 'Takeaway' : input.table,
    orderType: input.orderType,
    items,
    customizations: buildCustomizations(totals.rows),
    specialInstructions: input.note.trim().slice(0, NOTE_MAX),
    subtotal: totals.subtotal,
    total: totals.subtotal,
    paymentStatus: 'Pending',
    orderStatus: 'Placed',
  };
}

export function buildCustomizations(rows: CartRow[]): string {
  return rows
    .map((r) => {
      const size = r.line.size ? ` (${r.line.size})` : '';
      const add = r.addOnLabels.length ? ` + ${r.addOnLabels.join(', ')}` : '';
      const note = r.line.lineNote ? ` [${r.line.lineNote}]` : '';
      return `${r.line.qty} × ${r.item.name}${size}${add}${note}`;
    })
    .join('; ');
}

/** Server-side validation of a full order payload. Returns an error string or
 *  null. Recomputes totals from the source menu — a mismatched or tampered
 *  total is rejected, never trusted. */
export function validateOrderPayload(payload: OrderPayload, menu: ReadonlyMap<string, MenuItem> = byCode): string | null {
  if (!payload || typeof payload !== 'object') return 'Invalid order payload.';
  if (!/^ORD-\d{8}-\d{6}-[0-9A-F]{4}$/.test(payload.orderId)) return 'Invalid order id.';
  if (typeof payload.customerName !== 'string' || payload.customerName.trim().length < 2) {
    return 'Customer name is required.';
  }
  if (payload.customerName.trim().length > NAME_MAX) return 'Customer name is too long.';
  if (!normalizePhone(payload.whatsappNumber).ok) return 'Valid 10-digit Indian mobile number required.';
  const table = parseTable(payload.tableNumber, 999);
  if (!table.ok && payload.tableNumber !== 'Takeaway') return 'Invalid table number.';
  if (!Array.isArray(payload.items) || payload.items.length === 0) return 'Order has no items.';
  let recomputedSubtotal = 0;
  let count = 0;
  for (const it of payload.items) {
    if (!it || typeof it !== 'object') return 'Invalid item.';
    const item = menu.get(String(it.code));
    if (!item) return `Unknown item: ${String(it.code)}.`;
    if (item.available === false) return `${item.name} is currently unavailable.`;
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) return `Invalid quantity for ${item.name}.`;
    const price = lineTotal(item, it.size || null, (it.addOns || []).map(String), qty);
    if (!price.ok) return `Invalid size for ${item.name}.`;
    recomputedSubtotal += price.lineTotal;
    count += qty;
  }
  if (count < 1) return 'Order has no items.';
  if (Math.round(payload.subtotal) !== Math.round(recomputedSubtotal)) {
    return `Total mismatch (client ${payload.subtotal} vs server ${recomputedSubtotal}).`;
  }
  if (Math.round(payload.total) !== Math.round(recomputedSubtotal)) return 'Total mismatch.';
  return null;
}

// ────────────────────────────────────────────────────────────
// WhatsApp + UPI helpers
// ────────────────────────────────────────────────────────────
export function waLink(numberE164: string, text: string): string {
  return `https://wa.me/${String(numberE164).replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppText(p: OrderPayload): string {
  const lines: string[] = [
    'Hi, I just placed an order.',
    '',
    `Order ID: ${p.orderId}`,
    `Table: ${p.tableNumber}`,
    p.customerName ? `Name: ${p.customerName}` : null,
    '',
    'Items:',
    ...p.items.map((it) => {
      const size = it.size ? ` (${it.size})` : '';
      const add = it.addOns.length ? ` + ${addOnLabels(it.addOns).join(', ')}` : '';
      const qty = `${it.qty} × `;
      return `${qty}${it.name}${size}${add} — ${rup(it.lineTotal)}`;
    }),
    '',
    `Total: ${rup(p.total)}`,
    `Payment status: ${p.paymentStatus}`,
    '',
    'Please confirm my order.',
  ].filter((l): l is string => l !== null);
  return lines.join('\n');
}

export function upiUri(opts: {
  upiId: string;
  payee: string;
  amount: number;
  tn: string;
}): string {
  const q = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payee,
    am: opts.amount.toFixed(2),
    cu: 'INR',
    tn: opts.tn,
  });
  return `upi://pay?${q.toString()}`;
}

// ────────────────────────────────────────────────────────────
// Opening hours
// ────────────────────────────────────────────────────────────
export function isOpenNow(hours: readonly OpenHours[], now: Date = new Date()): boolean {
  if (!hours || hours.length === 0) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
  };
  return hours.some((w) => {
    const a = toMin(w.start), b = toMin(w.end);
    if (a < 0 || b < 0) return false;
    if (a <= b) return mins >= a && mins <= b;
    return mins >= a || mins <= b; // overnight window
  });
}

export { MENU_ITEMS, byCode };
export type { MenuItem };