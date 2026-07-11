# UniLexical

<p align="center">
  <strong>Framework-agnostic, Notion-style block editor</strong><br/>
  Powered by <a href="https://lexical.dev">Lexical</a> · Pure TypeScript core · Thin Vue 3 / React / Vanilla wrappers
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Install</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#configuration">Config</a> ·
  <a href="#toolbar-items">Toolbar</a> ·
  <a href="#preview">Preview</a> ·
  <a href="#api">API</a> ·
  <a href="#events">Events</a>
</p>

---

**UniLexical** is an industrial-grade, block-based rich-text editor. The editor state, plugins, toolbar, slash menu, drag handles, and serialization live in a **framework-agnostic TypeScript core**. Vue 3 and React are **thin lifecycle wrappers** only—so you get one consistent behavior across stacks.

| Package | npm name | Description |
| --- | --- | --- |
| Core + Vanilla | `unilexical` | `mountEditor`, `UniEditor`, preview, types |
| Vue 3 | `unilexical/vue` | `<UniLexical />`, `<UniLexicalPreview />`, `useLexical` |
| React | `unilexical/react` | `<UniLexical />`, `<UniLexicalPreview />`, `useLexical` |
| Editor chrome CSS | `unilexical/style.css` | Toolbar, slash menu, overlay, tippy |
| Preview CSS only | `unilexical/preview.css` | Content styles under `.uni-preview` (no host chrome) |

---

## Features

- **Block model** – Every top-level unit is a block with hover chrome (drag + plus)
- **Drag & drop reorder** – Notion-like handle; click handle for a **block more-menu** (delete / turn into / color / …)
- **Plus button** – Empty line → open `/` without adding a line; non-empty → insert below + slash
- **Slash menu** – Type `/` for headings, lists, todo, table, image, divider, code, …
- **Markdown shortcuts** – `# `, `> `, `- `, `1. `, `**bold**`, `*italic*`, `` `code` ``, …
- **Configurable toolbar** – Full set by default; pass `toolbarItems` for a strict subset
- **Import / export** – HTML · Markdown · JSON
- **Images** – Custom `upload` or default **base64**; paste / drop screenshots supported
- **Attachments** – Optional custom upload
- **Tables** – Interactive grid size picker (default 5×5, configurable)
- **Checklists / todo** – Visible checkboxes, gutter toggle
- **Container / callout** – Enter on empty line exits the container
- **Live preview** – Host-safe content renderer (no chrome styles on your container)
- **Material icons** – Local outlined SVG toolbar icons

---

## Installation

Package name on npm: **`unilexical`** (display name **UniLexical**).

```bash
# Core (Vanilla / any framework)
npm install unilexical

# With Vue 3
npm install unilexical vue

# With React
npm install unilexical react react-dom
```

Yarn / pnpm:

```bash
yarn add unilexical
pnpm add unilexical
```

> Lexical packages are **bundled as dependencies** of `unilexical`. You typically do **not** need to install `lexical` separately unless you extend nodes yourself.

### Styles

```ts
// Editor UI (toolbar, slash, drag overlay, tippy)
import 'unilexical/style.css';

// Optional: content-only preview (does not style your host container)
import 'unilexical/preview.css';
```

---

## Quick start

### Vanilla JS / TypeScript

```ts
import { mountEditor, mountPreview } from 'unilexical';
import 'unilexical/style.css';
import 'unilexical/preview.css';

const { editor, getHtml, getMarkdown, setContent, destroy } = mountEditor({
  container: '#editor',
  placeholder: "Type '/' for commands…",
  // omit toolbarItems → full toolbar
  toolbarItems: ['bold', 'italic', 'underline', 'divider', 'heading', 'image', 'table'],
  imageOptions: {
    // omit upload → images stored as base64 data URLs
    upload: async (file) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      return data.url; // public URL string
    },
    accept: 'image/*',
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  initialContent: '# Hello UniLexical\n\nStart writing…',
  initialFormat: 'markdown',
});

// Live preview
const preview = mountPreview('#preview');
preview.bindEditor(editor);

editor.on('change', ({ html, markdown, json }) => {
  console.log('changed', { html, markdown, json });
});

// Cleanup
// destroy();
// preview.destroy();
```

