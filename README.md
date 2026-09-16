# Cafe Mehfile - Table QR Ordering System

A production-ready food ordering system for Cafe Mehfile. Customers scan a table QR code, browse the menu, customize their order, and place it directly to the kitchen via WhatsApp + Google Sheets.

## Features

- **QR Table Detection** - scans table number from QR URL parameter
- **Full Menu** - 16 categories, 96 items with photos, sizes, and add-ons
- **Cart + Checkout** - real-time pricing, quantity controls, special instructions
- **Google Sheets Backend** - orders stored in Google Sheets via Apps Script
- **WhatsApp Integration** - one-tap order confirmation to the cafe
- **UPI Payment** - QR code + deep link for UPI payments
- **Bot Protection** - honeypot field blocks automated spam
- **Responsive** - mobile-first, works on phones, tablets, and desktop
- **3 Themes** - Marigold (default), Mulberry (dark), Fern (green)

## Tech Stack

- **Next.js 16** (App Router, React 19)
- **TypeScript**
- **Google Apps Script** (Sheets backend)
- **qrcode.react** (UPI QR generation)

## Getting Started

```bash
npm install
cp .env.local.example .env.local
# Fill in your values in .env.local
npm run dev
```

## Configuration

Copy `.env.local.example` to `.env.local` and set:

| Variable | Description |
|---|---|
| `GOOGLE_SHEETS_WEBHOOK_URL` | Google Apps Script web app URL (ends in `/exec`) |
| `GOOGLE_SHEETS_WEBHOOK_TOKEN` | Secret token matching the Apps Script |
| `CAFE_WHATSAPP_NUMBER` | Cafe WhatsApp number (E.164 format, e.g. `919373861759`) |
| `CAFE_UPI_ID` | UPI payment ID (leave empty to hide UPI section) |
| `CAFE_UPI_PAYEE` | Display name for UPI payments |
| `CAFE_TABLE_COUNT` | Number of dine-in tables (default: 20) |

## Testing

```bash
npm test              # Run all tests (132 tests)
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests
npm run check:assets  # Verify all menu photos exist
```

## Project Structure

```
app/
  page.tsx              # Entry redirect to /menu
  menu/page.tsx         # Menu page (server component)
  api/orders/route.ts   # Order submission API
  globals.css           # Design system + responsive CSS
components/
  MenuApp.tsx           # Main ordering UI (client component)
lib/
  order-core.ts         # Pure ordering logic (shared)
  menu-data.ts          # Menu items + photos (single source of truth)
  sheets-client.ts      # Google Sheets submission client
  config.ts             # Server/client config
public/
  assets/               # Logo + badge
  uploads/              # Menu item photos
_dev/                   # Tests + dev tools
```

## License

Private - Cafe Mehfile
