import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  rup,
  parseTable,
  normalizePhone,
  makeOrderId,
  clampQty,
  unitPrice,
  lineTotal,
  cartLineKey,
  calcCart,
  sanitizeCart,
  validateCheckout,
  buildOrderPayload,
  validateOrderPayload,
  buildWhatsAppText,
  upiUri,
  isOpenNow,
  tableOptions,
  byCode,
  ADD_ONS,
  type CartLine,
  type MenuItem,
} from '../lib/order-core.ts';

function mkLine(code: string, qty: number, size: string | null = null, addOns: string[] = []): CartLine {
  const item = byCode.get(code);
  return { code, name: item?.name || code, size, addOns, qty, lineNote: '' };
}

describe('rup()', () => {
  it('formats integers', () => assert.equal(rup(79), '₹79'));
  it('formats large numbers with Indian grouping', () => assert.equal(rup(1234), '₹1,234'));
  it('rounds and formats', () => assert.equal(rup(1234.5), '₹1,235'));
  it('formats lakh numbers', () => assert.equal(rup(100000), '₹1,00,000'));
});

describe('parseTable()', () => {
  it('accepts T12', () => assert.deepEqual(parseTable('T12', 20), { ok: true, table: 'T12', num: 12 }));
  it('accepts t12', () => assert.deepEqual(parseTable('t12', 20), { ok: true, table: 'T12', num: 12 }));
  it('accepts Table 12', () => assert.deepEqual(parseTable('Table 12', 20), { ok: true, table: 'T12', num: 12 }));
  it('accepts bare 12', () => assert.deepEqual(parseTable('12', 20), { ok: true, table: 'T12', num: 12 }));
  it('rejects abc', () => assert.deepEqual(parseTable('abc', 20), { ok: false, table: null, state: 'invalid' }));
  it('rejects 0', () => assert.deepEqual(parseTable('0', 20), { ok: false, table: null, state: 'invalid' }));
  it('rejects 99 with count=10', () => assert.deepEqual(parseTable('99', 10), { ok: false, table: null, state: 'invalid' }));
  it('rejects empty string', () => assert.deepEqual(parseTable('', 20), { ok: false, table: null, state: 'missing' }));
  it('rejects null', () => assert.deepEqual(parseTable(null, 20), { ok: false, table: null, state: 'missing' }));
  it('rejects undefined', () => assert.deepEqual(parseTable(undefined, 20), { ok: false, table: null, state: 'missing' }));
});

describe('normalizePhone()', () => {
  it('accepts 10-digit', () => assert.deepEqual(normalizePhone('9876543210'), { ok: true, phone: '9876543210' }));
  it('strips +91', () => assert.deepEqual(normalizePhone('+919876543210'), { ok: true, phone: '9876543210' }));
  it('strips 0 prefix', () => assert.deepEqual(normalizePhone('09876543210'), { ok: true, phone: '9876543210' }));
  it('strips 91 prefix', () => assert.deepEqual(normalizePhone('919876543210'), { ok: true, phone: '9876543210' }));
  it('rejects short numbers', () => assert.deepEqual(normalizePhone('12345'), { ok: false, phone: '12345', reason: 'valid 10-digit mobile number required' }));
  it('rejects letters', () => assert.equal(normalizePhone('abcdefghij').ok, false));
});

describe('makeOrderId()', () => {
  it('matches the expected pattern', () => {
    const id = makeOrderId();
    assert.match(id, /^ORD-\d{8}-\d{6}-[0-9A-F]{4}$/);
  });
  it('produces unique ids', () => {
    const a = makeOrderId();
    const b = makeOrderId();
    assert.notEqual(a, b);
  });
  it('uses provided date', () => {
    const d = new Date(2026, 0, 15, 10, 30, 45);
    const id = makeOrderId(d);
    assert.match(id, /^ORD-20260115-103045-[0-9A-F]{4}$/);
  });
});

describe('clampQty()', () => {
  it('clamps below 1 to 1', () => assert.equal(clampQty(0), 1));
  it('clamps negative to 1', () => assert.equal(clampQty(-5), 1));
  it('clamps above 50 to 50', () => assert.equal(clampQty(51), 50));
  it('clamps large to 50', () => assert.equal(clampQty(999), 50));
  it('NaN becomes 1', () => assert.equal(clampQty(NaN), 1));
  it('passes through valid', () => assert.equal(clampQty(10), 10));
  it('rounds floats', () => assert.equal(clampQty(2.6), 3));
});

