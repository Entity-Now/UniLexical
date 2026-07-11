import {
  $getRoot,
  $insertNodes,
  type LexicalEditor,
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
  type Transformer,
} from '@lexical/markdown';
import type { ContentFormat } from '../core/types';
import { $normalizeRootBlocks } from './blockTransform';

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
  private transformers: Transformer[] = TRANSFORMERS;

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
          const dom = parser.parseFromString(wrapHtmlFragment(content), 'text/html');
          const nodes = $generateNodesFromDOM(editor, dom);
          $insertNodes(nodes);
          $normalizeRootBlocks();
        });
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
          $convertFromMarkdownString(content, this.transformers);
          $normalizeRootBlocks();
        });
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
        });
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
 * Remove structural block-wrapper divs while keeping semantic children.
 */
function cleanExportedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(wrapHtmlFragment(html), 'text/html');
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
    // Strip decorator containers
    doc.querySelectorAll('.uni-image-container, .uni-image-wrap').forEach((el) => {
      const img = el.querySelector('img');
      if (img && el.parentNode) {
        el.parentNode.insertBefore(img, el);
        el.remove();
      }
    });
    return doc.body.innerHTML;
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

export function exportMarkdown(editor: LexicalEditor, transformers = TRANSFORMERS): string {
  let md = '';
  editor.getEditorState().read(() => {
    md = $convertToMarkdownString(transformers);
  });
  return md.trim() + '\n';
}

export function exportJson(editor: LexicalEditor): string {
  return JSON.stringify(editor.getEditorState().toJSON());
}
