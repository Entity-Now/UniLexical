# How-To Guide: Toolbar & Slash Command Customization

This guide explains how to customize toolbar buttons, register custom actions, configure the Notion-style `/` slash menu, and utilize real-time Markdown typing shortcuts.

---

## 1. Configuring Toolbar Items

By default, UniLexical renders a complete, feature-rich toolbar containing history, inline formatting, typography, blocks, alignment, lists, tables, and media tools.

You can restrict or rearrange toolbar items by providing the `toolbarItems` array.

### Preset Examples

#### Minimal Writing Toolbar
```ts
toolbarItems: [
  'undo', 'redo', 'divider',
  'bold', 'italic', 'underline', 'strike', 'divider',
  'link', 'divider',
  'bulletList', 'orderedList',
]
```

#### Documentation & Notion-like Toolbar
```ts
toolbarItems: [
  'heading', 'bold', 'italic', 'code', 'fontColor', 'divider',
  'bulletList', 'orderedList', 'todo', 'quote', 'codeBlock', 'divider',
  'table', 'image', 'hr',
]
```

#### Headless / No Toolbar
```ts
// Passing an empty array renders no buttons
toolbarItems: []

// Setting builtinUI to false disables all built-in toolbar/slash chrome
builtinUI: false
```

---

## 2. Registering Custom Toolbar Buttons

UniLexical includes a dedicated `'custom'` toolbar item ID that fires the `onCustomAction` callback (or `customAction` event).

### Vanilla JS Example
```ts
const handle = mountEditor({
  container: '#editor',
  toolbarItems: ['bold', 'italic', 'divider', 'custom'],
  onCustomAction: () => {
    // Open a modal, trigger an AI completion, or open a template picker
    console.log('Custom toolbar button clicked!');
  },
});
```

### Vue 3 Example
```vue
<template>
  <UniLexical
    :toolbar-items="['bold', 'italic', 'divider', 'custom']"
    @custom-action="openAIAssistantModal"
  />
</template>
```

### React Example
```tsx
<UniLexical
  toolbarItems={['bold', 'italic', 'divider', 'custom']}
  onCustomAction={() => openTemplatePicker()}
/>
```

---

## 3. Dynamic Toolbar Switching at Runtime

You can change toolbar items on the fly using `editor.setToolbarItems(...)`:

```ts
// Switch to compact mode on small viewports
if (window.innerWidth < 640) {
  editor.setToolbarItems(['bold', 'italic', 'link', 'image']);
} else {
  editor.setToolbarItems([
    'heading', 'bold', 'italic', 'fontColor', 'divider',
    'bulletList', 'orderedList', 'table', 'image'
  ]);
}
```

---

## 4. Customizing the Slash Command Menu

Typing `/` on an empty line or after a space opens the slash menu. You can customize the available options using `setSlashItems`:

```ts
import type { SlashMenuItem } from 'unilexical';

const customSlashCommands: SlashMenuItem[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    keywords: ['heading', 'title', 'h1'],
    action: (editor) => editor.execToolbar('heading1'),
  },
  {
    id: 'ai-summary',
    label: 'AI Summary',
    description: 'Generate an automatic summary of selected text',
    keywords: ['ai', 'summarize', 'gpt'],
    action: async (editor) => {
      const text = editor.getMarkdown();
      const summary = await callAiSummaryApi(text);
      editor.setContent(summary, 'markdown');
    },
  },
];

// Set custom items on editor instance
editor.setSlashItems(customSlashCommands);
```

In Vue / React wrappers, pass `:slash-items="customSlashCommands"` or `slashItems={customSlashCommands}` as a prop.

---

## 5. Real-Time Markdown Typing Shortcuts

UniLexical listens to keystrokes and instantly transforms markdown patterns into rich Lexical blocks:

| Shortcut | Action / Result | Example Input |
| :--- | :--- | :--- |
| `# ` … `###### ` | Heading 1 to Heading 6 | `# Title` |
| `> ` | Blockquote | `> Note` |
| `- ` or `* ` | Bulleted List | `- Item 1` |
| `1. ` | Numbered List | `1. First item` |
| `- [ ] ` or `- [x] ` | Todo Checklist | `- [ ] Pending task` |
| `---` or `***` | Horizontal Rule (Divider) | `---` |
| ` ```lang ` | Code block with syntax highlighting | ` ```js ` |
| `:::info` / `:::tip` | Callout container | `:::info` |
| `**text**` | Bold text | `**bold**` |
| `*text*` | Italic text | `*italic*` |
| `~~text~~` | Strikethrough | `~~deleted~~` |
| `` `code` `` | Inline code snippet | `` `const x = 1` `` |
