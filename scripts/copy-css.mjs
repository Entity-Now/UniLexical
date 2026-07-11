import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'dist'), { recursive: true });

const ourCss = readFileSync(join(root, 'src/ui/styles.css'), 'utf8');

// Prepend tippy base styles so consumers only need unilexical/style.css
let tippyCss = '';
const tippyPath = join(root, 'node_modules/tippy.js/dist/tippy.css');
const tippyAnim = join(root, 'node_modules/tippy.js/animations/shift-away.css');
if (existsSync(tippyPath)) tippyCss += readFileSync(tippyPath, 'utf8') + '\n';
if (existsSync(tippyAnim)) tippyCss += readFileSync(tippyAnim, 'utf8') + '\n';

writeFileSync(join(root, 'dist/style.css'), `/* tippy.js base */\n${tippyCss}\n/* UniLexical */\n${ourCss}`);
console.log('Wrote dist/style.css (tippy + UniLexical)');

// Content-only preview CSS (no chrome — safe for host apps)
const previewCssPath = join(root, 'src/ui/preview.css');
if (existsSync(previewCssPath)) {
  copyFileSync(previewCssPath, join(root, 'dist/preview.css'));
  console.log('Wrote dist/preview.css');
}