```html
<div id="editor"></div>
<div id="preview"></div>
```

### Vue 3

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { UniLexical, UniLexicalPreview } from 'unilexical/vue';
import type { UniEditor } from 'unilexical';
import 'unilexical/style.css';
import 'unilexical/preview.css';

const html = ref('');
const editor = ref<UniEditor | null>(null);

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await res.json();
  return data.url;
}
</script>

<template>
  <UniLexical
    :toolbar-items="['bold', 'italic', 'underline', 'divider', 'heading1', 'image', 'table']"
    :image-options="{ upload: uploadImage, maxSize: 5 * 1024 * 1024 }"
    placeholder="Vue 3…"
    initial-content="# Vue + UniLexical"
    initial-format="markdown"
    @change="(p) => (html = p.html)"
    @ready="(ed) => (editor = ed)"
  />
  <UniLexicalPreview :html="html" />
</template>
```

### React

```tsx
import { useState } from 'react';
import { UniLexical, UniLexicalPreview } from 'unilexical/react';
import 'unilexical/style.css';
import 'unilexical/preview.css';

export function App() {
  const [html, setHtml] = useState('');

  return (
    <>
      <UniLexical
        toolbarItems={['bold', 'italic', 'underline', 'divider', 'heading1', 'image']}
        imageOptions={{
          upload: async (file) => {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await res.json();
            return data.url as string;
          },
        }}
        placeholder="React…"
        initialContent="# React + UniLexical"
        initialFormat="markdown"
        onChange={({ html }) => setHtml(html)}
        onReady={(editor) => setHtml(editor.getHtml())}
      />
      <UniLexicalPreview html={html} />
    </>
  );
}
```

---

## Configuration

All of the following are accepted by:

- `mountEditor({ ... })` / `createUniEditor({ ... })` (Vanilla)
- `<UniLexical />` props (Vue / React)
- `useLexical({ ... })` (Vue / React hooks)

### `UniEditorConfig`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `string \| HTMLElement` | — | **Vanilla only** (`mountEditor`). CSS selector or element. |
| `placeholder` | `string` | `"Type '/' for commands…"` | Empty-editor placeholder. |
| `namespace` | `string` | `"UniLexical"` | Lexical namespace (clipboard isolation). |
| `editable` | `boolean` | `true` | Content editable. |
| `builtinUI` | `boolean` | `true` | Mount built-in toolbar, slash UI, block overlay. Set `false` for headless / custom UI. |
| `toolbarItems` | `ToolbarItemId[]` | **full default set** | If **omitted / `undefined`** → all features. If you pass an array (even empty), **only** those items render. |
| `initialContent` | `string` | — | Initial document. |
| `initialFormat` | `'html' \| 'markdown' \| 'json'` | — | Format of `initialContent`. |
| `imageOptions` | `ImageOptions` | `{}` | Image insert / paste / upload. |
| `attachmentOptions` | `AttachmentOptions` | `{}` | File attachments. |
| `tableMaxSize` | `{ rows: number; cols: number }` | `{ rows: 5, cols: 5 }` | Table size picker board. |
| `theme` | `UniEditorTheme` | built-in | Partial override of Lexical / Uni theme class names. |
| `nodes` | `Klass<LexicalNode>[]` | — | Extra Lexical nodes to register. |
| `onCustomAction` | `() => void` | — | Handler for toolbar item `'custom'`. |

### `ImageOptions`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `upload` | `(file: File) => Promise<string>` | — | Custom uploader. Return a **public URL**. If omitted, the file is read as a **base64 data URL** and embedded. |
| `accept` | `string` | `'image/*'` | `<input type="file" accept>` for the image picker. |
| `maxSize` | `number` | — | Max file size in **bytes**. Throws if exceeded. |

```ts
imageOptions: {
  upload: async (file) => {
    // 1) upload to your CDN / OSS
    // 2) return the final HTTPS URL
    return 'https://cdn.example.com/a.png';
  },
  accept: 'image/png,image/jpeg,image/webp,image/gif',
  maxSize: 8 * 1024 * 1024,
}
```

**Paste / drop:** Ctrl/Cmd+V screenshots and image files, and drag-drop images, use the same pipeline (`upload` or base64).

### `AttachmentOptions`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `upload` | `(file: File) => Promise<{ url: string; name?: string }>` | — | Custom uploader. Without it, files are stored as data URLs. |
| `accept` | `string` | `'*/*'` | File input accept. |
| `maxSize` | `number` | — | Max size in bytes. |

---

## Toolbar items

### Behavior

- **`toolbarItems` not passed** → full feature toolbar (`DEFAULT_TOOLBAR_ITEMS`).
- **`toolbarItems: [...]`** → **only** the listed controls (order preserved).
- **`toolbarItems: []`** → no toolbar buttons (chrome may still reserve space if `builtinUI` is true).

Separators:

| Id | Meaning |
| --- | --- |
| `divider` | Visual separator |
| `group` | Group spacing separator |

### Full list

| Id | Group | Description |
| --- | --- | --- |
| `undo` | History | Undo |
| `redo` | History | Redo |
| `painter` | Format | Format painter |
| `eraser` | Format | Clear formatting |
| `bold` | Inline | Bold |
| `italic` | Inline | Italic |
| `underline` | Inline | Underline |
| `strike` | Inline | Strikethrough |
| `strikethrough` | Inline | **Alias** of `strike` |
| `code` | Inline | Inline code |
| `highlight` | Inline | Highlight |
| `subscript` | Inline | Subscript |
| `superscript` | Inline | Superscript |
| `fontColor` | Typography | Text color palette |
| `fontFamily` | Typography | Font family |
| `fontSize` | Typography | Font size |
| `lineHeight` | Typography | Line height |
| `heading` | Blocks | Heading menu (paragraph + H1–H6) |
| `heading1` … `heading6` | Blocks | Direct heading level |
| `paragraph` | Blocks | Paragraph |
| `quote` | Blocks | Blockquote |
| `codeBlock` | Blocks | Code block |
| `bulletList` | Lists | Bulleted list |
| `orderedList` | Lists | Numbered list |
| `numberedList` | Lists | **Alias** of `orderedList` |
| `todo` | Lists | Checklist / to-do |
| `container` | Blocks | Callout / container |
| `align` | Align | Align menu |
| `alignLeft` | Align | Align left |
| `alignCenter` | Align | Align center |
| `alignRight` | Align | Align right |
| `alignJustify` | Align | Justify |
| `indentIncrease` | Indent | Increase indent |
| `indentDecrease` | Indent | Decrease indent |
| `link` | Insert | Link |
| `image` | Insert | Image (file picker) |
| `attachment` | Insert | Attachment |
| `table` | Insert | Table (size grid) |
| `tableCellBackgroundColor` | Insert | Table cell background |
| `hr` | Insert | Horizontal rule |
| `break` | Insert | Hard line break |
| `emoji` | Insert | Emoji picker |
| `custom` | Insert | Fires `onCustomAction` / `customAction` event |
| `sourceCode` | View | Toggle HTML source mode |
| `fullscreen` | View | Toggle fullscreen |
| `printer` | View | Print |

### Example presets

```ts
// Minimal writing
toolbarItems: ['bold', 'italic', 'underline', 'divider', 'link']

