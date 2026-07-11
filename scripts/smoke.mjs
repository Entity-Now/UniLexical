import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const meta = await page.evaluate(() => ({
  contentEditable: document.querySelector('.uni-editor-content')?.getAttribute('contenteditable'),
  toolbar: document.querySelectorAll('.uni-toolbar-btn').length,
  blocks: document.querySelectorAll('.uni-block-wrapper').length,
}));

// Slash menu
const editable = page.locator('[contenteditable="true"]');
await editable.click();
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.keyboard.type('/he', { delay: 30 });
await page.waitForTimeout(300);
const slashItems = await page.locator('.uni-slash-menu-item').count();
const slashVisible = await page.locator('.uni-slash-menu').evaluate(el => getComputedStyle(el).display === 'block');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);

// Clear and test shortcuts
await page.keyboard.press('Meta+A');
await page.keyboard.press('Backspace');
await page.waitForTimeout(100);

// Quote
await page.keyboard.type('>', { delay: 40 });
await page.keyboard.press('Space');
await page.waitForTimeout(200);
const quotes = await page.locator('.uni-quote').count();

// New line + H1
await page.keyboard.press('Enter');
await page.keyboard.type('#', { delay: 40 });
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.keyboard.type('Title');
const h1 = await page.locator('.uni-h1').count();

// Bold
await page.keyboard.press('Enter');
await page.keyboard.type('**bold**', { delay: 30 });
await page.waitForTimeout(250);
const bold = await page.locator('.uni-text-bold').count();

// Italic
await page.keyboard.type(' and *ital*', { delay: 30 });
await page.waitForTimeout(250);
const italic = await page.locator('.uni-text-italic').count();

// Overlay
await page.locator('.uni-block-wrapper').first().hover();
await page.waitForTimeout(150);
const overlay = await page.locator('.uni-block-overlay').isVisible();
const plus = await page.locator('.uni-plus-button').count();
const drag = await page.locator('.uni-drag-handle').count();

// Export
await page.click('#btn-md');
const md = await page.locator('#out').innerText();
await page.click('#btn-html');
const html = await page.locator('#out').innerText();

const result = {
  meta, slashItems, slashVisible, quotes, h1, bold, italic,
  overlay, plus, drag,
  mdSnippet: md.slice(0, 120),
  htmlSnippet: html.slice(0, 120),
  errors,
  ok: errors.length === 0 && meta.contentEditable === 'true' && slashVisible && quotes >= 1 && bold >= 1 && overlay,
};
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
