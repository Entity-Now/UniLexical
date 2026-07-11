import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
page.on('pageerror', e => console.log('PAGEERR', e.message));
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// Use setContent to start clean with a simple paragraph
await page.evaluate(() => {
  // access via window if exposed — not available. Click and select all instead
});

const editable = page.locator('[contenteditable="true"]');
await editable.click();
await page.keyboard.press('Meta+A');
await page.keyboard.press('Backspace');
await page.waitForTimeout(150);

// Force paragraph via toolbar
const paraBtn = page.locator('[data-item="paragraph"]');
if (await paraBtn.count()) {
  await paraBtn.click();
  await page.waitForTimeout(100);
}

await page.keyboard.type('>', { delay: 50 });
await page.waitForTimeout(50);
// Dispatch keydown Space explicitly
await page.keyboard.press('Space');
await page.waitForTimeout(400);

const state = await page.evaluate(() => {
  const root = document.querySelector('.uni-editor-content');
  return {
    text: root?.innerText,
    html: root?.innerHTML?.slice(0, 600),
    quotes: document.querySelectorAll('.uni-quote, blockquote').length,
    h1: document.querySelectorAll('.uni-h1, h1').length,
    p: document.querySelectorAll('.uni-paragraph, p').length,
  };
});
console.log(JSON.stringify(state, null, 2));
console.log('logs', logs.filter(l => !l.includes('Download') && !l.includes('DevTools')).slice(0, 30));

await browser.close();