// Docs / Notion-like
toolbarItems: [
  'undo', 'redo', 'divider',
  'heading', 'bold', 'italic', 'strike', 'code', 'fontColor', 'divider',
  'bulletList', 'orderedList', 'todo', 'quote', 'codeBlock', 'divider',
  'image', 'table', 'hr',
]

// Separators only control layout between buttons
toolbarItems: ['bold', 'divider', 'image']
```

---

## Preview

Use **`UniPreview` / `UniLexicalPreview`** to render cleaned HTML outside the editor.

- The **host element is not given chrome styles** (safe for your design system).
- Content is rendered inside an inner `.uni-preview` node; import **`unilexical/preview.css`** for typography, lists, images, tables, etc.

### Vanilla

```ts
import { mountPreview } from 'unilexical';
import 'unilexical/preview.css';

const preview = mountPreview('#preview');
preview.bindEditor(editor);     // live
// preview.setHtml(editor.getHtml());
// preview.destroy();
```

### Vue / React

```vue
<UniLexicalPreview :html="html" />
<!-- or live instance -->
<UniLexicalPreview :editor="editor" />
```

```tsx
<UniLexicalPreview html={html} />
<UniLexicalPreview editor={editor} />
```

| Prop | Type | Description |
| --- | --- | --- |
| `html` | `string` | Cleaned HTML (e.g. from `change` or `getHtml()`). |
| `editor` | `UniEditor \| null` | When set, auto-subscribes to `change` and re-renders. |
| `className` | `string` | Extra class on the **inner** `.uni-preview` root. |

---

## Framework wrappers

### Vue 3 – `<UniLexical />`

| Prop | Type | Notes |
| --- | --- | --- |
| `toolbar-items` | `ToolbarItemId[]` | See [Toolbar items](#toolbar-items) |
| `image-options` | `ImageOptions` | Upload / accept / maxSize |
| `initial-content` | `string` | Initial document |
| `initial-format` | `'html' \| 'markdown' \| 'json'` | Default `'markdown'` |
| `placeholder` | `string` | |
| `builtin-ui` | `boolean` | Default `true` |
| `editable` | `boolean` | Default `true` |
| `slash-items` | `SlashMenuItem[]` | Custom slash catalog |

**Events:** `change`, `ready`, `toolbarChange`

**Exposed methods (template ref):**

| Method | Description |
| --- | --- |
| `getHtml()` / `getMarkdown()` / `getContent(format)` | Export |
| `setContent(content, format?)` | Import |
| `focus()` | Focus editor |
| `editor` | `ShallowRef<UniEditor \| null>` |

### React – `<UniLexical />`

Same options as camelCase props: `toolbarItems`, `imageOptions`, `initialContent`, `initialFormat`, `placeholder`, `builtinUI`, `editable`, `slashItems`, `className`, `style`.

**Callbacks:** `onChange`, `onReady`, `onToolbarChange`

**Ref handle:** `getHtml`, `getMarkdown`, `getContent`, `setContent`, `focus`, `editor`

### Hooks

```ts
// Vue
import { useLexical } from 'unilexical/vue';

