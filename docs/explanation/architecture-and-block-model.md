# Explanation: Architecture & Block Model

This document explains the technical design principles, internal data model, cross-framework reactivity bridge, and serialization mechanics that power UniLexical.

---

## 1. Why a Three-Tier Decoupled Architecture?

Many rich-text editors for Vue or React either:
1. Re-implement the entire editor state from scratch in the framework's reactive store, creating significant maintenance overhead and divergence between stacks.
2. Bind tightly to a single framework's component lifecycle (e.g. `@lexical/react`), making it impossible to share plugins, toolbar behaviors, and drag-and-drop algorithms across multiple projects.

UniLexical solves this by enforcing a strict **Three-Tier Decoupled Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Application Layer (Vue SFCs, React Components, HTML)     │
└───────────────────────────────┬─────────────────────────────┘
                                │ Props / Hooks / Emits
┌───────────────────────────────▼─────────────────────────────┐
│ 2. Thin Framework Wrappers & Reactivity Bridge              │
│    - Vue 3: shallowRef() + Lifecycle adapters               │
│    - React: useSyncExternalStore()                          │
│    - Vanilla: DOM Mount Handle                              │
└───────────────────────────────┬─────────────────────────────┘
                                │ Typed EventEmitter & Commands
┌───────────────────────────────▼─────────────────────────────┐
│ 3. Framework-Agnostic TypeScript Core (UniEditor)           │
│    - Lexical Engine & State Transactions                    │
│    - Custom BlockWrapperNode & ImageNode                    │
│    - Drag-and-Drop, Slash Menu & Toolbar Controllers        │
│    - Markdown, HTML & JSON Serializer Registries            │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle**: *Zero business logic lives inside the React, Vue, or Vanilla wrappers.* All node schemas, keyboard navigation, slash command parsing, and drag-and-drop transactions exist purely in TypeScript Core.

---

## 2. Notion-Style Block Model (`BlockWrapperNode`)

By default, Meta's Lexical treats documents as a relatively flat sequence of paragraph or element nodes under a single root. In contrast, Notion, Craft, and Google Docs treat content as discrete blocks that can be dragged, duplicated, transformed, and augmented with gutter actions.

### 2.1 The Envelope Pattern
To achieve Notion's block UX without breaking Lexical's internal text composition algorithms:
- Every top-level node inserted under the root is enclosed in a `BlockWrapperNode`.
- Each `BlockWrapperNode` generates a unique, persistent block identifier (`blockId`) and renders as:
  ```html
  <div class="uni-block-wrapper" data-uni-block="block-muo86xd3-1">
    <h1 class="uni-h1">Heading Title</h1>
  </div>
  ```
- The wrapper allocates precise left-margin spacing so the floating `+` button and `⋮⋮` drag handle align seamlessly beside the block content without clipping or interfering with mouse clicks.

### 2.2 Atomic Drag-and-Drop Transactions
When a user drags a block:
1. The `BlockOverlayController` captures the source block ID during `dragstart`.
2. As the pointer moves across other blocks, it determines whether the drop line should be above or below the target block based on vertical offset thresholds.
3. On `drop`, the editor initiates an atomic Lexical update:
   ```ts
   editor.update(() => {
     const sourceNode = $getNodeByKey(sourceKey);
     const targetNode = $getNodeByKey(targetKey);
     if (dropPosition === 'before') {
       targetNode.insertBefore(sourceNode);
     } else {
       targetNode.insertAfter(sourceNode);
     }
   });
   ```
Because the node mutation occurs inside Lexical's native update pipeline, the operation is automatically registered on the undo/redo history stack (`Ctrl+Z` reverses the drag cleanly).

---

## 3. The Reactivity Bridge

### 3.1 Why Vue 3 Deep Proxies Break Lexical
Vue 3 uses JavaScript `Proxy` objects to provide deep reactivity (`ref` or `reactive`). However:
- Lexical maintains immutable state trees and references internal node keys and prototypes directly (`node.__key`, `node.__type`).
- If the Lexical editor instance or node tree is wrapped in a Vue `reactive()` proxy, prototype checks (`$isElementNode(node)`) fail, and internal cache maps fall out of sync, causing infinite loops and memory leaks.

**The Solution**: UniLexical's Vue wrapper strictly isolates the editor inside a `shallowRef<UniEditor | null>(null)` and utilizes an external `EventEmitter` to project state changes onto simple, lightweight reactive primitives.

### 3.2 React `useSyncExternalStore`
In React 18+, concurrent rendering can lead to "tearing" if external mutable stores are read during rendering. UniLexical's React wrapper uses `useSyncExternalStore` to subscribe to the editor's `toolbarChange` and `change` events, ensuring tearing-free UI synchronization with concurrent mode compatibility.

---

## 4. Transparent Serialization & Custom Transformers

### 4.1 Transparent BlockWrapper Proxying
When serializing to Markdown, standard `@lexical/markdown` transformers inspect root child elements. Because UniLexical wraps content in `BlockWrapperNode`, standard transformers would fail to recognize headings, tables, or quotes.

UniLexical implements `BLOCK_WRAPPER_TRANSFORMER`:
- During Markdown export, it acts as a transparent proxy, extracting the wrapped inner node (e.g. `TableNode`, `CodeNode`, `HeadingNode`) and delegating formatting to the appropriate transformer.

### 4.2 GFM Multiline Transformers
UniLexical registers specialized multiline transformers:
- **`TABLE_TRANSFORMER`**: Converts GFM Markdown tables into `TableNode -> TableRowNode -> TableCellNode` structures, preserving header alignments (`:---`, `:---:`, `---:`) and escaping pipes (`\|`).
- **`CONTAINER_TRANSFORMER`**: Converts `:::info` blocks into `ContainerNode` and restores them during export.
- **`HR_TRANSFORMER`**: Converts `---` into `HorizontalRuleNode`.
- **`IMAGE_TRANSFORMER`**: Converts `![alt](url)` into `ImageNode`.

---

## 5. Modern Lexical 0.52 Architecture

UniLexical is fully upgraded to **Lexical 0.52.0**, aligning with Meta's path to Lexical 1.0:

1. **Decoupled Code Highlighting**:
   - In 0.52, code highlighting is split into `@lexical/code-core` and `@lexical/code-prism`.
   - Tokenizers must implement the `$tokenize(codeNode: CodeNode): LexicalNode[]` contract. UniLexical's `LowlightTokenizer` converts highlight.js HAST trees directly into `$createCodeHighlightNode`, `$createTabNode`, and `$createLineBreakNode` in a single pass.
2. **Context-Aware List Commands**:
   - Deprecated `insertList(editor, 'check')` was replaced with the contextual `$insertList('check')`, ensuring list insertions run safely within active Lexical update transactions.
