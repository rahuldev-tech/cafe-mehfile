// Verifies every referenced photo asset exists on disk under public/{photo}.
// Exit code 0 = all photos present, 1 = one or more missing.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MENU_ITEMS } from '../lib/menu-data.ts';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

const withPhotos = MENU_ITEMS.filter((i) => Boolean(i.photo));
const missing: Array<{ code: string; name: string; photo: string; path: string }> = [];

for (const item of withPhotos) {
  const rel = item.photo!.replace(/^\//, '');
  const abs = join(publicDir, rel);
  if (!existsSync(abs)) {
    missing.push({ code: item.code, name: item.name, photo: item.photo!, path: abs });
  }
}

const headline = [
  `Asset check: ${MENU_ITEMS.length} total items, ${withPhotos.length} with photos, ${MENU_ITEMS.length - withPhotos.length} without photos.`,
  withPhotos.length - missing.length ? `${withPhotos.length - missing.length}/${withPhotos.length} photo files present.` : 'No photo files present.',
  missing.length ? `${missing.length} photo(s) MISSING.` : 'All photos present.',
];

if (missing.length > 0) {
  console.log(headline.join('\n'));
  for (const m of missing) {
    console.log(`  MISSING ${m.code} ${m.name} -> ${m.path}`);
  }
} else {
  console.log(headline.join(' '));
}

process.exitCode = missing.length === 0 ? 0 : 1;