// React
import { useLexical } from 'unilexical/react';
```

Returns container ref, editor instance, toolbar state, and content helpers for fully custom layouts (`builtinUI: false`).

---

## API – `UniEditor`

```ts
import { createUniEditor, type UniEditor } from 'unilexical';

const editor = createUniEditor(config);
editor.mount(element);
```

### Content

| Method | Description |
| --- | --- |
| `getContent(format?)` | `'json' \| 'html' \| 'markdown'` (default `json`) |
| `setContent(content, format?)` | Replace document |
| `getHtml()` / `getMarkdown()` / `getJson()` | Shortcuts |
| `insertImageFile(file)` | Insert image (uses `imageOptions`) |
| `insertImageUrl(src, alt?)` | Insert by URL |
| `insertTable(rows, cols)` | Insert table |

### UI / state

| Method | Description |
| --- | --- |
| `setEditable(boolean)` | Toggle editing |
| `setToolbarItems(items)` | Replace toolbar set at runtime |
| `getToolbarState()` | Current format snapshot |
| `setSlashItems(items)` | Replace slash menu items |
| `execToolbar(item)` | Programmatically click a toolbar id |
| `focus()` / `blur()` | Focus management |
| `getLexicalEditor()` | Underlying Lexical `LexicalEditor` |
| `destroy()` | Unmount and dispose |

### Events

```ts
const off = editor.on('change', ({ html, markdown, json }) => { /* ... */ });
off(); // unsubscribe
```

| Event | Payload | When |
| --- | --- | --- |
| `ready` | `void` | Mounted and ready |
| `change` | `{ html, markdown, json }` | Document changed (debounced) |
| `toolbarChange` | `ToolbarState` | Selection / format state changed |
| `slashTriggered` | `SlashTriggerPayload` | Slash menu open / query / close |
| `blockHoverChanged` | `BlockHoverPayload` | Block hover for overlay |
| `paste` | `PastePayload` | Paste / drop media or text |
| `fullscreenChange` | `boolean` | Fullscreen toggled |
| `sourceModeChange` | `{ open, content }` | Source mode toggled |
| `customAction` | `void` | Toolbar `custom` pressed |
| `error` | `Error` | Lexical / runtime error |
| `destroy` | `void` | After destroy |

---

## Block UX

| Control | Action |
| --- | --- |
| **Hover block** | Outline + show `+` / drag handle |
| **Plus** | Empty block → open slash on same line; non-empty → new line below + slash |
| **Drag handle · drag** | Reorder blocks |
| **Drag handle · click** | Block menu: insert above/below, duplicate, turn into, color, delete |
| **Slash `/`** | Command palette |
| **Empty Enter** in list / quote / heading / container | Exit special block (Notion-like) |

---

## Markdown shortcuts (selection)

| Input | Result |
| --- | --- |
| `# ` … `###### ` | Heading 1–6 |
| `> ` | Quote |
| `- ` or `* ` | Bullet list |
| `1. ` | Numbered list |
| `` `code` `` | Inline code |
| `**text**` / `*text*` | Bold / italic |

