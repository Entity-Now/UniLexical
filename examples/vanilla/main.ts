import { mountEditor, mountPreview } from '../../src/index';
import '../../src/ui/styles.css';
import '../../src/ui/preview.css';
// tippy styles (also bundled into dist/style.css for production)
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';

const handle = mountEditor({
  container: '#editor',
  placeholder: "输入文字，或键入 / 打开命令菜单…",
  tableMaxSize: { rows: 5, cols: 5 },
  imageOptions: {},
  initialContent: `# Welcome to UniLexical

Type \`/\` for the slash menu. Try markdown shortcuts:

- Type \`> \` + space for a quote
- Type \`# \` for Heading 1
- Wrap text with *italic* or **bold**

Hover a block to reveal **+** and the drag handle.
`,
  initialFormat: 'markdown',
});

// Live preview — host (#preview) has no library styles; content uses .uni-preview
const preview = mountPreview('#preview');
preview.bindEditor(handle.editor);

const out = document.getElementById('out')!;

document.getElementById('btn-md')!.onclick = () => {
  out.textContent = handle.getMarkdown();
};
document.getElementById('btn-html')!.onclick = () => {
  out.textContent = handle.getHtml();
};
document.getElementById('btn-json')!.onclick = () => {
  out.textContent = handle.getJson();
};
document.getElementById('btn-load-md')!.onclick = () => {
  handle.setContent(
    `## Reloaded\n\nThis content was loaded via \`setContent(md, 'markdown')\`.\n\n> Quotes work too.\n`,
    'markdown',
  );
};

console.log('[UniLexical vanilla] ready', handle.editor);
