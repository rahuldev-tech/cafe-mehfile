// Verifies the generated Google Apps Script (docs/orders-apps-script.gs.txt)
// PRICE_MAP stays in sync with the source menu (lib/menu-data.ts). If menu
// prices/names change, the generator (_dev/generate-sheets-script.mts) must be
// re-run so the deployed web app recomputes totals with the same data.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MENU_ITEMS } from '../lib/menu-data.ts';

const here = dirname(fileURLToPath(import.meta.url));
const gsPath = join(here, '..', 'docs', 'orders-apps-script.gs.txt');

type PriceMapEntry = { name: string; price: number };
type PriceMap = Record<string, PriceMapEntry>;

function extractPriceMap(): PriceMap {
  const content = readFileSync(gsPath, 'utf-8');
  const marker = 'var PRICE_MAP = ';
  const startIdx = content.indexOf(marker);
  assert.ok(startIdx >= 0, 'PRICE_MAP declaration not found in .gs file');
  const openIdx = content.indexOf('{', startIdx + marker.length);
  assert.ok(openIdx >= 0, 'PRICE_MAP object literal not found');
  let depth = 0;
  let i = openIdx;
  for (; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  assert.ok(depth === 0, 'PRICE_MAP object literal is not closed');
  const literal = content.slice(openIdx, i + 1);
  return JSON.parse(literal) as PriceMap;
}

describe('docs/orders-apps-script.gs.txt PRICE_MAP vs lib/menu-data.ts', () => {
  const priceMap = extractPriceMap();

  it('contains every MENU_ITEMS code', () => {
    for (const item of MENU_ITEMS) {
      assert.ok(priceMap[item.code], `price map missing code ${item.code} (${item.name})`);
    }
  });

  it('prices match', () => {
    for (const item of MENU_ITEMS) {
      assert.equal(
        priceMap[item.code].price,
        item.price,
        `price mismatch for ${item.code} (${item.name})`,
      );
    }
  });

  it('sizes match', () => {
    for (const item of MENU_ITEMS) {
      const mapped = priceMap[item.code].sizes ?? null;
      if (!item.sizes) {
        assert.equal(mapped, null, `expected no sizes for ${item.code}`);
        continue;
      }
      assert.ok(mapped, `expected sizes for ${item.code}`);
      for (const s of item.sizes) {
        assert.equal(mapped![s.label], s.price, `size price mismatch for ${item.code} ${s.label}`);
      }
      assert.equal(Object.keys(mapped!).length, item.sizes.length, `size count mismatch for ${item.code}`);
    }
  });

  it('names match', () => {
    for (const item of MENU_ITEMS) {
      assert.equal(
        priceMap[item.code].name,
        item.name,
        `name mismatch for ${item.code}`,
      );
    }
  });

  it('has no extra codes beyond MENU_ITEMS', () => {
    const menuCodes = new Set(MENU_ITEMS.map((i) => i.code));
    for (const code of Object.keys(priceMap)) {
      assert.ok(menuCodes.has(code), `price map has extra code ${code}`);
    }
  });
});