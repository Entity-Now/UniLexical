# How-To Guide: Headless Mode & Custom UI

UniLexical is architected with a decoupled three-tier design. If you want to use your own design system (such as Tailwind CSS, Shadcn UI, Ant Design, or Element Plus) instead of the built-in toolbar and slash menu, you can run UniLexical in **headless mode**.

---

## 1. Disabling Built-in Chrome

Pass `builtinUI: false` when initializing the editor:

```ts
const handle = mountEditor({
  container: '#editor',
  builtinUI: false, // Disables built-in toolbar, slash popup, and block overlay
});
```

The editor still retains full Lexical state management, markdown shortcuts, block drag-and-drop algorithms, and serialization.

---

## 2. Using the Vue 3 `useLexical` Composable

UniLexical exposes `useLexical` from `unilexical/vue` to simplify custom UI binding in Vue 3:

```vue
<!-- CustomEditor.vue -->
<script setup lang="ts">
import { useLexical } from 'unilexical/vue';
import 'unilexical/style.css';

const {
  containerRef,
  editor,
  toolbarState,
  execToolbar,
  getHtml,
  getMarkdown,
} = useLexical({
  builtinUI: false,
  placeholder: 'Write your story…',
});
</script>

<template>
  <div class="custom-editor-wrapper">
    <!-- Your Custom Tailwind Toolbar -->
    <header class="flex items-center gap-2 p-2 border-b bg-gray-50">
      <button
        type="button"
        :class="['px-2 py-1 rounded text-sm font-semibold', toolbarState.isBold ? 'bg-blue-600 text-white' : 'hover:bg-gray-200']"
        @click="execToolbar('bold')"
      >
        Bold
      </button>

      <button
        type="button"
        :class="['px-2 py-1 rounded text-sm italic', toolbarState.isItalic ? 'bg-blue-600 text-white' : 'hover:bg-gray-200']"
        @click="execToolbar('italic')"
      >
        Italic
      </button>

      <button
        type="button"
        class="px-2 py-1 rounded text-sm hover:bg-gray-200"
        @click="execToolbar('heading1')"
      >
        H1
      </button>

      <button
        type="button"
        class="px-2 py-1 rounded text-sm hover:bg-gray-200"
        @click="execToolbar('bulletList')"
      >
        List
      </button>
    </header>

    <!-- Editor Mount Target -->
    <div ref="containerRef" class="p-4 min-h-[300px]" />
  </div>
</template>
```

---

## 3. Using the React `useLexical` Hook

In React, import `useLexical` from `unilexical/react`:

```tsx
// CustomEditor.tsx
import React from 'react';
import { useLexical } from 'unilexical/react';
import 'unilexical/style.css';

export function CustomEditor() {
  const {
    containerRef,
    editor,
    toolbarState,
    execToolbar,
  } = useLexical({
    builtinUI: false,
    placeholder: 'Write something in React…',
  });

  return (
    <div className="border rounded-lg shadow-sm">
      {/* Custom Button Bar */}
      <div className="flex gap-1 p-2 bg-slate-100 border-b">
        <button
          onClick={() => execToolbar('bold')}
          className={`px-3 py-1 text-sm rounded ${toolbarState?.isBold ? 'bg-blue-500 text-white' : 'bg-white'}`}
        >
          Bold
        </button>
        <button
          onClick={() => execToolbar('italic')}
          className={`px-3 py-1 text-sm rounded ${toolbarState?.isItalic ? 'bg-blue-500 text-white' : 'bg-white'}`}
        >
          Italic
        </button>
        <button
          onClick={() => execToolbar('codeBlock')}
          className="px-3 py-1 text-sm bg-white rounded"
        >
          Code
        </button>
      </div>

      {/* Editor Content Area */}
      <div ref={containerRef} className="p-4 min-h-[250px]" />
    </div>
  );
}
```

---

## 4. Subscribing to Toolbar States Manually

If you prefer building a completely custom event bus or integrating with state stores like Redux, Zustand, or Pinia:

```ts
editor.on('toolbarChange', (state) => {
  console.log('Active bold:', state.isBold);
  console.log('Active italic:', state.isItalic);
  console.log('Active block type:', state.blockType); // 'h1', 'paragraph', 'quote', etc.
  console.log('Active font color:', state.fontColor);
});
```
