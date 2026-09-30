# Reference: Toolbar & Slash Items Catalog

This document catalogues all toolbar item identifiers (`ToolbarItemId`), slash command IDs, and the CSS classes used across UniLexical.

---

## 1. Full Toolbar Items Directory

Provide any subset of these strings in `toolbarItems: [...]`:

### History
- `undo`: Undo last action (`Ctrl+Z` / `Cmd+Z`)
- `redo`: Redo last undone action (`Ctrl+Y` / `Cmd+Shift+Z`)

### Inline Formatting
- `bold`: Bold text (`Ctrl+B` / `Cmd+B`)
- `italic`: Italic text (`Ctrl+I` / `Cmd+I`)
- `underline`: Underline text (`Ctrl+U` / `Cmd+U`)
- `strike` / `strikethrough`: Strikethrough text
- `code`: Inline code snippet
- `highlight`: Text background highlight color
- `subscript`: Subscript text
- `superscript`: Superscript text
- `painter`: Format painter (copy format from selection and apply to next selection)
- `eraser`: Clear all formatting from selection

### Typography
- `fontColor`: Text color dropdown palette
- `fontFamily`: Font family dropdown selector
- `fontSize`: Font size dropdown selector
- `lineHeight`: Line height dropdown selector

### Blocks & Headings
- `heading`: Composite heading dropdown (Paragraph + H1 to H6)
- `heading1` … `heading6`: Direct heading level button
- `paragraph`: Standard paragraph block
- `quote`: Blockquote element
- `codeBlock`: Code block with lowlight / Prism syntax highlighting
- `container`: Callout container block (`:::info`, etc.)
- `toggle`: Collapsible accordion block (`<details><summary>`)
- `datetime`: Insert current date / time node

### Lists
- `bulletList`: Bulleted unordered list (`<ul><li>`)
- `orderedList` / `numberedList`: Numbered ordered list (`<ol><li>`)
- `todo`: Interactive checklist with checkboxes (`<ul class="uni-checklist">`)

### Alignment & Indentation
- `align`: Alignment dropdown menu
- `alignLeft`: Left align text
- `alignCenter`: Center align text
- `alignRight`: Right align text
- `alignJustify`: Justify text
- `indentIncrease`: Increase block indentation
- `indentDecrease`: Decrease block indentation

### Insert Elements
- `link`: Insert / edit hyperlink (`Ctrl+K` / `Cmd+K`)
- `image`: Open file picker or insert image
- `attachment`: Attach generic downloadable file
- `table`: Interactive table dimension grid picker
- `tableCellBackgroundColor`: Color picker for selected table cells
- `hr`: Horizontal dividing line (`<hr>`)
- `break`: Hard line break (`<br>`)
- `emoji`: Emoji selection popup
- `custom`: Custom action button (fires `onCustomAction`)

### View Options
- `sourceCode`: Toggle raw HTML source view
- `fullscreen`: Toggle distraction-free fullscreen mode
- `printer`: Open browser print preview

### Layout & Spacing
- `divider`: Visible vertical divider separator line
- `group`: Blank spacing spacer between button clusters

---

## 2. Default Slash Commands Catalog

When a user types `/`, the following default items appear:

| ID | Title | Description | Resulting Action |
| :--- | :--- | :--- | :--- |
| `h1` | Heading 1 | Large section heading | Converts block to H1 |
| `h2` | Heading 2 | Medium section heading | Converts block to H2 |
| `h3` | Heading 3 | Small section heading | Converts block to H3 |
| `text` | Text | Plain text paragraph | Converts block to paragraph |
| `bullet` | Bullet List | Simple bulleted list | Converts block to bullet list |
| `number` | Numbered List | Numbered sequence | Converts block to numbered list |
| `todo` | To-do List | Track tasks with checklist | Converts block to checklist |
| `quote` | Quote | Capture a quote | Converts block to blockquote |
| `code` | Code Block | Code snippet with highlighting | Converts block to code block |
| `table` | Table | Insert a table | Inserts a table |
| `callout` | Callout | Highlight important note | Inserts container (`:::info`) |
| `divider` | Divider | Visually divide content | Inserts `<hr>` |
| `image` | Image | Upload or embed an image | Triggers image picker |
| `attachment` | Attachment | Attach a file | Triggers file picker |

---

## 3. CSS Class Reference

### Editor Chrome Classes
- `.uni-editor-shell`: Root shell element wrapping the toolbar and content area.
- `.uni-toolbar`: The floating or static top toolbar container.
- `.uni-toolbar-btn`: Individual toolbar button element.
- `.uni-toolbar-btn-active`: Applied when the current text selection matches the button format.
- `.uni-slash-menu`: The popup menu triggered by typing `/`.
- `.uni-block-overlay`: Gutter overlay containing the `+` button and `⋮⋮` drag handle.
- `.uni-block-menu`: Dropdown menu opened when clicking the drag handle.

### Content Elements & Theme Classes
- `.uni-content-root`: The content editable root element.
- `.uni-block-wrapper`: Wrapper element enclosing every top-level block.
- `.uni-paragraph`: Standard paragraph `<p>`.
- `.uni-h1` … `.uni-h6`: Heading elements.
- `.uni-quote`: Blockquote elements.
- `.uni-code-block`: `<pre>` block for code snippets.
- `.uni-table-wrapper`: Responsive overflow container enclosing tables.
- `.uni-table`: Table element.
- `.uni-table-cell`: `<td>` cell.
- `.uni-table-cell-header`: `<th>` header cell.
- `.uni-image`: `<img>` element with resizing handle.
- `.uni-container`: Callout container box.
- `.uni-preview`: Root wrapper for standalone previews.
