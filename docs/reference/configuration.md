# Reference: Configuration Specification

This document provides the authoritative technical reference for all configuration options accepted by UniLexical.

Configuration objects are passed to:
- `mountEditor(config)` and `createUniEditor(config)` (Vanilla)
- `<UniLexical {...config} />` component props (Vue 3 & React)
- `useLexical(config)` composable / hook (Vue 3 & React)

---

## 1. `UniEditorConfig`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `container` | `string \| HTMLElement` | — | **Vanilla only**. CSS selector (e.g. `'#editor'`) or DOM Element. |
| `placeholder` | `string` | `"Type '/' for commands…"` | Placeholder text displayed when the document is empty. |
| `namespace` | `string` | `"UniLexical"` | Lexical editor namespace (used for clipboard isolation). |
| `editable` | `boolean` | `true` | Controls whether the editor content is editable. |
| `builtinUI` | `boolean` | `true` | When `true`, automatically mounts built-in toolbar, slash menu popup, and block hover overlay. Set to `false` for headless operation. |
| `toolbarItems` | `ToolbarItemId[]` | *All features* | If omitted or `undefined`, the full default toolbar is displayed. If an array is provided (even empty `[]`), only specified items are rendered in order. |
| `initialContent` | `string` | — | Initial document content to populate upon initialization. |
| `initialFormat` | `'html' \| 'markdown' \| 'json'` | `'markdown'` | Format of `initialContent`. |
| `imageOptions` | `ImageOptions` | `{}` | Options governing image upload, paste, drag-and-drop, and file size validation. |
| `attachmentOptions` | `AttachmentOptions` | `{}` | Options governing non-image file attachments. |
| `tableMaxSize` | `{ rows: number; cols: number }` | `{ rows: 5, cols: 5 }` | Maximum dimensions for the interactive table size picker grid. |
| `theme` | `UniEditorTheme` | *Default theme* | Custom CSS class name overrides for Lexical nodes. |
| `nodes` | `Array<Klass<LexicalNode>>` | `[]` | Extra custom Lexical node classes to register with the core instance. |
| `onCustomAction` | `() => void` | — | Callback invoked when the `'custom'` toolbar button is clicked. |

---

## 2. `ImageOptions`

Configuration for handling image insertions:

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `upload` | `(file: File) => Promise<string>` | — | Custom asynchronous upload handler. Must return a public HTTPS URL string. If omitted, the file is embedded as a base64 Data URL. |
| `accept` | `string` | `'image/*'` | Value passed to the `<input type="file" accept="...">` picker. |
| `maxSize` | `number` | — | Maximum allowable file size in **bytes**. An error is thrown if exceeded. |

### Example
```ts
imageOptions: {
  upload: async (file: File) => {
    const res = await uploadToCdn(file);
    return res.url;
  },
  accept: 'image/png,image/jpeg,image/webp,image/gif',
  maxSize: 8 * 1024 * 1024, // 8MB
}
```

---

## 3. `AttachmentOptions`

Configuration for handling generic file attachments:

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `upload` | `(file: File) => Promise<{ url: string; name?: string }>` | — | Custom upload function returning download URL and display name. If omitted, stored as data URL. |
| `accept` | `string` | `'*/*'` | Allowed MIME types / extensions for the file picker. |
| `maxSize` | `number` | — | Maximum file size in **bytes**. |

---

## 4. Theme Configuration (`UniEditorTheme`)

UniLexical maps internal Lexical nodes to class names defined in `src/core/theme.ts`. You can override individual classes by passing a partial `theme` object:

```ts
theme: {
  paragraph: 'my-custom-paragraph',
  heading: {
    h1: 'my-custom-h1 text-3xl font-bold',
    h2: 'my-custom-h2 text-2xl font-semibold',
  },
  table: 'my-custom-table',
  code: 'my-custom-code-block font-mono',
}
```