describe('unitPrice()', () => {
  it('simple item returns base price', () => {
    const item = byCode.get('0-0')!;
    assert.equal(unitPrice(item, null), 79);
  });
  it('sized item with valid size', () => {
    const item = byCode.get('1-0')!;
    assert.equal(unitPrice(item, 'Full'), 119);
  });
  it('sized item with null size', () => {
    const item = byCode.get('1-0')!;
    assert.equal(unitPrice(item, null), null);
  });
  it('sized item with invalid size', () => {
    const item = byCode.get('1-0')!;
    assert.equal(unitPrice(item, 'Mega'), null);
  });
});

describe('lineTotal()', () => {
  it('computes correct total with qty and add-ons', () => {
    const item = byCode.get('0-0')!;
    const res = lineTotal(item, null, ['ext-cheese', 'ext-mayo'], 2);
    assert.equal(res.unit, 79);
    assert.equal(res.lineTotal, 2 * 79 + 30 + 20);
    assert.equal(res.ok, true);
  });
  it('computes correct total for sized item', () => {
    const item = byCode.get('1-0')!;
    const res = lineTotal(item, 'Full', [], 1);
    assert.equal(res.unit, 119);
    assert.equal(res.lineTotal, 119);
    assert.equal(res.ok, true);
  });
  it('returns ok:false for invalid size on sized item', () => {
    const item = byCode.get('1-0')!;
    const res = lineTotal(item, 'Mega', [], 1);
    assert.equal(res.ok, false);
  });
});

describe('cartLineKey()', () => {
  it('same item+size+add-ons → same key', () => {
    const item = byCode.get('1-0')!;
    const k1 = cartLineKey(item, 'Full', ['ext-cheese']);
    const k2 = cartLineKey(item, 'Full', ['ext-cheese']);
    assert.equal(k1, k2);
  });
  it('different add-ons → different key', () => {
    const item = byCode.get('1-0')!;
    const k1 = cartLineKey(item, 'Full', ['ext-cheese']);
    const k2 = cartLineKey(item, 'Full', ['ext-mayo']);
    assert.notEqual(k1, k2);
  });
  it('add-on order does not matter', () => {
    const item = byCode.get('1-0')!;
    const k1 = cartLineKey(item, 'Full', ['ext-mayo', 'ext-cheese']);
    const k2 = cartLineKey(item, 'Full', ['ext-cheese', 'ext-mayo']);
    assert.equal(k1, k2);
  });
  it('different size → different key', () => {
    const item = byCode.get('1-0')!;
    const k1 = cartLineKey(item, 'Half', []);
    const k2 = cartLineKey(item, 'Full', []);
    assert.notEqual(k1, k2);
  });
});

describe('calcCart()', () => {
  it('empty cart', () => {
    const res = calcCart([]);
    assert.deepEqual(res, { rows: [], subtotal: 0, count: 0 });
  });
  it('single simple item', () => {
    const lines: CartLine[] = [mkLine('0-0', 2)];
    const res = calcCart(lines);
    assert.equal(res.rows.length, 1);
    assert.equal(res.subtotal, 158);
    assert.equal(res.count, 2);
  });
  it('sized item with add-ons', () => {
    const lines: CartLine[] = [mkLine('1-0', 1, 'Full', ['ext-cheese'])];
    const res = calcCart(lines);
    assert.equal(res.rows.length, 1);
    assert.equal(res.subtotal, 119 + 30);
    assert.equal(res.count, 1);
  });
  it('unknown code is skipped', () => {
    const lines: CartLine[] = [mkLine('0-0', 1), mkLine('zzz-99', 1)];
    const res = calcCart(lines);
    assert.equal(res.rows.length, 1);
    assert.equal(res.subtotal, 79);
  });
  it('multiple items', () => {
    const lines: CartLine[] = [mkLine('0-0', 1), mkLine('0-1', 3)];
    const res = calcCart(lines);
    assert.equal(res.rows.length, 2);
    assert.equal(res.subtotal, 79 + 3 * 89);
    assert.equal(res.count, 4);
  });
});

