# UniLexical Documentation

Welcome to the **UniLexical** documentation. UniLexical is an industrial-grade, framework-agnostic, Notion-style block rich-text editor powered by Meta's [Lexical](https://lexical.dev) engine.

Our documentation is structured following the [Diátaxis Framework](https://diataxis.fr/), separating learning, practical problem solving, technical specifications, and architectural understanding into four clear quadrants:

```
                      PRACTICAL
                         ▲
                         │
      Tutorials          │        How-to Guides
  (Learning-oriented)    │      (Problem-oriented)
                         │
◀────────────────────────┼────────────────────────▶
                         │
      Explanation        │          Reference
(Understanding-oriented) │    (Information-oriented)
                         │
                         ▼
                    THEORETICAL
```

---

## 1. 🎓 Tutorials (Learning-Oriented)
Practical step-by-step lessons designed to get you up and running from zero to a complete working editor:

- [**Getting Started Tutorial**](./tutorials/getting-started.md): Install UniLexical and mount your first editor with live preview in Vanilla JavaScript, Vue 3, or React.

---

## 2. 🛠️ How-To Guides (Problem-Oriented)
Targeted recipe-style solutions to specific development tasks:

- [**Custom Image & Attachment Upload**](./how-to/image-and-file-upload.md): Upload images and files to cloud storage (S3/OSS/CDN), configure file limits, and handle paste/drop events.
- [**Toolbar & Slash Command Customization**](./how-to/toolbar-and-shortcuts.md): Configure toolbar items, define custom toolbar actions, and customize the Notion-style `/` slash menu.
- [**Markdown, Tables & Callout Containers**](./how-to/markdown-and-tables.md): Work with GFM tables, callout blocks (`:::info`), toggle blocks (`<details>`), and import/export markdown and HTML.
- [**Headless Mode & Custom UI**](./how-to/headless-and-custom-ui.md): Disable the built-in UI (`builtinUI: false`) and build your own custom design-system toolbar with Vue 3 / React hooks.

---

## 3. 📖 Reference (Information-Oriented)
Comprehensive, authoritative technical specifications and dictionaries:

- [**Configuration Reference**](./reference/configuration.md): Complete specification of `UniEditorConfig`, `ImageOptions`, `AttachmentOptions`, and theme customization.
- [**API Reference**](./reference/api.md): Full method signatures for `UniEditor`, Vanilla `mountEditor`, Vue/React component props, events, and template refs.
- [**Toolbar & Slash Items Catalog**](./reference/toolbar-slash-catalog.md): Complete list of all 40+ `ToolbarItemId`s, slash commands, and CSS class names.

---

## 4. 💡 Explanation (Understanding-Oriented)
Deep architectural insights into design choices, internal mechanics, and cross-framework reactivity:

- [**Architecture & Block Model**](./explanation/architecture-and-block-model.md): The three-tier decoupled architecture, Notion-style `BlockWrapperNode`, reactivity bridge, and Lexical 0.52 upgrade considerations.
