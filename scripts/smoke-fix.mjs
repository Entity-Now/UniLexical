import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

// --- Vanilla ---
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const editable = page.locator('[contenteditable="true"]');
await editable.click();
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.keyboard.type('/', { delay: 40 });
await page.waitForTimeout(400);

const slash = await page.locator('.uni-slash-menu').evaluate((el) => {
  const cs = getComputedStyle(el);
  return {
    display: cs.display,
    bg: cs.backgroundColor,
    items: el.querySelectorAll('.uni-slash-menu-item').length,
  };
});
console.log('slash open', slash);

// Click first slash item via pointerdown
const firstItem = page.locator('.uni-slash-menu-item').first();
if (await firstItem.count()) {
  await firstItem.dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
}
const slashAfter = await page.locator('.uni-slash-menu').evaluate((el) => getComputedStyle(el).display);
const blocksAfterSlash = await page.locator('.uni-block-wrapper').count();
console.log('slash after click', { slashAfter, blocksAfterSlash });

// Hover + plus
const block = page.locator('.uni-block-wrapper').first();
await block.hover();
await page.waitForTimeout(200);
const overlay = await page.locator('.uni-block-overlay').evaluate((el) => ({
  display: getComputedStyle(el).display,
  left: el.style.left,
}));
console.log('overlay', overlay);

// Click plus via pointer events while keeping hover path
const plus = page.locator('.uni-plus-button');
// Move to plus
const plusBox = await plus.boundingBox();
if (plusBox) {
  await page.mouse.move(plusBox.x + 10, plusBox.y + 10);
  await page.waitForTimeout(100);
  const blocksBefore = await page.locator('.uni-block-wrapper').count();
  await plus.click({ force: true });
  await page.waitForTimeout(400);
  const blocksAfterPlus = await page.locator('.uni-block-wrapper').count();
  const slashFromPlus = await page.locator('.uni-slash-menu').evaluate((el) => getComputedStyle(el).display);
  console.log('plus', { blocksBefore, blocksAfterPlus, slashFromPlus });
}

// Drag handle exists and is draggable
const drag = page.locator('.uni-drag-handle');
const dragInfo = await drag.evaluate((el) => ({
  draggable: el.draggable,
  tag: el.tagName,
}));
console.log('drag', dragInfo);

// Image insert via toolbar
const imgBtn = page.locator('[data-item="image"]');
// Intercept file chooser
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null),
  imgBtn.click(),
]);
if (fileChooser) {
  // Create a tiny 1x1 png
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  writeFileSync('/tmp/uni-test.png', png);
  await fileChooser.setFiles('/tmp/uni-test.png');
  await page.waitForTimeout(800);
}
const images = await page.locator('.uni-image-el, .uni-image-wrap img').count();
console.log('images', images);
console.log('errors', errors);

// --- Vue ---
let vueOk = false;
try {
  const page2 = await browser.newPage();
  const vueErrors = [];
  page2.on('pageerror', (e) => vueErrors.push(String(e)));
  page2.on('console', (m) => {
    if (m.type() === 'error') vueErrors.push(m.text());
  });
  // start vue if needed - check port
  const resp = await page2.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 5000 }).catch(() => null);
  if (resp) {
    await page2.waitForTimeout(500);
    const hasEditor = await page2.locator('.uni-editor-content, [contenteditable="true"]').count();
    const warn = vueErrors.some((e) => e.includes('runtime compilation'));
    vueOk = hasEditor > 0 && !warn;
    console.log('vue', { hasEditor, warn, vueErrors: vueErrors.slice(0, 5) });
  } else {
    console.log('vue server not running on 5174');
  }
  await page2.close();
} catch (e) {
  console.log('vue check failed', e.message);
}

await browser.close();
const ok = slash.display === 'block' && slash.bg !== 'rgba(0, 0, 0, 0)' && slash.items > 0 && errors.length === 0;
console.log(JSON.stringify({ ok, slashClosed: slashAfter === 'none', images, errors }, null, 2));
process.exit(ok ? 0 : 1);
