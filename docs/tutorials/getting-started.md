# Tutorial: Getting Started with UniLexical

In this tutorial, you will learn how to install **UniLexical**, mount an editor instance in your web application, load initial content, listen to changes, and bind a live preview.

Whether you are using Vanilla JavaScript / TypeScript, Vue 3, or React, UniLexical provides a consistent experience with zero differences in underlying editor behavior.

---

## 1. Prerequisites and Installation

Ensure you have Node.js 18+ installed. Install the `unilexical` package using your preferred package manager:

```bash
# Core package (for Vanilla TypeScript / JavaScript)
npm install unilexical

# For Vue 3 projects
npm install unilexical vue

# For React projects
npm install unilexical react react-dom
```

> **Note:** Lexical core and `@lexical/*` dependencies are pre-bundled with `unilexical`. You do not need to install `lexical` manually.

---

## 2. Importing Styles

UniLexical provides two CSS bundles:

1. **`unilexical/style.css`**: Contains styles for editor chrome (floating hover handle, plus button, toolbar, slash menu, tippy tooltips, and editor content).
2. **`unilexical/preview.css`**: Content-only stylesheet designed specifically for rendering editor content inside `.uni-preview` without styling host containers or polluting your application's design system.

Import them into your root application stylesheet or main component:

```ts
import 'unilexical/style.css';
import 'unilexical/preview.css';
```

---

## 3. Creating Your First Editor

Select your preferred framework below:

### Option A: Vanilla JavaScript / TypeScript

In Vanilla JS, use the `mountEditor` helper to bind the editor to a DOM element, and `mountPreview` to render live output:

```html
<!-- index.html -->
<div class="editor-container">
  <div id="editor"></div>
  <div id="preview"></div>
</div>
```

```ts
// main.ts
import { mountEditor, mountPreview } from 'unilexical';
import 'unilexical/style.css';
import 'unilexical/preview.css';

// 1. Mount the editor
const { editor, getMarkdown, getHtml, setContent, destroy } = mountEditor({
  container: '#editor',
  placeholder: "Type '/' for commands or start typing…",
  initialContent: `# Welcome to UniLexical

This editor supports **markdown shortcuts**, tables, checklists, and images.

- [x] Try typing \`/\` on an empty line
- [ ] Hover over this block to see the drag handle and plus button
`,
  initialFormat: 'markdown',
});

// 2. Mount and bind the live preview
const preview = mountPreview('#preview');
preview.bindEditor(editor);

// 3. Listen to document changes
editor.on('change', ({ html, markdown }) => {
  console.log('Markdown output:\n', markdown);
});
```

---

### Option B: Vue 3 Single File Component

UniLexical provides first-class Vue 3 components (`UniLexical` and `UniLexicalPreview`) via `unilexical/vue`:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { UniLexical, UniLexicalPreview } from 'unilexical/vue';
import type { UniEditor } from 'unilexical';
import 'unilexical/style.css';
import 'unilexical/preview.css';

const htmlContent = ref('');
const editorInstance = shallowRef<UniEditor | null>(null);

const initialMarkdown = `# Hello Vue 3

Try the **table picker** or type \`/table\` to create a table.

| Feature | Supported |
| :--- | :---: |
| GFM Table | ✅ |
| Checklist | ✅ |
`;

function handleChange(payload: { html: string; markdown: string; json: string }) {
  htmlContent.value = payload.html;
}

function handleReady(editor: UniEditor) {
  editorInstance.value = editor;
  htmlContent.value = editor.getHtml();
}
</script>

<template>
  <div class="app-layout">
    <!-- Editor Component -->
    <UniLexical
      placeholder="Type '/' for commands…"
      :initial-content="initialMarkdown"
      initial-format="markdown"
      @change="handleChange"
      @ready="handleReady"
    />

    <!-- Live Preview Component -->
    <div class="preview-box">
      <UniLexicalPreview :html="htmlContent" />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  max-width: 900px;
  margin: 40px auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.preview-box {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  background: #ffffff;
}
</style>
```

---

### Option C: React Component

In React, import `<UniLexical />` and `<UniLexicalPreview />` from `unilexical/react`:

```tsx
// App.tsx
import React, { useState } from 'react';
import { UniLexical, UniLexicalPreview } from 'unilexical/react';
import 'unilexical/style.css';
import 'unilexical/preview.css';

export function App() {
  const [html, setHtml] = useState('');

  const initialMarkdown = `# Hello React

- Type \`/\` to insert code blocks, callouts, or tables
- Press **Tab** / **Shift+Tab** to indent and outdent lists
`;

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <UniLexical
        placeholder="Type '/' for commands…"
        initialContent={initialMarkdown}
        initialFormat="markdown"
        onChange={({ html }) => setHtml(html)}
        onReady={(editor) => setHtml(editor.getHtml())}
      />

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff' }}>
        <UniLexicalPreview html={html} />
      </div>
    </div>
  );
}
```

---

## 4. Key Interactions to Try

Once your editor is running:

1. **Slash Command Menu**: On an empty line, type `/` to open the command palette. Use `ArrowUp`, `ArrowDown`, and `Enter` to insert headings, code blocks, tables, callouts, and checklists.
2. **Block Hover Chrome**: Move your mouse cursor over any line. You will see a `+` button and a `⋮⋮` drag handle on the left gutter.
   - Click `+` to insert a block below and immediately open the slash menu.
   - Drag `⋮⋮` to reorder blocks vertically.
   - Click `⋮⋮` to open the block context menu (Duplicate, Delete, Turn into..., Colors).
3. **Markdown Typing Shortcuts**:
   - Type `# ` + Space for Heading 1
   - Type `> ` + Space for a blockquote
   - Type `- [ ] ` for a todo checklist
   - Type `---` for a horizontal rule
   - Type `| Col 1 | Col 2 |` for an interactive table

---

## 5. Next Steps

- Learn how to connect your backend image upload API in [Custom Image & Attachment Upload](../how-to/image-and-file-upload.md).
- Customize the toolbar buttons and register custom actions in [Toolbar Customization](../how-to/toolbar-and-shortcuts.md).
- Dive into full method signatures and event definitions in the [API Reference](../reference/api.md).
