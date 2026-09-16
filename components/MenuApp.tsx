'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ADD_ONS,
  ADD_ON_BY_CODE,
  byCode,
  buildOrderPayload,
  buildWhatsAppText,
  calcCart,
  cartLineKey,
  clampQty,
  isOpenNow,
  lineTotal,
  makeOrderId,
  rup,
  sanitizeCart,
  tableOptions,
  upiUri,
  validateCheckout,
  waLink,
  type CartLine,
  type CheckoutInput,
  type OrderPayload,
} from '@/lib/order-core';
import { type ClientConfig } from '@/lib/config';

const CART_KEY = 'cmf.cart.v1';
const THEME_KEY = 'cmf.theme.v1';
const PENDING_KEY = 'cmf.pendingOrderId.v1';
const LAST_KEY = 'cmf.lastOrder.v1';
const PAGE_SIZE = 8;

type ThemeId = 'marigold' | 'mulberry' | 'fern';
const SWATCH: Record<ThemeId, string> = {
  marigold: '#F5A623',
  mulberry: '#C6A24C',
  fern: '#2F8F63',
};

type Props = {
  config: ClientConfig;
  initialTable: string;
  tableState: 'ok' | 'missing' | 'invalid';
  tableLabel: string | null;
};

function lineKey(l: CartLine): string {
  const item = byCode.get(l.code);
  return item ? cartLineKey(item, l.size, l.addOns) : l.code;
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key) ?? '';
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function MenuApp({ config, tableState, tableLabel }: Props) {
  const today = useMemo(() => new Date(), []);
  const open = isOpenNow(config.openHours, today);

  // ── state ───────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeId>('marigold');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placed, setPlaced] = useState<OrderPayload | null>(null);
  const [activeCat, setActiveCat] = useState('All');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [detail, setDetail] = useState<{ code: string; qty: number; size: string | null; addOns: string[]; note: string } | null>(null);
  const [input, setInput] = useState<CheckoutInput>({
    name: '',
    phone: '',
    table: tableLabel ?? '',
    orderType: 'Dine-in',
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [honey, setHoney] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const submittingRef = useRef(false);

  // ── boot / persistence ──────────────────────────────────
  useEffect(() => {
    const saved = readJSON<CartLine[]>(CART_KEY, []);
    setCart(Array.isArray(saved) ? sanitizeCart(saved) : []);
    const savedTheme = readJSON<ThemeId>(THEME_KEY, 'marigold');
    if (savedTheme === 'mulberry' || savedTheme === 'fern' || savedTheme === 'marigold') {
      setTheme(savedTheme);
    }
    const last = readJSON<{ payload?: OrderPayload }>(LAST_KEY, {});
    if (last && last.payload && Array.isArray(last.payload.items) && last.payload.items.length) {
      setPlaced(last.payload);
      setCart([]);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    } catch {
      /* storage full/blocked — theme just won't persist */
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(sanitizeCart(cart)));
    } catch {
      /* ignore */
    }
  }, [cart]);

  useEffect(() => {
    if (submitState === 'submitting') {
      const warn = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener('beforeunload', warn);
      return () => window.removeEventListener('beforeunload', warn);
    }
  }, [submitState]);

  // ── totals ──────────────────────────────────────────────
  const totals = useMemo(() => calcCart(cart), [cart]);

  // ── menu filtering ──────────────────────────────────────
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cats = activeCat === 'All' ? undefined : [activeCat];
    let items = byCode
      ? [...byCode.values()]
      : [];
    if (cats) items = items.filter((i) => cats.includes(i.cat));
    if (q) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.desc.toLowerCase().includes(q) ||
          i.cat.toLowerCase().includes(q),
      );
    }
    return items;
  }, [activeCat, query]);

  const paginated = useMemo(() => {
    const single = activeCat !== 'All' && !query.trim();
    if (!single) return { items: visible, pager: false, label: '', pages: 1, p: 0 };
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const p = Math.min(page, pages - 1);
    return {
      items: visible.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE),
      pager: pages > 1,
      label: `${p + 1} / ${pages}`,
      pages,
      p,
    };
  }, [visible, activeCat, query, page]);

  useEffect(() => setPage(0), [activeCat, query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof paginated.items>();
    for (const it of paginated.items) {
      const arr = map.get(it.cat) ?? [];
      arr.push(it);
      map.set(it.cat, arr);
    }
    return [...map.entries()];
  }, [paginated.items]);

  // ── cart operations ─────────────────────────────────────
  const updateLine = useCallback((fn: (lines: CartLine[]) => CartLine[]) => {
    setCart((prev) => sanitizeCart(fn(prev)));
  }, []);

  const bumpLine = useCallback(
    (line: CartLine, delta: number) => {
      updateLine((lines) => {
        const item = byCode.get(line.code);
        if (!item) return lines;
        const key = cartLineKey(item, line.size, line.addOns);
        const idx = lines.findIndex((l) => lineKey(l) === key);
        const next = [...lines];
        if (idx === -1) {
          if (delta > 0) next.push({ ...line, qty: clampQty(1) });
          return next;
        }
        const q = clampQty((next[idx].qty || 0) + delta);
        if (q <= 0) next.splice(idx, 1);
        else next[idx] = { ...next[idx], qty: q };
        return next;
      });
    },
    [updateLine],
  );

  const bumpQuick = useCallback((code: string, delta: number) => {
    updateLine((lines) => {
      const item = byCode.get(code);
      if (!item) return lines;
      const key = cartLineKey(item, null, []);
      const idx = lines.findIndex((l) => lineKey(l) === key);
      const next = [...lines];
      if (idx === -1) {
        if (delta > 0) next.push({ code, name: item.name, size: null, addOns: [], qty: 1, lineNote: '' });
        return next;
      }
      const q = clampQty((next[idx].qty || 0) + delta);
      if (q <= 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx], qty: q };
      return next;
    });
  }, [updateLine]);

  const openDetail = useCallback(
    (code: string) => {
      const item = byCode.get(code);
      if (!item) return;
      const existing = cart.find((l) => l.code === code);
      const size = item.sizes ? (existing?.size ?? item.sizes[0].label) : null;
      setDetail({
        code,
        size,
        addOns: existing ? existing.addOns : [],
        qty: existing ? existing.qty : 1,
        note: existing?.lineNote ?? '',
      });
      setCartOpen(false);
    },
    [cart],
  );

  const detailItem = detail ? byCode.get(detail.code) : null;
  const detailKey = detail && detailItem ? cartLineKey(detailItem, detail.size, detail.addOns) : '';
  const detailInCart = useMemo(() => (detailKey ? cart.some((l) => lineKey(l) === detailKey) : false), [cart, detailKey]);
  const detailPrice = detail && detailItem ? lineTotal(detailItem, detail.size, detail.addOns, detail.qty) : null;

  const setDetailSize = (size: string) => {
    if (!detail || !detailItem?.sizes) return;
    const key = cartLineKey(detailItem, size, detail.addOns);
    const ex = cart.find((l) => lineKey(l) === key);
    setDetail({ ...detail, size, qty: ex ? ex.qty : 1 });
  };
  const toggleAddOn = (code: string) => {
    if (!detail) return;
    const addOns = detail.addOns.includes(code)
      ? detail.addOns.filter((c) => c !== code)
      : [...detail.addOns, code].sort();
    const key = detailItem ? cartLineKey(detailItem, detail.size, addOns) : '';
    const ex = cart.find((l) => lineKey(l) === key);
    setDetail({ ...detail, addOns, qty: ex ? ex.qty : detail.qty });
  };
  const bumpDetail = (d: number) =>
    setDetail((prev) => (prev ? { ...prev, qty: clampQty(prev.qty + d) } : prev));

  const addFromDetail = () => {
    if (!detail || !detailItem || !detailPrice?.ok) return;
    const key = cartLineKey(detailItem, detail.size, detail.addOns);
    updateLine((lines) => {
      const idx = lines.findIndex((l) => lineKey(l) === key);
      const next = [...lines];
      const line: CartLine = {
        code: detailItem.code,
        name: detailItem.name,
        size: detail.size,
        addOns: detail.addOns,
        qty: detail.qty,
        lineNote: detail.note.trim().slice(0, 100),
      };
      if (idx === -1) next.push(line);
      else next[idx] = line;
      return next;
    });
    setDetail(null);
  };

  const removeFromDetail = () => {
    if (!detail || !detailItem || !detailKey) return;
    updateLine((lines) => lines.filter((l) => lineKey(l) !== detailKey));
    setDetail(null);
  };

  const setOrderType = (t: 'Dine-in' | 'Pickup') =>
    setInput((prev) => ({ ...prev, orderType: t, table: t === 'Pickup' ? 'Takeaway' : prev.table || '' }));

  // ── placement ───────────────────────────────────────────
  const pendingOrderId = () => readJSON<string>(PENDING_KEY, '');

  const placeOrder = useCallback(async () => {
    if (submittingRef.current || submitState === 'submitting') return;
    const fieldErrors = validateCheckout(input, totals.count, config.tableCount);
    if (Object.keys(fieldErrors).some((k) => fieldErrors[k as keyof typeof fieldErrors])) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    // Spam honeypot: pretend success for bots, never store anything.
    if (honey.trim()) {
      setPlaced(buildOrderPayload(input, cart, makeOrderId()));
      setCart([]);
      setCartOpen(false);
      return;
    }

    // Google Sheets backend not configured yet: complete the order locally so
    // the customer can still pay + follow up on WhatsApp, but the confirmation
    // screen explicitly says nothing was recorded.
    if (!config.orderApiConfigured) {
      setPlaced(buildOrderPayload(input, cart, makeOrderId()));
      setCart([]);
      setCartOpen(false);
      return;
    }

    setSubmitError('');
    setSubmitState('submitting');
    submittingRef.current = true;
    let orderId = pendingOrderId();
    if (!orderId) {
      orderId = makeOrderId();
      try {
        window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(orderId));
      } catch {
        /* ignore */
      }
    }
    const payload = buildOrderPayload(input, cart, orderId);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(payload as object), honeypotFilled: false }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; orderId?: string; duplicate?: boolean; serverTotal?: number }
        | null;
      if (res.ok && data && data.ok) {
        const confirmed: OrderPayload = {
          ...payload,
          subtotal: data.serverTotal ?? payload.subtotal,
          total: data.serverTotal ?? payload.total,
        };
        try {
          window.sessionStorage.removeItem(PENDING_KEY);
          window.sessionStorage.setItem(LAST_KEY, JSON.stringify({ payload: confirmed, at: Date.now() }));
          window.localStorage.removeItem(CART_KEY);
        } catch {
          /* ignore */
        }
        setPlaced(confirmed);
        setCart([]);
        setCartOpen(false);
        setInput((prev) => ({ ...prev, name: '', phone: '', note: '' }));
        setSubmitState('idle');
      } else {
        setSubmitError(data?.error || 'The café could not record your order. Please try again.');
        setSubmitState('error');
      }
    } catch {
      setSubmitError('Network error — please check your internet connection and try again.');
      setSubmitState('error');
    } finally {
      submittingRef.current = false;
    }
  }, [input, cart, totals.count, config.tableCount, honey, submitState, updateLine]);

  const resetAll = useCallback(() => {
    try {
      window.sessionStorage.removeItem(PENDING_KEY);
      window.sessionStorage.removeItem(LAST_KEY);
      window.localStorage.removeItem(CART_KEY);
    } catch {
      /* ignore */
    }
    setPlaced(null);
    setCart([]);
    setCartOpen(false);
    setDetail(null);
    setSubmitState('idle');
    setSubmitError('');
    setInput((prev) => ({ ...prev, name: '', phone: '', note: '', orderType: 'Dine-in', table: tableLabel ?? '' }));
  }, [tableLabel]);

  const waUrl = placed ? waLink(config.whatsappNumber, buildWhatsAppText(placed)) : '';

  // ── UPI helpers ─────────────────────────────────────────
  const upiUriStr = placed
    ? upiUri({
        upiId: config.upiId,
        payee: config.upiPayee,
        amount: placed.total,
        tn: `Order ${placed.orderId}`,
      })
    : '';

  const copyUpi = useCallback(async () => {
    if (!config.upiId) return;
    try {
      await navigator.clipboard.writeText(config.upiId);
    } catch {
      const t = document.createElement('textarea');
      t.value = config.upiId;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(t);
    }
  }, [config.upiId]);

  return (
    <div className="app">
      <div className="scroller">
        {/* ── Header ── */}
        <div className="cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/mehfile-hero-badge.svg" alt="" draggable={false} />
          <div className="cover-dots">
            {(['marigold', 'mulberry', 'fern'] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-label={`${id} theme`}
                title={id}
                onClick={() => setTheme(id)}
                className={`dot${theme === id ? ' on' : ''}`}
                style={{ background: SWATCH[id] }}
              />
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/uploads/WhatsApp Image 2026-09-14 at 1.38.58 PM (1).jpeg"
            alt="Café Mehfile logo"
            className="logo-chip"
            draggable={false}
          />
        </div>

        <div className="resto-card">
          <div className="resto-top">
            <div className="resto-name">Café Mehfile</div>
            <div className="rating-pill">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
              <span>4.6</span>
            </div>
          </div>
          <div className="meta-row">
            <div className="meta-item">
              <span className={open ? 'green-dot' : 'grey-dot'} />
              <span>{open ? 'Open now' : 'Closed now'}</span>
            </div>
            <div className="meta-item">
              <svg className="dim" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              <span>15–20 min</span>
            </div>
            <div className="meta-item">
              <svg className="dim" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h2l2.4 12.1a2 2 0 002 1.9h8.2a2 2 0 002-1.6L21 8H6" />
              </svg>
              <span>Pure veg</span>
            </div>
          </div>
        </div>

        {(tableState === 'ok' || tableState === 'invalid' || tableState === 'missing') && (
          <div className={`table-banner ${tableState === 'ok' ? 'ok' : 'warn'}`}>
            {tableState === 'ok' ? (
              <>
                <span>📍</span>
                <span>
                  Your table: <b>{tableLabel}</b>
                </span>
              </>
            ) : tableState === 'missing' ? (
              <span>Scan the QR code on your table or choose your table at checkout.</span>
            ) : (
              <span>We couldn’t identify your table from the link. Please choose your table at checkout.</span>
            )}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="toolbar">
          <div className="search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              placeholder="Search the menu…"
              aria-label="Search the menu"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="tabs" role="tablist">
            {CAT_TAB_BUTTONS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={activeCat === t}
                className={`tab${activeCat === t ? ' active' : ''}`}
                onClick={() => setActiveCat(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ── */}
        {groups.length === 0 ? (
          <div className="empty-note">
            <b>No items found</b>
            {query.trim() ? 'Try a different search term or pick a category.' : 'Nothing here yet.'}
          </div>
        ) : (
          groups.map(([cat, items]) => (
            <div className="group" key={cat}>
              <div className="group-name">{cat}</div>
              {items.map((item) => {
                const inCart = item.sizes
                  ? totals.rows.some((r) => r.line.code === item.code)
                  : totals.rows.some((r) => r.line.code === item.code && !r.line.size && r.line.addOns.length === 0);
                const qty = inCart
                  ? totals.rows.filter((r) => r.line.code === item.code).reduce((t, r) => t + r.line.qty, 0)
                  : 0;
                return (
                  <div
                    key={item.code}
                    className={`item-row${item.available ? '' : ' unavailable'}`}
                    onClick={() => (item.available ? openDetail(item.code) : undefined)}
                    role="button"
                    tabIndex={item.available ? 0 : -1}
                    onKeyDown={(e) => {
                      if (item.available && (e.key === 'Enter' || e.key === ' ')) openDetail(item.code);
                    }}
                  >
                    {item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="item-img" src={item.photo} alt={item.name} loading="lazy" decoding="async" />
                    ) : (
                      <div className="item-tile">{item.name.charAt(0)}</div>
                    )}
                    <div className="item-body">
                      <div className="item-name">{item.name}</div>
                      <div className="item-desc">{item.desc || '—'}</div>
                      <div className="item-price">
                        {item.sizes ? `From ${rup(item.sizes[0].price)}` : rup(item.price)}
                      </div>
                    </div>
                    {!item.available ? (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--z-ink-soft)', whiteSpace: 'nowrap' }}>
                        Unavailable
                      </span>
                    ) : item.sizes ? (
                      <button
                        type="button"
                        className="size-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(item.code);
                        }}
                      >
                        {inCart ? `${qty} in cart` : '+'}
                      </button>
                    ) : inCart ? (
                      <div className="stepper" onClick={(e) => e.stopPropagation()}>
                        <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => bumpQuick(item.code, -1)}>
                          −
                        </button>
                        <span>{qty}</span>
                        <button type="button" aria-label={`Increase ${item.name}`} onClick={() => bumpQuick(item.code, 1)}>
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="quick-add"
                        aria-label={`Add ${item.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          bumpQuick(item.code, 1);
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}

        {paginated.pager && (
          <div className="pager">
            <button type="button" aria-label="Previous page" disabled={(paginated.p ?? 0) === 0} onClick={() => setPage((paginated.p ?? 0) - 1)}>
              ‹
            </button>
            <span>{paginated.label}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={(paginated.p ?? 0) >= (paginated.pages ?? 1) - 1}
              onClick={() => setPage((paginated.p ?? 0) + 1)}
            >
              ›
            </button>
          </div>
        )}
        <div style={{ height: 100 }} />

        {/* ── Floating cart ── */}
        <button
          type="button"
          className="fab"
          aria-label="Open cart"
          onClick={() => {
            setDetail(null);
            setCartOpen(true);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6h2l2.4 12.1a2 2 0 002 1.9h8.2a2 2 0 002-1.6L21 8H6" />
            <circle cx="9" cy="21" r="1" />
            <circle cx="18" cy="21" r="1" />
          </svg>
          {totals.count > 0 && <span className="fab-badge">{totals.count}</span>}
        </button>
      </div>

      {/* ── Item detail sheet ── */}
      {detail && detailItem && detailPrice && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="sheet open-detail" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={detailItem.name}>
            <div className="detail-hero">
              {detailItem.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detailItem.photo} alt={detailItem.name} loading="lazy" decoding="async" />
              ) : (
                <div style={{ height: 210, background: 'var(--z-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="item-tile" style={{ width: 84, height: 84 }}>
                    {detailItem.name.charAt(0)}
                  </div>
                </div>
              )}
              <button type="button" className="close-btn" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>
            <div className="sheet-body">
              <div className="detail-name">{detailItem.name}</div>
              {detailItem.desc && <div className="detail-desc">{detailItem.desc}</div>}
              <div className="detail-price">{rup(detailPrice.unit)}</div>

              {detailItem.sizes && (
                <>
                  <div className="opt-label">Choose size</div>
                  <div className="seg" role="radiogroup">
                    {detailItem.sizes.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        role="radio"
                        aria-checked={detail.size === s.label}
                        className={detail.size === s.label ? 'active' : ''}
                        onClick={() => setDetailSize(s.label)}
                      >
                        {s.label} · {rup(s.price)}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="opt-label">Add-ons</div>
              <div className="chips">
                {ADD_ONS.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    className={`chip${detail.addOns.includes(a.code) ? ' active' : ''}`}
                    onClick={() => toggleAddOn(a.code)}
                  >
                    {a.name} <small>+{rup(a.price)}</small>
                  </button>
                ))}
              </div>

              <div className="opt-label">Special instructions</div>
              <textarea
                className="line-note"
                placeholder="Less spicy, extra napkins, etc."
                maxLength={100}
                value={detail.note}
                onChange={(e) => setDetail((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
              />

              <div className="qty-group">
                <button type="button" aria-label="Decrease quantity" onClick={() => bumpDetail(-1)}>
                  −
                </button>
                <span>{detail.qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => bumpDetail(1)}>
                  +
                </button>
              </div>
            </div>
            <div className="sheet-foot">
              <button type="button" className="btn btn-accent btn-block" onClick={addFromDetail}>
                {detailInCart ? 'Update' : 'Add'} · {rup(detailPrice.lineTotal)}
              </button>
              {detailInCart && (
                <button type="button" className="btn-ghost" style={{ width: '100%' }} onClick={removeFromDetail}>
                  Remove from order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cart + checkout sheet ── */}
      {cartOpen && !placed && (
        <div className="overlay" onClick={() => setCartOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Your order">
            <div className="sheet-head">
              <h2>Your order</h2>
              <button type="button" className="close-btn" onClick={() => setCartOpen(false)}>
                ✕
              </button>
            </div>
            <div className="sheet-body">
              {totals.rows.length === 0 ? (
                <p style={{ color: 'var(--z-ink-soft)', lineHeight: 1.6, padding: '20px 0' }}>
                  Nothing here yet. Go add the momos.
                </p>
              ) : (
                totals.rows.map((r) => (
                  <div className="line-row" key={lineKey(r.line)}>
                    {r.item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="line-img" src={r.item.photo} alt={r.item.name} loading="lazy" />
                    ) : (
                      <div className="line-tile">{r.item.name.charAt(0)}</div>
                    )}
                    <div className="line-body">
                      <div className="line-name">{r.label}</div>
                      <div className="line-sub">
                        {r.sub.split(' + ')[0]} <span className="addon-tag">{r.line.addOns.length ? `+ ${r.addOnLabels.join(', ')}` : ''}</span>
                        {r.line.lineNote ? <div className="line-note-js">“{r.line.lineNote}”</div> : null}
                      </div>
                    </div>
                    <div className="stepper">
                      <button type="button" aria-label={`Decrease ${r.line.name}`} onClick={() => bumpLine(r.line, -1)}>
                        −
                      </button>
                      <span>{r.line.qty}</span>
                      <button type="button" aria-label={`Increase ${r.line.name}`} onClick={() => bumpLine(r.line, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}

              <div className="opt-label">Order type</div>
              <div className="seg">
                <button type="button" onClick={() => setOrderType('Pickup')} className={input.orderType === 'Pickup' ? 'active' : ''}>
                  Pickup
                </button>
                <button type="button" onClick={() => setOrderType('Dine-in')} className={input.orderType === 'Dine-in' ? 'active' : ''}>
                  Dine-in
                </button>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className={`field${errors.name ? ' err' : ''}`}>
                  <label htmlFor="cmf-name">Your name</label>
                  <input
                    id="cmf-name"
                    type="text"
                    placeholder="Your name"
                    maxLength={50}
                    value={input.name}
                    autoComplete="name"
                    onChange={(e) => setInput((p) => ({ ...p, name: e.target.value }))}
                  />
                  {errors.name && <div className="field-msg">{errors.name}</div>}
                </div>

                <div className={`field${errors.phone ? ' err' : ''}`}>
                  <label htmlFor="cmf-phone">WhatsApp number</label>
                  <input
                    id="cmf-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    maxLength={13}
                    value={input.phone}
                    autoComplete="tel"
                    onChange={(e) => setInput((p) => ({ ...p, phone: e.target.value }))}
                  />
                  {errors.phone ? (
                    <div className="field-msg">{errors.phone}</div>
                  ) : (
                    <div className="field-msg" style={{ color: 'var(--z-ink-soft)' }}>
                      We use this to confirm on WhatsApp.
                    </div>
                  )}
                </div>

                {input.orderType === 'Dine-in' && (
                  <div className={`field${errors.table ? ' err' : ''}`}>
                    <label htmlFor="cmf-table">Table number</label>
                    <select
                      id="cmf-table"
                      value={input.table}
                      onChange={(e) => setInput((p) => ({ ...p, table: e.target.value }))}
                    >
                      <option value="" disabled>
                        Select your table…
                      </option>
                      {tableOptions(config.tableCount).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {errors.table && <div className="field-msg">{errors.table}</div>}
                  </div>
                )}

                <div className={`field${errors.note ? ' err' : ''}`}>
                  <label htmlFor="cmf-note">Note to the kitchen (optional)</label>
                  <textarea
                    id="cmf-note"
                    rows={2}
                    maxLength={200}
                    placeholder="Less spicy, extra napkins, birthday surprise…"
                    value={input.note}
                    onChange={(e) => setInput((p) => ({ ...p, note: e.target.value }))}
                  />
                  {errors.note && <div className="field-msg">{errors.note}</div>}
                </div>

                {/* Honeypot — hidden to humans, filled by bots */}
                <div className="honeypot" aria-hidden="true">
                  <label htmlFor="cmf-honey">Leave this field empty</label>
                  <input id="cmf-honey" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
                </div>
              </div>
              {errors.cart && <div className="err-box">{errors.cart}</div>}
              {submitState === 'error' && (
                <div className="err-box">
                  {submitError}
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="link-btn" onClick={() => setSubmitState('idle')}>
                      Retry
                    </button>
                    <span style={{ opacity: 0.6 }}> — your cart is safe, the same Order ID will be reused.</span>
                  </div>
                </div>
              )}
            </div>
            {totals.rows.length > 0 && (
              <div className="sheet-foot">
                <div className="total-row">
                  <span>Total</span>
                  <span>{rup(totals.subtotal)}</span>
                </div>
                <button
                  type="button"
                  className={`btn btn-green btn-block${submitState === 'submitting' ? ' spinner-btn' : ''}`}
                  disabled={submitState === 'submitting'}
                  onClick={placeOrder}
                >
                  {submitState === 'submitting' ? (
                    <>
                      <span className="spin" /> Placing your order…
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                        <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 2a8 8 0 110 16 8 8 0 01-4.2-1.2l-.4-.2-2.6.7.7-2.5-.2-.4A8 8 0 0112 4z" />
                      </svg>
                      Place order via WhatsApp
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Order confirmation ── */}
      {placed && (
        <div className="overlay" style={{ zIndex: 60, alignItems: 'stretch', justifyContent: 'center' }}>
          <div
            className="confirm-card rise"
          >
            {/* ── Success header ── */}
            <div className="confirm-head">
              <div className="confirm-check">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div>
                <div className="confirm-title">Order Confirmed</div>
                <div className="confirm-sub">
                  {config.orderApiConfigured ? 'Sent to the kitchen' : 'Ready to share'}
                </div>
              </div>
            </div>

            {/* ── Order summary strip ── */}
            <div className="confirm-summary">
              <span className="confirm-oid">#{placed.orderId.slice(-8)}</span>
              <span className="confirm-divider">·</span>
              <span>{placed.tableNumber}</span>
              <span className="confirm-divider">·</span>
              <span className="confirm-total">{rup(placed.total)}</span>
            </div>

            {/* ── Compact items ── */}
            {placed.items.length > 0 && (
              <div className="confirm-items">
                {placed.items.map((it, i) => (
                  <div key={i} className="confirm-item-row">
                    <span className="confirm-item-qty">{it.qty}×</span>
                    <span className="confirm-item-name">
                      {it.name}
                      {it.size ? ` (${it.size})` : ''}
                      {it.addOns.length ? (
                        <small className="confirm-addons"> +{it.addOns.map((c) => ADD_ON_BY_CODE.get(c)?.name ?? c).join(', ')}</small>
                      ) : ''}
                    </span>
                    <span className="confirm-item-price">{rup(it.lineTotal)}</span>
                  </div>
                ))}
                {placed.specialInstructions && (
                  <div className="confirm-note">"{placed.specialInstructions}"</div>
                )}
              </div>
            )}

            {/* ── UPI payment ── */}
            {config.upiId && (
              <div className="confirm-pay">
                <div className="confirm-pay-head">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--z-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </svg>
                  <span>Pay <b>{rup(placed.total)}</b> via UPI</span>
                </div>
                <div className="confirm-qr">
                  {config.upiQrImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={config.upiQrImage} alt="UPI QR" style={{ background: '#fff', padding: 6, borderRadius: 10, width: 120, height: 120, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ background: '#fff', padding: 6, borderRadius: 10 }}>
                      <QRCodeSVG value={upiUriStr} size={108} level="M" fgColor="#111" bgColor="#fff" />
                    </div>
                  )}
                  <div className="confirm-pay-details">
                    <div className="confirm-upi-id">{config.upiId}</div>
                    <button type="button" className="copy-btn" onClick={copyUpi}>
                      Copy UPI ID
                    </button>
                    <a className="confirm-open-upi" href={upiUriStr} rel="noreferrer">
                      Open UPI app →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* ── WhatsApp confirm ── */}
            <a className="confirm-wa" href={waUrl} target="_blank" rel="noreferrer">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 2a8 8 0 110 16 8 8 0 01-4.2-1.2l-.4-.2-2.6.7.7-2.5-.2-.4A8 8 0 0112 4z" />
              </svg>
              Confirm on WhatsApp
            </a>

            <button type="button" className="confirm-new" onClick={resetAll}>
              Start a new order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CAT_TAB_BUTTONS: readonly string[] = ['All', 'Maggie', 'Momos', 'Fries', 'Pasta', 'Burger', 'Garlic bread', 'Pizza', 'Sandwich', 'Pulao & rice', 'Sizzler', 'Sundae', 'Mojito', 'Coffee', 'Milk shake', 'Thick shake', 'Cafe special', 'Add ons'];