import {
  $getRoot,
  $insertNodes,
  type LexicalEditor,
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type Transformer,
} from '@lexical/markdown';
import type { ContentFormat } from '../core/types';
import { $normalizeRootBlocks } from './blockTransform';
import { enhanceHtmlForPreview } from './previewEnhance';
import { UNI_TRANSFORMERS } from './markdownTransformers';

export interface FormatAdapter {
  exportToString(editor: LexicalEditor): string;
  importFromString(editor: LexicalEditor, content: string): void;
}

/**
 * SerializationRegistry – HTML / Markdown / JSON import & export.
 * Block wrappers are stripped from clean HTML/MD output.
 */
export class SerializationRegistry {
  private adapters = new Map<ContentFormat, FormatAdapter>();
  private transformers: Transformer[] = UNI_TRANSFORMERS;

  constructor(private editor: LexicalEditor) {
    this.registerDefaults();
  }

  registerSerializer(format: ContentFormat, adapter: FormatAdapter): void {
    this.adapters.set(format, adapter);
  }

  setMarkdownTransformers(transformers: Transformer[]): void {
    this.transformers = transformers;
    this.registerDefaults();
  }

  serialize(format: ContentFormat): string {
    const adapter = this.adapters.get(format);
    if (!adapter) {
      throw new Error(`[UniLexical] No serializer registered for format: ${format}`);
    }
    return adapter.exportToString(this.editor);
  }

  deserialize(format: ContentFormat, content: string): void {
    const adapter = this.adapters.get(format);
    if (!adapter) {
      throw new Error(`[UniLexical] No deserializer registered for format: ${format}`);
    }
    adapter.importFromString(this.editor, content);
  }

  private registerDefaults(): void {
    this.adapters.set('html', {
      exportToString: (editor) => {
        let html = '';
        editor.getEditorState().read(() => {
          // Generate HTML then strip block-wrapper chrome
          html = $generateHtmlFromNodes(editor, null);
        });
        return cleanExportedHtml(html);
      },
      importFromString: (editor, content) => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const parser = new DOMParser();
          // Recover any degraded tables and normalize HTML
          const enhanced = enhanceHtmlForPreview(content);
          const dom = parser.parseFromString(wrapHtmlFragment(enhanced), 'text/html');

          // Unwrap table & legacy image wrappers so block nodes are direct children
          dom.querySelectorAll('.uni-table-wrapper, .table-responsive, .editor-image-wrapper').forEach((wrap) => {
            const parent = wrap.parentNode;
            if (parent) {
              while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
              parent.removeChild(wrap);
            }
          });

          // Normalize Mermaid diagram blocks back to semantic CodeNode HTML (<pre data-language="mermaid">)
          dom.querySelectorAll('.mermaid-diagram-block').forEach((block) => {
            const rawAttr = block.getAttribute('data-mermaid-code');
            const preEl = block.querySelector('pre.mermaid, pre');
            const source = (rawAttr ?? preEl?.textContent ?? '').trim();
            const codePre = dom.createElement('pre');
            codePre.setAttribute('data-language', 'mermaid');
            codePre.setAttribute('data-highlight-language', 'mermaid');
            codePre.textContent = source;
            block.parentNode?.replaceChild(codePre, block);
          });

          dom.querySelectorAll('pre.mermaid').forEach((pre) => {
            pre.classList.remove('mermaid');
            pre.setAttribute('data-language', 'mermaid');
            pre.setAttribute('data-highlight-language', 'mermaid');
          });

          // Ensure all <pre> code blocks carry data-language (read by @lexical/code-core $convertPreElement)
          // and unwrap single <code> child so multiline <code> doesn't spawn a second default-language CodeNode
          dom.querySelectorAll('pre').forEach((pre) => {
            const codeChild = pre.children.length === 1 && pre.firstElementChild?.tagName === 'CODE'
              ? pre.firstElementChild
              : null;
            let resolvedLang =
              pre.getAttribute('data-language') ||
              pre.getAttribute('data-highlight-language') ||
              codeChild?.getAttribute('data-language') ||
              '';

            if (!resolvedLang) {
              const cls = `${pre.className || ''} ${codeChild?.className || ''}`;
              const langMatch = cls.match(/\blanguage-([a-zA-Z0-9_+-]+)/);
              if (langMatch?.[1]) {
                resolvedLang = langMatch[1].toLowerCase();
              }
            }

            if (resolvedLang) {
              pre.setAttribute('data-language', resolvedLang);
              pre.setAttribute('data-highlight-language', resolvedLang);
            }

            if (codeChild) {
              while (codeChild.firstChild) {
                pre.insertBefore(codeChild.firstChild, codeChild);
              }
              codeChild.remove();
            }
          });

          // Strip preview chrome before importing nodes into editor
          dom
            .querySelectorAll(
              '.uni-container-icon, [data-uni-chrome], .mermaid-header, .mermaid-svg-container, .uni-image-resize-handle, .uni-image-spinner',
            )
            .forEach((el) => el.remove());

          const nodes = $generateNodesFromDOM(editor, dom);
          $insertNodes(nodes);
          $normalizeRootBlocks();
        }, { discrete: true });
      },
    });

    this.adapters.set('markdown', {
      exportToString: (editor) => {
        let md = '';
        editor.getEditorState().read(() => {
          // Convert with temporary unwrapping for cleaner MD
          md = $convertToMarkdownString(this.transformers);
        });
        return md.trim() + '\n';
      },
      importFromString: (editor, content) => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          // Normalize line endings (\r\n -> \n) to prevent CRLF from breaking multiline code/container blocks
          const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          $convertFromMarkdownString(normalized, this.transformers);
          $normalizeRootBlocks();
        }, { discrete: true });
      },
    });

    this.adapters.set('json', {
      exportToString: (editor) => {
        return JSON.stringify(editor.getEditorState().toJSON(), null, 2);
      },
      importFromString: (editor, content) => {
        const state = editor.parseEditorState(content);
        editor.setEditorState(state);
        editor.update(() => {
          $normalizeRootBlocks();
        }, { discrete: true });
      },
    });
  }
}

