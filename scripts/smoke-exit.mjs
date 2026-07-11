import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Force hard reload to pick up module changes
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const editable = page.locator('[contenteditable="true"]');
await editable.click();
await page.keyboard.press('Meta+A');
await page.keyboard.press('Backspace');
await page.waitForTimeout(150);

// Create list via slash menu
await page.keyboard.type('/', { delay: 40 });
await page.waitForTimeout(300);
// Find bullet item
const bulletItem = page.locator('.uni-slash-menu-item', { hasText: 'Bulleted' });
if (await bulletItem.count() === 0) {
  // type filter
  await page.keyboard.type('bullet', { delay: 30 });
  await page.waitForTimeout(200);
}
const target = page.locator('.uni-slash-menu-item').filter({ hasText: /Bullet|bullet|无序/i }).first();
if (await target.count()) {
  await target.dispatchEvent('pointerdown');
} else {
  // fallback: toolbar bulletList
  await page.keyboard.press('Escape');
  await page.locator('[data-item="bulletList"]').click();
}
await page.waitForTimeout(250);

let mid = await page.evaluate(() => ({
  lists: document.querySelectorAll('ul,ol').length,
  lis: document.querySelectorAll('li').length,
  html: document.querySelector('.uni-editor-content')?.innerHTML?.slice(0, 400),
}));
console.log('after list create', mid);

await page.keyboard.type('one', { delay: 25 });
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
await page.keyboard.type('two', { delay: 25 });
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
// empty item → should exit list
await page.keyboard.press('Enter');
await page.waitForTimeout(350);

let state = await page.evaluate(() => ({
  html: document.querySelector('.uni-editor-content')?.innerHTML?.slice(0, 1200),
  lists: document.querySelectorAll('ul, ol').length,
  lis: document.querySelectorAll('li').length,
  text: document.querySelector('.uni-editor-content')?.innerText,
  blocks: document.querySelectorAll('[data-block-id]').length,
}));
console.log('after empty enter exit', JSON.stringify(state, null, 2));

// Should be able to type plain text outside list
await page.keyboard.type('plain', { delay: 20 });
await page.waitForTimeout(120);
const afterPlain = await page.evaluate(() => {
  const root = document.querySelector('.uni-editor-content');
  // last text should not be inside li
  const sel = window.getSelection();
  let n = sel?.anchorNode;
  let inLi = false;
  while (n && n !== root) {
    if (n.nodeName === 'LI') inLi = true;
    n = n.parentNode;
  }
  return { text: root?.innerText, inLi };
});
console.log('plain typing', afterPlain);

// Quote empty exit via toolbar
await page.keyboard.press('Enter');
await page.waitForTimeout(80);
await page.locator('[data-item="quote"]').click();
await page.waitForTimeout(150);
const qBefore = await page.locator('.uni-quote').count();
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const qAfter = await page.locator('.uni-quote').count();
console.log('quote', { qBefore, qAfter });

// H1
await page.locator('[data-item="heading1"]').click();
await page.waitForTimeout(100);
await page.keyboard.type('Title', { delay: 25 });
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
const h1 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.uni-h1')].pop();
  const block = el?.closest('[data-block-id]');
  return {
    text: el?.textContent,
    nextP: !!block?.nextElementSibling?.querySelector('.uni-paragraph, p'),
  };
});
console.log('h1', h1);

const selErrors = errors.filter((e) => e.includes('selection has been lost'));
console.log('selErrors', selErrors.length, selErrors[0]?.slice(0, 120));

const ok =
  state.lis >= 2 &&
  !afterPlain.inLi &&
  afterPlain.text?.includes('plain') &&
  qAfter === 0 &&
  h1.nextP &&
  selErrors.length === 0;

console.log({ ok, lis: state.lis, inLi: afterPlain.inLi, qAfter, h1 });
await browser.close();
process.exit(ok ? 0 : 1);
