import type { UniEditor } from '../core/UniEditor';
import { enhanceHtmlForPreview } from '../plugins/previewEnhance';

export interface UniPreviewOptions {
  /**
   * Extra class on the content root (still under `.uni-preview`).
   * The outer host you pass is left untouched.
   */
  className?: string;
  /** Initial HTML to render */
  html?: string;
  /**
   * When true (default), normalize HTML so toggle/callout/datetime/image
   * classes and callout icons are present for `preview.css`.
   */
  enhance?: boolean;
  /**
   * When true (default), toggle blocks can be expanded/collapsed by clicking
   * the chevron / title row in the preview (read-only document, local UI state).
   */
  interactiveToggles?: boolean;
}

/**
 * Read-only HTML previewer for UniLexical content.
 *
 * - Does **not** style the host container (avoids clobbering host layout).
 * - Injects a single inner root with class `uni-preview` where content CSS applies.
 * - Pair with `unilexical/preview.css`.
 * - Toggle blocks support click-to-collapse when `interactiveToggles` is on (default).
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
  private enhance: boolean;
  private interactiveToggles: boolean;
  /** Local open overrides by toggle index (survives live HTML refresh). */
  private toggleOpenOverrides = new Map<number, boolean>();
  private onToggleClick: ((e: MouseEvent) => void) | null = null;

  constructor(container: string | HTMLElement, options: UniPreviewOptions = {}) {
    const el =
      typeof container === 'string'
        ? document.querySelector<HTMLElement>(container)
        : container;

    if (!el) {
      throw new Error(`[UniLexical] Preview container not found: ${String(container)}`);
    }

    this.host = el;
    this.enhance = options.enhance !== false;
    this.interactiveToggles = options.interactiveToggles !== false;
    // Host is intentionally not given chrome classes/styles.
    this.root = document.createElement('div');
    this.root.className = ['uni-preview', options.className].filter(Boolean).join(' ');
    // Neutralize inherited list/margin surprises without styling the host
    this.root.setAttribute('data-uni-preview', 'true');
    this.host.appendChild(this.root);

    if (this.interactiveToggles) {
      this.bindToggleInteraction();
    }

    if (options.html != null) {
      this.setHtml(options.html);
    }
  }

  /**
   * Replace preview HTML.
   * Prefer `editor.getHtml()` (already cleaned + enhanced).
   * Raw HTML is still enhanced when `enhance` is enabled (default).
   */
  setHtml(html: string): void {
    const raw = html || '';
    this.root.innerHTML = this.enhance ? enhanceHtmlForPreview(raw) : raw;
    this.applyToggleOpenOverrides();
    this.decorateTogglesForInteraction();
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
   * Local toggle open/closed state is preserved across refreshes by index.
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

  /** Clear local collapse overrides (next setHtml uses exported open state only). */
  clearToggleOverrides(): void {
    this.toggleOpenOverrides.clear();
  }

  destroy(): void {
    this.unbind();
    if (this.onToggleClick) {
      this.root.removeEventListener('click', this.onToggleClick);
      this.onToggleClick = null;
    }
    this.root.remove();
  }

  private bindToggleInteraction(): void {
    this.onToggleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const toggle = target.closest(
        '.uni-toggle, [data-uni-toggle]',
      ) as HTMLElement | null;
      if (!toggle || !this.root.contains(toggle)) return;

      // Only toggle when clicking the title row (first child) or its chevron area
      const title = toggle.querySelector(
        ':scope > :first-child',
      ) as HTMLElement | null;
      if (!title) return;

      const onTitle =
        target === title ||
        title.contains(target) ||
        !!target.closest('.uni-toggle-caret');

      // Also allow click on the left chevron padding of the title
      const rect = title.getBoundingClientRect();
      const nearChevron = e.clientX - rect.left < 36 && e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!onTitle && !nearChevron) return;

      e.preventDefault();
      e.stopPropagation();

      const toggles = this.getToggleElements();
      const index = toggles.indexOf(toggle);
      const nextOpen = toggle.getAttribute('data-open') === 'false';
      toggle.setAttribute('data-open', nextOpen ? 'true' : 'false');
      title.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      if (index >= 0) {
        this.toggleOpenOverrides.set(index, nextOpen);
      }
    };

    this.root.addEventListener('click', this.onToggleClick);
  }

  private getToggleElements(): HTMLElement[] {
    return Array.from(
      this.root.querySelectorAll<HTMLElement>('.uni-toggle, [data-uni-toggle]'),
    );
  }

  private applyToggleOpenOverrides(): void {
    if (!this.interactiveToggles || this.toggleOpenOverrides.size === 0) return;
    const toggles = this.getToggleElements();
    toggles.forEach((el, i) => {
      if (!this.toggleOpenOverrides.has(i)) return;
      const open = this.toggleOpenOverrides.get(i);
      el.setAttribute('data-open', open ? 'true' : 'false');
    });
  }

  /** Cursor + a11y for interactive toggles */
  private decorateTogglesForInteraction(): void {
    if (!this.interactiveToggles) return;
    this.getToggleElements().forEach((toggle) => {
      toggle.classList.add('uni-toggle-interactive');
      const title = toggle.querySelector(':scope > :first-child') as HTMLElement | null;
      if (!title) return;
      title.setAttribute('role', 'button');
      title.setAttribute('tabindex', '0');
      title.setAttribute(
        'aria-expanded',
        toggle.getAttribute('data-open') !== 'false' ? 'true' : 'false',
      );
      title.style.cursor = 'pointer';

      // Keyboard: Enter / Space on title
      if (!title.dataset.uniToggleKeybound) {
        title.dataset.uniToggleKeybound = '1';
        title.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key !== 'Enter' && ev.key !== ' ') return;
          ev.preventDefault();
          title.click();
        });
      }
    });
  }
}

/** Create and mount a preview into a container. */
export function mountPreview(
  container: string | HTMLElement,
  options?: UniPreviewOptions,
): UniPreview {
  return new UniPreview(container, options);
}