describe('sanitizeCart()', () => {
  it('drops unknown codes', () => {
    const lines: CartLine[] = [mkLine('0-0', 1), mkLine('zzz', 1)];
    const out = sanitizeCart(lines);
    assert.equal(out.length, 1);
    assert.equal(out[0].code, '0-0');
  });
  it('deduplicates by key', () => {
    const lines: CartLine[] = [mkLine('0-0', 1), mkLine('0-0', 3)];
    const out = sanitizeCart(lines);
    assert.equal(out.length, 1);
    assert.equal(out[0].qty, 1);
  });
  it('clamps qty', () => {
    const lines: CartLine[] = [mkLine('0-0', 0), mkLine('0-1', 99)];
    const out = sanitizeCart(lines);
    assert.equal(out[0].qty, 1);
    assert.equal(out[1].qty, 50);
  });
  it('normalizes add-ons', () => {
    const lines: CartLine[] = [
      { code: '0-0', name: 'Masala maggie', size: null, addOns: ['ext-cheese', 'ext-cheese', 'bogus'], qty: 1, lineNote: '' },
    ];
    const out = sanitizeCart(lines);
    assert.deepEqual(out[0].addOns, ['ext-cheese']);
  });
  it('drops sized item with missing size', () => {
    const lines: CartLine[] = [{ code: '1-0', name: 'Veg momos', size: null, addOns: [], qty: 1, lineNote: '' }];
    const out = sanitizeCart(lines);
    assert.equal(out.length, 0);
  });
  it('drops sized item with invalid size', () => {
    const lines: CartLine[] = [{ code: '1-0', name: 'Veg momos', size: 'Mega', addOns: [], qty: 1, lineNote: '' }];
    const out = sanitizeCart(lines);
    assert.equal(out.length, 0);
  });
});

describe('validateCheckout()', () => {
  const validInput = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: '' };

  it('empty cart → errors.cart', () => {
    const errors = validateCheckout(validInput, 0, 20);
    assert.ok(errors.cart);
  });
  it('short name → errors.name', () => {
    const errors = validateCheckout({ ...validInput, name: 'A' }, 1, 20);
    assert.ok(errors.name);
  });
  it('bad phone → errors.phone', () => {
    const errors = validateCheckout({ ...validInput, phone: '123' }, 1, 20);
    assert.ok(errors.phone);
  });
  it('Dine-in without table → errors.table', () => {
    const errors = validateCheckout({ ...validInput, table: '', orderType: 'Dine-in' }, 1, 20);
    assert.ok(errors.table);
  });
  it('Pickup with non-Takeaway table → errors.table', () => {
    const errors = validateCheckout({ ...validInput, table: 'T05', orderType: 'Pickup' }, 1, 20);
    assert.ok(errors.table);
  });
  it('valid Dine-in → no errors', () => {
    const errors = validateCheckout(validInput, 1, 20);
    assert.deepEqual(errors, {});
  });
  it('valid Pickup with Takeaway → no errors', () => {
    const errors = validateCheckout({ ...validInput, table: 'Takeaway', orderType: 'Pickup' }, 1, 20);
    assert.deepEqual(errors, {});
  });
});

describe('buildOrderPayload()', () => {
  const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: 'Extra napkins' };
  const cart: CartLine[] = [mkLine('0-0', 2), mkLine('1-0', 1, 'Full', ['ext-cheese'])];

  it('returns correct structure', () => {
    const id = makeOrderId();
    const p = buildOrderPayload(input, cart, id);
    assert.equal(p.orderId, id);
    assert.equal(p.customerName, 'Rahul');
    assert.equal(p.whatsappNumber, '9876543210');
    assert.equal(p.tableNumber, 'T05');
    assert.equal(p.orderType, 'Dine-in');
    assert.equal(p.paymentStatus, 'Pending');
    assert.equal(p.orderStatus, 'Placed');
  });

  it('computes items from cart', () => {
    const id = makeOrderId();
    const p = buildOrderPayload(input, cart, id);
    assert.equal(p.items.length, 2);
    assert.equal(p.items[0].unitPrice, 79);
    assert.equal(p.items[0].lineTotal, 2 * 79);
    assert.equal(p.items[1].unitPrice, 119);
    assert.equal(p.items[1].lineTotal, 119 + 30);
    assert.equal(p.subtotal, 2 * 79 + 119 + 30);
    assert.equal(p.total, p.subtotal);
  });

  it('trims note', () => {
    const id = makeOrderId();
    const p = buildOrderPayload({ ...input, note: '  Extra napkins  ' }, cart, id);
    assert.equal(p.specialInstructions, 'Extra napkins');
  });
});

