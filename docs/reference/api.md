# Reference: API & Methods Specification

This document details the public API methods, component interfaces, and event contracts for UniLexical.

---

## 1. `UniEditor` Class

The core coordinator instance managing Lexical, plugins, and UI bindings.

### 1.1 Content Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `getContent` | `(format?: 'json' \| 'html' \| 'markdown') => string` | Returns document string in the requested format (defaults to `'json'`). |
| `setContent` | `(content: string, format?: 'json' \| 'html' \| 'markdown') => void` | Replaces the entire document with new content in the given format. |
| `getHtml` | `() => string` | Convenience shortcut returning clean semantic HTML. |
| `getMarkdown` | `() => string` | Convenience shortcut returning GFM Markdown. |
| `getJson` | `() => string` | Convenience shortcut returning serialized Lexical JSON. |
| `insertImageFile` | `(file: File) => Promise<void>` | Inserts an image file (executing `imageOptions.upload` if configured). |
| `insertImageUrl` | `(src: string, alt?: string) => void` | Inserts an image node pointing directly to a URL. |
| `insertTable` | `(rows: number, cols: number) => void` | Programmatically inserts a table with the specified row and column counts. |

### 1.2 State & UI Control

| Method | Signature | Description |
| :--- | :--- | :--- |
| `setEditable` | `(editable: boolean) => void` | Enables or disables content editing. |
| `setToolbarItems` | `(items: ToolbarItemId[]) => void` | Updates visible toolbar buttons dynamically at runtime. |
| `getToolbarState` | `() => ToolbarState` | Returns an instantaneous snapshot of active format flags (bold, italic, colors, etc.). |
| `setSlashItems` | `(items: SlashMenuItem[]) => void` | Replaces available commands in the slash popup menu. |
| `execToolbar` | `(item: ToolbarItemId) => void` | Programmatically triggers a toolbar button command. |
| `focus` | `() => void` | Moves keyboard focus into the editor content editable element. |
| `blur` | `() => void` | Removes keyboard focus from the editor. |
| `getLexicalEditor` | `() => LexicalEditor` | Returns the raw underlying Meta Lexical editor instance for low-level node operations. |
| `destroy` | `() => void` | Tears down event listeners, unmounts UI elements, and disposes the editor instance. |

---

## 2. Framework Wrappers

### 2.1 Vanilla JS (`mountEditor`)

```ts
import { mountEditor } from 'unilexical';

const handle = mountEditor(options);
```

#### Handle Return Interface
- `editor`: The underlying `UniEditor` instance.
- `getHtml()`: Export current document as HTML string.
- `getMarkdown()`: Export current document as Markdown string.
- `getJson()`: Export current document as JSON string.
- `setContent(content, format?)`: Load content into the editor.
- `focus()`: Focus editor.
- `destroy()`: Dispose editor and remove DOM elements.

---

### 2.2 Vue 3 Component (`<UniLexical />`)

#### Props
- `toolbar-items` (`ToolbarItemId[]`)
- `image-options` (`ImageOptions`)
- `attachment-options` (`AttachmentOptions`)
- `initial-content` (`string`)
- `initial-format` (`'html' | 'markdown' | 'json'`)
- `placeholder` (`string`)
- `builtin-ui` (`boolean`, default: `true`)
- `editable` (`boolean`, default: `true`)
- `slash-items` (`SlashMenuItem[]`)

#### Emitted Events
- `@change` (`payload: { html: string; markdown: string; json: string }`): Emitted when document content mutates (debounced).
- `@ready` (`editor: UniEditor`): Emitted once the editor is fully mounted.
- `@toolbar-change` (`state: ToolbarState`): Emitted when selection or formatting changes.
- `@custom-action` (`void`): Emitted when the `'custom'` toolbar button is pressed.

#### Template Ref Handle
Access via `ref`:
```ts
const editorRef = ref<InstanceType<typeof UniLexical> | null>(null);

// Methods:
editorRef.value?.getHtml();
editorRef.value?.getMarkdown();
editorRef.value?.setContent(text, 'markdown');
editorRef.value?.focus();
editorRef.value?.editor; // ShallowRef<UniEditor | null>
```

---

### 2.3 React Component (`<UniLexical />`)

#### Props
- `toolbarItems` (`ToolbarItemId[]`)
- `imageOptions` (`ImageOptions`)
- `attachmentOptions` (`AttachmentOptions`)
- `initialContent` (`string`)
- `initialFormat` (`'html' | 'markdown' | 'json'`)
- `placeholder` (`string`)
- `builtinUI` (`boolean`, default: `true`)
- `editable` (`boolean`, default: `true`)
- `slashItems` (`SlashMenuItem[]`)
- `onChange` (`(payload: { html: string; markdown: string; json: string }) => void`)
- `onReady` (`(editor: UniEditor) => void`)
- `onToolbarChange` (`(state: ToolbarState) => void`)
- `onCustomAction` (`() => void`)
- `className` (`string`), `style` (`React.CSSProperties`)

#### Ref Handle (`UniLexicalRef`)
```tsx
const editorRef = useRef<UniLexicalRef>(null);

editorRef.current?.getHtml();
editorRef.current?.getMarkdown();
editorRef.current?.setContent(text, 'markdown');
editorRef.current?.focus();
editorRef.current?.editor;
```

---

## 3. Standalone Preview API

### Vanilla (`mountPreview`)
```ts
import { mountPreview } from 'unilexical';

const preview = mountPreview('#preview-container');
preview.bindEditor(editor); // Automatically subscribes to changes
// Or manually set HTML:
preview.setHtml('<p>Static preview</p>');
preview.destroy();
```

### Vue 3 / React Component (`UniLexicalPreview`)
```vue
<UniLexicalPreview :html="html" />
<!-- Or pass editor instance for auto-subscription -->
<UniLexicalPreview :editor="editor" />
```

---

## 4. Unified Event System

Subscribe to events on `editor.on(eventName, handler)`:

```ts
const unsubscribe = editor.on('change', (payload) => {
  // ...
});

// Remove listener
unsubscribe();
```

| Event Name | Payload | Trigger Condition |
| :--- | :--- | :--- |
| `ready` | `void` | Fired when DOM is attached and initial content is rendered. |
| `change` | `{ html: string; markdown: string; json: string }` | Fired on content changes (debounced by default). |
| `toolbarChange` | `ToolbarState` | Fired when cursor selection or inline format changes. |
| `slashTriggered` | `SlashTriggerPayload` | Fired when `/` menu opens, searches, or closes. |
| `blockHoverChanged` | `BlockHoverPayload` | Fired when hovering over different block lines. |
| `paste` | `PastePayload` | Fired when pasting media or text into the editor. |
| `fullscreenChange` | `boolean` | Fired when toggling fullscreen mode. |
| `sourceModeChange` | `{ open: boolean; content: string }` | Fired when toggling raw HTML source view. |
| `customAction` | `void` | Fired when the custom toolbar button is clicked. |
| `error` | `Error` | Fired when a Lexical transaction or plugin encounters an error. |
| `destroy` | `void` | Fired when the editor is disposed. |
