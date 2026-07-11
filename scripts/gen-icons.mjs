/**
 * Copy Material Design outlined SVGs into src/ui/icons/svg and regenerate
 * src/ui/icons/index.ts for the toolbar.
 *
 * Requires: npm i -D @material-design-icons/svg
 * Run: node scripts/gen-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'node_modules/@material-design-icons/svg/outlined');
const outDir = path.join(root, 'src/ui/icons/svg');
const outTs = path.join(root, 'src/ui/icons/index.ts');

/** dest filename (no .svg) → material icon name */
const COPY = {
  undo: 'undo',
  redo: 'redo',
  format_paint: 'format_paint',
  format_clear: 'format_clear',
  title: 'title',
  looks_one: 'looks_one',
  looks_two: 'looks_two',
  looks_3: 'looks_3',
  looks_4: 'looks_4',
  looks_5: 'looks_5',
  looks_6: 'looks_6',
  notes: 'notes',
  format_size: 'format_size',
  text_fields: 'text_fields',
  format_bold: 'format_bold',
  format_italic: 'format_italic',
  format_underlined: 'format_underlined',
  strikethrough_s: 'strikethrough_s',
  code: 'code',
  highlight: 'highlight',
  format_color_text: 'format_color_text',
  subscript: 'subscript',
  superscript: 'superscript',
  format_align_left: 'format_align_left',
  format_align_center: 'format_align_center',
  format_align_right: 'format_align_right',
  format_align_justify: 'format_align_justify',
  format_line_spacing: 'format_line_spacing',
  format_list_bulleted: 'format_list_bulleted',
  format_list_numbered: 'format_list_numbered',
  checklist: 'checklist',
  check_box: 'check_box',
  format_indent_decrease: 'format_indent_decrease',
  format_indent_increase: 'format_indent_increase',
  format_quote: 'format_quote',
  data_object: 'data_object',
  view_agenda: 'view_agenda',
  link: 'link',
  image: 'image',
  attach_file: 'attach_file',
  table_chart: 'table_chart',
  grid_on: 'grid_on',
  format_color_fill: 'format_color_fill',
  horizontal_rule: 'horizontal_rule',
  keyboard_return: 'keyboard_return',
  mood: 'mood',
  star: 'star',
  terminal: 'terminal',
  fullscreen: 'fullscreen',
  print: 'print',
  integration_instructions: 'integration_instructions',
};

const TOOLBAR_MAP = {
  undo: 'undo',
  redo: 'redo',
  painter: 'format_paint',
  eraser: 'format_clear',
  heading: 'title',
  heading1: 'looks_one',
  heading2: 'looks_two',
  heading3: 'looks_3',
  heading4: 'looks_4',
  heading5: 'looks_5',
  heading6: 'looks_6',
  paragraph: 'notes',
  fontSize: 'format_size',
  fontFamily: 'text_fields',
  bold: 'format_bold',
  italic: 'format_italic',
  underline: 'format_underlined',
  strike: 'strikethrough_s',
  strikethrough: 'strikethrough_s',
  code: 'code',
  highlight: 'highlight',
  fontColor: 'format_color_text',
  subscript: 'subscript',
  superscript: 'superscript',
  align: 'format_align_justify',
  alignLeft: 'format_align_left',
  alignCenter: 'format_align_center',
  alignRight: 'format_align_right',
  alignJustify: 'format_align_justify',
  lineHeight: 'format_line_spacing',
  bulletList: 'format_list_bulleted',
  orderedList: 'format_list_numbered',
  numberedList: 'format_list_numbered',
  todo: 'checklist',
  indentDecrease: 'format_indent_decrease',
  indentIncrease: 'format_indent_increase',
  quote: 'format_quote',
  codeBlock: 'data_object',
  container: 'view_agenda',
  link: 'link',
  image: 'image',
  attachment: 'attach_file',
  table: 'table_chart',
  tableCellBackgroundColor: 'format_color_fill',
  hr: 'horizontal_rule',
  break: 'keyboard_return',
  emoji: 'mood',
  custom: 'star',
  sourceCode: 'integration_instructions',
  fullscreen: 'fullscreen',
  printer: 'print',
};

function normalizeSvg(raw) {
  let s = raw.trim();
  s = s.replace(/\sfill="[^"]*"/g, '');
  s = s.replace(/<svg\b/, '<svg fill="currentColor" aria-hidden="true" focusable="false"');
  return s;
}

if (!fs.existsSync(srcDir)) {
  console.error('Missing @material-design-icons/svg. Run: npm i -D @material-design-icons/svg');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
for (const [dest, src] of Object.entries(COPY)) {
  const from = path.join(srcDir, `${src}.svg`);
  if (!fs.existsSync(from)) {
    console.warn('MISSING material icon:', src);
    continue;
  }
  fs.copyFileSync(from, path.join(outDir, `${dest}.svg`));
}

const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.svg')).sort();
const icons = {};
for (const f of files) {
  const key = f.replace(/\.svg$/, '');
  icons[key] = normalizeSvg(fs.readFileSync(path.join(outDir, f), 'utf8'));
}

const missing = [...new Set(Object.values(TOOLBAR_MAP))].filter((k) => !icons[k]);
if (missing.length) {
  console.error('Missing icon keys for toolbar:', missing);
  process.exit(1);
}

const lines = [];
lines.push('/**');
lines.push(' * Material Design Icons (Outlined) — local SVG strings.');
lines.push(' * Source: @material-design-icons/svg (Apache-2.0)');
lines.push(' * Generated by scripts/gen-icons.mjs — re-run after changing the map.');
lines.push(' */');
lines.push('');
lines.push('export const MATERIAL_ICONS = {');
for (const [k, v] of Object.entries(icons).sort()) {
  lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
}
lines.push('} as const;');
lines.push('');
lines.push('export type MaterialIconName = keyof typeof MATERIAL_ICONS;');
lines.push('');
lines.push('/** Toolbar item id → Material icon name */');
lines.push('export const TOOLBAR_ICON_MAP = {');
for (const [k, v] of Object.entries(TOOLBAR_MAP)) {
  lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
}
lines.push('} as const;');
lines.push('');
lines.push('export function getToolbarIconSvg(itemId: string): string | null {');
lines.push('  const key = TOOLBAR_ICON_MAP[itemId as keyof typeof TOOLBAR_ICON_MAP];');
lines.push('  if (!key) return null;');
lines.push('  return MATERIAL_ICONS[key] ?? null;');
lines.push('}');
lines.push('');
lines.push('/** Create an SVG element for a toolbar button */');
lines.push('export function createToolbarIconEl(itemId: string): HTMLElement | null {');
lines.push('  const svg = getToolbarIconSvg(itemId);');
lines.push('  if (!svg) return null;');
lines.push('  const span = document.createElement("span");');
lines.push('  span.className = "uni-toolbar-icon";');
lines.push('  span.innerHTML = svg;');
lines.push('  return span;');
lines.push('}');
lines.push('');

fs.writeFileSync(outTs, lines.join('\n'));
console.log(`Wrote ${outTs} (${Object.keys(icons).length} icons, ${Object.keys(TOOLBAR_MAP).length} toolbar mappings)`);
