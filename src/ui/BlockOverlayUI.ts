import type { BlockOverlayController } from '../plugins/BlockOverlayController';
import type { SlashCommandController } from '../plugins/SlashCommandController';
import type { BlockHoverPayload } from '../core/types';
import { BlockMenuUI } from './BlockMenuUI';

/**
 * Floating drag-handle + plus button beside hovered blocks.
 *
 * The overlay is mounted on the editor root (preferred) or `document.body`,
 * outside the contenteditable. Moving the pointer onto it fires pointerleave
 * on the editor — we therefore keep a stable `activeBlockId` and only hide
 * after a short grace period, so click / drag handlers still know which block
 * to target.
 *
 * Drag handle:
 * - drag → reorder blocks
 * - click → open block more-menu (delete / turn into / color / …)
 */
export class BlockOverlayUI {
  private root: HTMLElement;
  private plusBtn: HTMLButtonElement;
  private dragBtn: HTMLButtonElement;
  private unsub: (() => void) | null = null;
  /** Last hovered block – never cleared by pointerleave while interacting */
  private activeBlockId: string | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pointerOnOverlay = false;
  /** True if a native drag actually started (suppress click → menu) */
  private didDrag = false;
  private menu: BlockMenuUI;
  private host: HTMLElement;

  /**
   * @param host Mount target for the floating overlay. Prefer the editor root
   *   (`.uni-editor-root`) so the overlay participates in the same stacking
   *   context as dialogs/modals that wrap the editor. Falls back to `document.body`.
   */
  constructor(
    private overlay: BlockOverlayController,
    private slash: SlashCommandController | null = null,
    host?: HTMLElement | null,
  ) {
    this.menu = new BlockMenuUI(overlay);
    this.host = host ?? document.body;

    this.root = document.createElement('div');
    this.root.className = 'uni-block-overlay';
    this.root.setAttribute('data-uni-overlay', 'true');
    // Inline critical geometry so host CSS cannot zero-out the chrome
    this.root.style.cssText = [
      'display:none',
      'position:fixed',
      'z-index:10050',
      'pointer-events:auto',
      'opacity:1',
      'visibility:visible',
      'box-sizing:border-box',
      'margin:0',
      'padding:0',
      'border:none',
      'background:transparent',
    ].join(';');

    this.plusBtn = document.createElement('button');
    this.plusBtn.type = 'button';
    this.plusBtn.className = 'uni-plus-button';
    this.plusBtn.title = 'Add block';
    this.plusBtn.setAttribute('aria-label', 'Add block');
    this.plusBtn.innerHTML = PLUS_SVG;
    applyControlButtonInlineStyles(this.plusBtn);
    // Do NOT preventDefault on mousedown for drag; for plus, prevent editor blur
    this.plusBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.plusBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.menu.close();
      const blockId = this.activeBlockId;
      if (!blockId) return;
      // Empty line: focus only (no new block). Non-empty: insert empty block after.
      this.overlay.handlePlusClick(blockId, () => {
        requestAnimationFrame(() => {
          this.slash?.openAtSelection();
        });
      });
    });

    this.dragBtn = document.createElement('button');
    this.dragBtn.type = 'button';
    this.dragBtn.className = 'uni-drag-handle';
    this.dragBtn.title = 'Drag to move · Click for menu';
    this.dragBtn.setAttribute('aria-label', 'Drag to reorder or click for block menu');
    this.dragBtn.draggable = true;
    this.dragBtn.innerHTML = DRAG_SVG;
    applyControlButtonInlineStyles(this.dragBtn);
    this.dragBtn.style.cursor = 'grab';

    // Critical: do NOT call preventDefault on mousedown — it cancels HTML5 drag
    this.dragBtn.addEventListener('pointerdown', (e) => {
      // Stop Lexical from taking the event, but allow native drag
      e.stopPropagation();
      this.didDrag = false;
    });

    this.dragBtn.addEventListener('dragstart', (e) => {
      const blockId = this.activeBlockId;
      if (!blockId) {
        e.preventDefault();
        return;
      }
      this.didDrag = true;
      this.menu.close();
      this.overlay.beginDrag(blockId, e);
    });

    this.dragBtn.addEventListener('dragend', () => {
      this.overlay.endDrag();
      // Reset after browser may still fire click
      setTimeout(() => {
        this.didDrag = false;
      }, 0);
    });

    this.dragBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Drag just finished → ignore synthetic click
      if (this.didDrag) {
        this.didDrag = false;
        return;
      }
      const blockId = this.activeBlockId;
      if (!blockId) return;

      // Toggle: click again closes
      if (this.menu.isOpen()) {
        this.menu.close();
        return;
      }

      const rect = this.dragBtn.getBoundingClientRect();
      this.menu.openAt(blockId, rect);
      // Keep overlay visible while menu is open
      this.cancelHide();
      this.pointerOnOverlay = true;
    });

    this.root.appendChild(this.plusBtn);
    this.root.appendChild(this.dragBtn);
    // Mount under editor root when available so modal stacking contexts still show us
    this.host.appendChild(this.root);

    this.root.addEventListener('pointerenter', () => {
      this.pointerOnOverlay = true;
      this.cancelHide();
      this.root.style.display = 'flex';
    });
    this.root.addEventListener('pointerleave', () => {
      // Don't hide while the more-menu is open
      if (this.menu.isOpen()) return;
      this.pointerOnOverlay = false;
      this.scheduleHide();
    });
  }

  bind(onHover: (cb: (payload: BlockHoverPayload) => void) => () => void): void {
    this.unsub = onHover((payload) => this.onHover(payload));
  }

  private onHover(payload: BlockHoverPayload): void {
    if (!payload.blockId || !payload.rect) {
      // Editor pointer left a block — delay hide so user can reach the overlay
      if (this.menu.isOpen()) return;
      this.scheduleHide();
      return;
    }

    this.cancelHide();
    this.activeBlockId = payload.blockId;
    this.root.style.display = 'flex';

    const { rect } = payload;
    // Prefer the left gutter (content has ~56px padding). Keep fully on-screen.
    const overlayWidth = 52;
    const preferredLeft = rect.left - overlayWidth;
    const maxLeft = Math.max(4, window.innerWidth - overlayWidth - 4);
    const left = Math.min(maxLeft, Math.max(4, preferredLeft));
    const top = Math.max(4, Math.min(rect.top + 2, window.innerHeight - 28));

    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
    this.root.style.height = `${Math.max(24, Math.min(rect.height, 40))}px`;
    this.root.style.zIndex = '10050';
  }

  private scheduleHide(): void {
    if (this.menu.isOpen()) return;
    this.cancelHide();
    this.hideTimer = setTimeout(() => {
      if (this.pointerOnOverlay || this.menu.isOpen()) return;
      this.root.style.display = 'none';
    }, 200);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  destroy(): void {
    this.cancelHide();
    this.menu.destroy();
    this.unsub?.();
    this.root.remove();
  }

  getElement(): HTMLElement {
    return this.root;
  }

  getMenu(): BlockMenuUI {
    return this.menu;
  }
}