describe('validateOrderPayload()', () => {
  function validPayload() {
    const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: '' };
    const cart: CartLine[] = [mkLine('0-0', 2)];
    return buildOrderPayload(input, cart, makeOrderId());
  }

  it('valid payload → null', () => {
    assert.equal(validateOrderPayload(validPayload()), null);
  });
  it('bad orderId → error', () => {
    assert.match(validateOrderPayload({ ...validPayload(), orderId: 'NOPE' })!, /order id/i);
  });
  it('mismatched total → error', () => {
    const p = validPayload();
    assert.match(validateOrderPayload({ ...p, subtotal: p.subtotal + 100 })!, /mismatch/i);
  });
  it('unknown item code → error', () => {
    const p = validPayload();
    p.items = [{ ...p.items[0], code: 'zzz-99' }];
    assert.match(validateOrderPayload(p)!, /Unknown item/);
  });
  it('empty items → error', () => {
    const p = validPayload();
    p.items = [];
    assert.match(validateOrderPayload(p)!, /no items/i);
  });
});

describe('buildWhatsAppText()', () => {
  it('contains orderId, table, items, total', () => {
    const input = { name: 'Rahul', phone: '9876543210', table: 'T05', orderType: 'Dine-in' as const, note: '' };
    const cart: CartLine[] = [mkLine('0-0', 2)];
    const p = buildOrderPayload(input, cart, makeOrderId());
    const text = buildWhatsAppText(p);
    assert.ok(text.includes(p.orderId));
    assert.ok(text.includes(p.tableNumber));
    assert.ok(text.includes('Masala maggie'));
    assert.ok(text.includes('₹'));
  });
});

describe('upiUri()', () => {
  it('returns string starting with upi://pay?', () => {
    const uri = upiUri({ upiId: 'cafe@upi', payee: 'Cafe', amount: 250, tn: 'Order ORD-1234' });
    assert.ok(typeof uri === 'string');
    assert.ok(uri.startsWith('upi://pay?'));
    assert.ok(uri.includes('pa=cafe%40upi'));
    assert.ok(uri.includes('am=250.00'));
    assert.ok(uri.includes('cu=INR'));
  });
});

describe('isOpenNow()', () => {
  const hours = [{ start: '09:00', end: '22:30' }];

  it('within hours → true', () => {
    const now = new Date(2026, 0, 15, 12, 0);
    assert.equal(isOpenNow(hours, now), true);
  });
  it('outside hours → false', () => {
    const now = new Date(2026, 0, 15, 23, 0);
    assert.equal(isOpenNow(hours, now), false);
  });
  it('empty hours → true', () => {
    const now = new Date(2026, 0, 15, 3, 0);
    assert.equal(isOpenNow([], now), true);
  });
  it('at boundary start', () => {
    const now = new Date(2026, 0, 15, 9, 0);
    assert.equal(isOpenNow(hours, now), true);
  });
  it('at boundary end', () => {
    const now = new Date(2026, 0, 15, 22, 30);
    assert.equal(isOpenNow(hours, now), true);
  });
});

describe('tableOptions()', () => {
  it('includes Takeaway + table labels', () => {
    const opts = tableOptions(20);
    assert.ok(opts.includes('Takeaway'));
    assert.ok(opts.includes('T01'));
    assert.ok(opts.includes('T12'));
    assert.ok(opts.includes('T20'));
    assert.equal(opts.length, 21);
  });
  it('without Takeaway', () => {
    const opts = tableOptions(5, false);
    assert.ok(!opts.includes('Takeaway'));
    assert.equal(opts.length, 5);
  });
});
