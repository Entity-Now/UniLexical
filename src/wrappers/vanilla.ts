import { UniEditor, createUniEditor } from '../core/UniEditor';
import type { UniEditorConfig } from '../core/types';

export interface VanillaMountOptions extends UniEditorConfig {
  /** CSS selector or HTMLElement */
  container: string | HTMLElement;
}

export interface VanillaEditorHandle {
  editor: UniEditor;
  destroy: () => void;
  getHtml: () => string;
  getMarkdown: () => string;
  getJson: () => string;
  setContent: (content: string, format?: 'html' | 'markdown' | 'json') => void;
  focus: () => void;
}

/**
 * Create a UniEditor instance without mounting.
 */
export function createEditor(config?: UniEditorConfig): UniEditor {
  return createUniEditor(config);
}

/**
 * Create and mount a UniEditor into a DOM container (native JS entry).
 *
 * @example
 * ```ts
 * import { mountEditor } from 'unilexical';
 * import 'unilexical/style.css';
 *
 * const { editor, destroy } = mountEditor({
 *   container: '#app',
 *   toolbarItems: ['bold', 'italic', 'underline'],
 *   imageOptions: { upload: async (file) => uploadToS3(file) },
 * });
 * ```
 */
export function mountEditor(options: VanillaMountOptions): VanillaEditorHandle {
  const { container, ...config } = options;
  const el =
    typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!el) {
    throw new Error(`[UniLexical] Container not found: ${String(container)}`);
  }

  const editor = createUniEditor(config);
  editor.mount(el);

  return {
    editor,
    destroy: () => editor.destroy(),
    getHtml: () => editor.getHtml(),
    getMarkdown: () => editor.getMarkdown(),
    getJson: () => editor.getJson(),
    setContent: (content, format = 'json') => editor.setContent(content, format),
    focus: () => editor.focus(),
  };
}