---

## Import & export

```ts
editor.getHtml();
editor.getMarkdown();
editor.getJson();

editor.setContent(html, 'html');
editor.setContent(md, 'markdown');
editor.setContent(json, 'json');
```

HTML export strips structural block wrappers for clean publishing markup while keeping semantic tags / theme classes where applicable.

---

## Examples

```bash
# from repo root
npm install
npm run example:vanilla   # http://localhost:5173
npm run example:vue       # http://localhost:5174
npm run example:react     # http://localhost:5175
```

Each demo shows **Editor (top) + live Preview (bottom)**.

---

## Project scripts

| Script | Description |
| --- | --- |
| `npm run build` | Bundle ESM/CJS + types + CSS |
| `npm run build:demo` | Build Vanilla demo for GitHub Pages (`dist-demo/`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons:gen` | Regenerate Material toolbar icons |
| `npm run example:vanilla` | Vanilla demo |
| `npm run example:vue` | Vue demo |
| `npm run example:react` | React demo |

---

## CI / CD

GitHub Actions workflows live under `.github/workflows/`:

| Workflow | File | Trigger | Purpose |
| --- | --- | --- | --- |
| **Publish npm** | `publish-npm.yml` | Push tag `v*` (e.g. `v1.0.0`) · manual | `npm publish` package `unilexical` |
| **Deploy Pages** | `deploy-pages.yml` | Push to `main`/`master` · PR (build only) · manual | Vanilla demo → GitHub Pages |

### Publish to npm

1. Create an npm token (Automation or granular publish for `unilexical`).
2. Repo → **Settings → Secrets and variables → Actions** → add secret **`NPM_TOKEN`**.
3. Bump `version` in `package.json` so it matches the tag **without** the `v` prefix:
   - tag `v1.0.0` → `"version": "1.0.0"`
4. Commit, then push a version tag:

```bash
# after version bump is committed
git tag v1.0.0
git push origin v1.0.0
```

5. The workflow runs: check version ↔ tag → typecheck → build → `npm publish --access public --provenance`.

Manual dry-run: **Actions → Publish npm → Run workflow → dry_run = true**.

### GitHub Pages (demo)

1. Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or `master`); workflow builds `examples/vanilla` with `base: /<repo>/`.
3. Site: `https://<owner>.github.io/<repo>/`.

---

## Architecture

UniLexical follows a **three-tier** split:

1. **Core** – Lexical editor, nodes, plugins, commands, serialization  
2. **Bridge** – Typed `EventEmitter` (`change`, `toolbarChange`, …)  
3. **Wrappers** – Vue / React / Vanilla mount only (no business logic fork)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full specification.

---

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge) with ES2020+.

---

## License

[MIT](./LICENSE) © UniLexical contributors

---

## Contributing

Issues and PRs are welcome. Please:

1. Run `npm run typecheck` and `npm run build` before submitting  
2. Keep framework wrappers thin—prefer core fixes over wrapper-only hacks  
3. Add or update examples when introducing user-facing APIs  

---

## Changelog

See GitHub **Releases** for version history (or project changelog when published).

---

<p align="center">
  Built with Lexical · Designed for product teams who need one editor across Vanilla, Vue, and React
</p>