function wrapHtmlFragment(html: string): string {
  const trimmed = html.trim();
  if (/^<!DOCTYPE|^<html/i.test(trimmed)) return trimmed;
  return `<!DOCTYPE html><html><body>${trimmed}</body></html>`;
}

/**
 * Remove structural block-wrapper chrome while keeping semantic content +
 * preview-friendly classes (toggle / callout / image align / datetime).
 */
function cleanExportedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(wrapHtmlFragment(html), 'text/html');

    // Unwrap block wrappers only (keep custom block nodes)
    const wrappers = doc.querySelectorAll(
      '.uni-block-wrapper, [data-block-id], [data-lexical-block], [data-uni-block]',
    );
    wrappers.forEach((wrap) => {
      const parent = wrap.parentNode;
      if (!parent) return;
      while (wrap.firstChild) {
        parent.insertBefore(wrap.firstChild, wrap);
      }
      parent.removeChild(wrap);
    });

    // Strip editor-only image chrome, but KEEP .uni-image-wrap so align/display survive
    doc
      .querySelectorAll('.uni-image-resize-handle, .uni-image-spinner')
      .forEach((el) => el.remove());

    // Flatten .uni-image-frame (editor layout) → leave img inside wrap
    doc.querySelectorAll('.uni-image-frame').forEach((frame) => {
      const img = frame.querySelector('img');
      const parent = frame.parentElement;
      if (img && parent) {
        parent.insertBefore(img, frame);
        frame.remove();
      }
    });

    // Legacy bare image container: promote classes onto wrap if needed
    doc.querySelectorAll('.uni-image-container').forEach((el) => {
      el.classList.add('uni-image-wrap', 'uni-image');
    });

    const cleaned = doc.body.innerHTML;
    // Ensure semantic classes + callout icons for preview.css
    return enhanceHtmlForPreview(cleaned);
  } catch {
    return html;
  }
}

/** Read-only helpers usable outside registry */
export function exportHtml(editor: LexicalEditor): string {
  let html = '';
  editor.getEditorState().read(() => {
    html = $generateHtmlFromNodes(editor, null);
  });
  return cleanExportedHtml(html);
}

export function exportMarkdown(editor: LexicalEditor, transformers = UNI_TRANSFORMERS): string {
  let md = '';
  editor.getEditorState().read(() => {
    md = $convertToMarkdownString(transformers);
  });
  return md.trim() + '\n';
}

export function exportJson(editor: LexicalEditor): string {
  return JSON.stringify(editor.getEditorState().toJSON());
}
