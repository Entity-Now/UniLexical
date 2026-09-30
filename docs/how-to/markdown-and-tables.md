# How-To Guide: Tables, Callouts & Markdown Serialization

This guide covers advanced content elements in UniLexical, including GitHub Flavored Markdown (GFM) tables, callouts (`:::info`), collapsible toggle blocks, and data persistence with clean Markdown/HTML serialization.

---

## 1. Working with Tables

UniLexical provides complete support for tables via `@lexical/table` and custom GFM Markdown transformers.

### 1.1 Creating Tables
You can insert tables in three ways:
1. **Toolbar Grid Picker**: Click the table icon on the toolbar and hover over the grid to select rows and columns (e.g., 3×3, 5×5).
2. **Slash Command**: Type `/table` on any empty line and press `Enter`.
3. **Markdown Typing**: Paste or type a standard GFM table:
   ```markdown
   | Name | Role | Status |
   | :--- | :---: | ---: |
   | Alice | Developer | Active |
   | Bob | Designer | Inactive |
   ```

### 1.2 Table Cell Actions
When the cursor is inside a table cell, the editor allows:
- **Adding / Deleting Rows**: Insert row above or below; delete current row.
- **Adding / Deleting Columns**: Insert column left or right; delete current column.
- **Cell Background Color**: Pick background highlights for headers or specific status cells.

### 1.3 Responsive Table Display
Tables in UniLexical are automatically wrapped in a responsive container:
```html
<div class="uni-table-wrapper">
  <table class="uni-table">
    ...
  </table>
</div>
```
The `.uni-table-wrapper` element has `overflow-x: auto; -webkit-overflow-scrolling: touch;`, ensuring wide tables scroll cleanly on mobile and narrow viewports without breaking page layouts.

---

## 2. Callout Containers & Collapsible Blocks

### 2.1 Callouts (`:::type`)
UniLexical supports Notion-style callout banners using the `:::type` syntax:

```markdown
:::info
**Information**: This is an informational callout with a custom background and icon.
:::

:::tip
**Tip**: Press Tab to indent lists and Shift+Tab to outdent.
:::

:::warning
**Warning**: Deleting a block cannot be undone without Ctrl+Z.
:::

:::danger
**Danger**: Proceed with caution.
:::
```

Pressing `Enter` on an empty line at the end of a container automatically exits the container and creates a normal paragraph below.

### 2.2 Collapsible Toggle Blocks (`<details><summary>`)
Insert interactive toggles with standard HTML or via `/toggle`:

```html
<details class="uni-toggle">
  <summary class="uni-toggle-title">Click to view details</summary>
  <div class="uni-toggle-content">
    <p>Hidden body text, nested code blocks, or lists.</p>
  </div>
</details>
```

---

## 3. Data Persistence & Serialization

UniLexical supports three serialization formats: **`markdown`**, **`html`**, and **`json`**.

### 3.1 Exporting Content for Database Storage

```ts
// Export as clean GFM Markdown (ideal for version control, LLM ingestion, or blogs)
const markdown = editor.getMarkdown();

// Export as semantic HTML (ideal for web rendering and RSS feeds)
const html = editor.getHtml();

// Export as Lexical EditorState JSON (ideal for lossless full-fidelity restoration)
const json = editor.getJson();
```

> **Clean HTML Output**: UniLexical's `getHtml()` method automatically strips internal block-wrapper markers (`data-uni-block`, hover handle wrappers) and normalizes output into clean, semantic HTML tags (`<h1>`, `<p>`, `<table>`, `<pre><code>`).

### 3.2 Loading Content into the Editor

```ts
// Load from Markdown
editor.setContent('# New Document\n\nContent here…', 'markdown');

// Load from HTML
editor.setContent('<h1>New Document</h1><p>Content here…</p>', 'html');

// Load from JSON
editor.setContent(savedJsonString, 'json');
```

---

## 4. Automatic Table Recovery in Preview

When dealing with legacy documents where markdown tables were saved as plain text or multiple `<p>` elements, `UniPreview` (`mountPreview` / `UniLexicalPreview`) automatically activates the `recoverMarkdownTablesInHtml` algorithm.

It detects table structures containing pipe separators `|` and separator lines (`| --- | --- |`), automatically converting them into fully styled, responsive HTML tables on the fly.