/** Defensive inline styles so host button resets cannot hide controls */
function applyControlButtonInlineStyles(btn: HTMLButtonElement): void {
  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'width:24px',
    'min-width:24px',
    'height:24px',
    'min-height:24px',
    'margin:0',
    'padding:0',
    'border:1px solid rgba(0,0,0,0.08)',
    'border-radius:4px',
    'background:#ffffff',
    'background-color:#ffffff',
    'color:#6b7280',
    'opacity:1',
    'visibility:visible',
    'cursor:pointer',
    'font-size:14px',
    'line-height:1',
    'flex-shrink:0',
    'pointer-events:auto',
    'box-shadow:0 1px 2px rgba(15,23,42,0.08)',
    '-webkit-appearance:none',
    'appearance:none',
  ].join(';');
}

const PLUS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;width:14px;height:14px;min-width:14px;min-height:14px;max-width:none;pointer-events:none">
  <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const DRAG_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;width:14px;height:14px;min-width:14px;min-height:14px;max-width:none;pointer-events:none">
  <circle cx="5" cy="3.5" r="1" fill="currentColor"/>
  <circle cx="9" cy="3.5" r="1" fill="currentColor"/>
  <circle cx="5" cy="7" r="1" fill="currentColor"/>
  <circle cx="9" cy="7" r="1" fill="currentColor"/>
  <circle cx="5" cy="10.5" r="1" fill="currentColor"/>
  <circle cx="9" cy="10.5" r="1" fill="currentColor"/>
</svg>`;
