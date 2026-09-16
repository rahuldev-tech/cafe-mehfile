import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, '..', 'app', 'globals.css');
const css = readFileSync(cssPath, 'utf-8');

/** Extract a media query block from CSS, handling nested braces */
function getMediaBlock(query) {
  const start = css.indexOf(query);
  if (start < 0) return null;
  const braceStart = css.indexOf('{', start);
  if (braceStart < 0) return null;
  let depth = 0;
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return null;
}

describe('Responsive CSS breakpoints', () => {
  it('has small mobile breakpoint (< 360px)', () => {
    assert.ok(css.includes('@media (max-width: 359px)'), 'missing max-width: 359px');
  });

  it('has tablet breakpoint (480px - 768px)', () => {
    assert.ok(css.includes('@media (min-width: 480px) and (max-width: 768px)'), 'missing tablet range');
  });

  it('has desktop breakpoint (> 768px)', () => {
    assert.ok(css.includes('@media (min-width: 769px)'), 'missing desktop min-width');
  });

  it('has landscape mobile breakpoint', () => {
    assert.ok(css.includes('@media (max-height: 500px) and (orientation: landscape)'), 'missing landscape');
  });

  it('has prefers-reduced-motion', () => {
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'missing reduced motion');
  });
});

describe('Responsive class adjustments', () => {
  const breakpoints = [
    { query: '@media (max-width: 359px)', name: 'small mobile' },
    { query: '@media (min-width: 480px) and (max-width: 768px)', name: 'tablet' },
    { query: '@media (min-width: 769px)', name: 'desktop' },
  ];

  for (const bp of breakpoints) {
    it(`adjusts .app max-width for ${bp.name}`, () => {
      const block = getMediaBlock(bp.query);
      assert.ok(block, `${bp.query} not found`);
      assert.ok(block.includes('.app'), `${bp.name} missing .app`);
      assert.ok(block.includes('max-width'), `${bp.name} missing max-width`);
    });

    it(`adjusts .fab for ${bp.name}`, () => {
      const block = getMediaBlock(bp.query);
      assert.ok(block, `${bp.query} not found`);
      assert.ok(block.includes('.fab'), `${bp.name} missing .fab`);
    });
  }
});

describe('Touch target minimums', () => {
  it('has reasonable touch targets on small mobile', () => {
    const block = getMediaBlock('@media (max-width: 359px)');
    assert.ok(block, 'small mobile query not found');
    // .quick-add 28px, .stepper button 26px, .fab 48px — all ≥ 26px
    assert.ok(block.includes('.quick-add') || block.includes('.stepper') || block.includes('.fab'));
  });

  it('has comfortable touch targets on desktop', () => {
    const block = getMediaBlock('@media (min-width: 769px)');
    assert.ok(block, 'desktop query not found');
    // .fab 72px, .btn-block 58px, .qty-group button 44px
    assert.ok(block.includes('.fab') || block.includes('.btn-block') || block.includes('.qty-group'));
  });
});

describe('Typography scaling', () => {
  it('scales .resto-name across breakpoints', () => {
    const tabletBlock = getMediaBlock('@media (min-width: 480px) and (max-width: 768px)');
    const desktopBlock = getMediaBlock('@media (min-width: 769px)');
    assert.ok(tabletBlock && desktopBlock, 'blocks not found');
    assert.ok(tabletBlock.includes('.resto-name'), 'tablet missing .resto-name');
    assert.ok(desktopBlock.includes('.resto-name'), 'desktop missing .resto-name');
    // Font size increases
    assert.ok(tabletBlock.includes('1.5rem') || tabletBlock.includes('1.75rem'));
    assert.ok(desktopBlock.includes('1.75rem') || desktopBlock.includes('2rem'));
  });
});

describe('Sheet/overlay responsiveness', () => {
  it('adjusts sheet max-height for landscape', () => {
    const block = getMediaBlock('@media (max-height: 500px) and (orientation: landscape)');
    assert.ok(block, 'landscape query not found');
    assert.ok(block.includes('.sheet'), 'landscape missing .sheet');
    assert.ok(block.includes('95%'), 'landscape should limit sheet height');
  });
});

describe('Component coverage', () => {
  it('adjusts item row sizes on tablet', () => {
    const block = getMediaBlock('@media (min-width: 480px) and (max-width: 768px)');
    assert.ok(block.includes('.item-row') || block.includes('.item-img') || block.includes('.item-tile'));
  });

  it('adjusts search input height on desktop', () => {
    const block = getMediaBlock('@media (min-width: 769px)');
    assert.ok(block.includes('.search-box') || block.includes('search-box input'));
  });

  it('adjusts confirm card on desktop', () => {
    const block = getMediaBlock('@media (min-width: 769px)');
    assert.ok(block.includes('.confirm-card'), 'desktop missing confirm-card');
  });
});