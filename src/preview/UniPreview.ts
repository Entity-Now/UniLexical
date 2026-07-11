import type { UniEditor } from '../core/UniEditor';

export interface UniPreviewOptions {
  /**
   * Extra class on the content root (still under `.uni-preview`).
   * The outer host you pass is left untouched.
   */
  className?: string;
  /** Initial HTML to render */
  html?: string;
}

/**
 * Read-only HTML previewer for UniLexical content.
 *
 * - Does **not** style the host container (avoids clobbering host layout).
 * - Injects a single inner root with class `uni-preview` where content CSS applies.
 * - Pair with `unilexical/preview.css`.
 *
 * @example
 * ```ts
 * import { mountPreview } from 'unilexical';
 * import 'unilexical/preview.css';
 *
 * const preview = mountPreview('#preview');
 * preview.bindEditor(editor); // live updates from editor `change` events
 * // or: preview.setHtml(editor.getHtml());
 * ```
 */
export class UniPreview {
  private host: HTMLElement;
  private root: HTMLElement;
  private unsub: (() => void) | null = null;

  constructor(container: string | HTMLElement, options: UniPreviewOptions = {}) {
    const el =
      typeof container === 'string'
        ? document.querySelector<HTMLElement>(container)
        : container;

    if (!el) {
      throw new Error(`[UniLexical] Preview container not found: ${String(container)}`);
    }

    this.host = el;
    // Host is intentionally not given chrome classes/styles.
    this.root = document.createElement('div');
    this.root.className = ['uni-preview', options.className].filter(Boolean).join(' ');
    // Neutralize inherited list/margin surprises without styling the host
    this.root.setAttribute('data-uni-preview', 'true');
    this.host.appendChild(this.root);

    if (options.html != null) {
      this.setHtml(options.html);
    }
  }

  /** Replace preview HTML (expects cleaned export from `editor.getHtml()`). */
  setHtml(html: string): void {
    this.root.innerHTML = html || '';
  }

  getHtml(): string {
    return this.root.innerHTML;
  }

  getElement(): HTMLElement {
    return this.root;
  }

  getHost(): HTMLElement {
    return this.host;
  }

  /**
   * Subscribe to an editor's `change` event and re-render from HTML.
   * Returns an unsubscribe function.
   */
  bindEditor(editor: UniEditor): () => void {
    this.unbind();
    // Initial paint
    try {
      this.setHtml(editor.getHtml());
    } catch {
      this.setHtml('');
    }

    this.unsub = editor.on('change', ({ html }) => {
      this.setHtml(html);
    });
    return () => this.unbind();
  }

  unbind(): void {
    this.unsub?.();
    this.unsub = null;
  }

  destroy(): void {
    this.unbind();
    this.root.remove();
  }
}

/** Create and mount a preview into a container. */
export function mountPreview(
  container: string | HTMLElement,
  options?: UniPreviewOptions,
): UniPreview {
  return new UniPreview(container, options);
}
