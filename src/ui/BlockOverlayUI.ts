import type { BlockOverlayController } from '../plugins/BlockOverlayController';
import type { SlashCommandController } from '../plugins/SlashCommandController';
import type { BlockHoverPayload } from '../core/types';
import { BlockMenuUI } from './BlockMenuUI';

/**
 * Floating drag-handle + plus button beside hovered blocks.
 *
 * Important: the overlay lives on document.body (outside the contenteditable).
 * Moving the pointer onto it fires pointerleave on the editor — we therefore
 * keep a stable `activeBlockId` and only hide after a short grace period, so
 * click / drag handlers still know which block to target.
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

  constructor(
    private overlay: BlockOverlayController,
    private slash: SlashCommandController | null = null,
  ) {
    this.menu = new BlockMenuUI(overlay);

    this.root = document.createElement('div');
    this.root.className = 'uni-block-overlay';
    this.root.style.display = 'none';
    this.root.style.position = 'fixed';

    this.plusBtn = document.createElement('button');
    this.plusBtn.type = 'button';
    this.plusBtn.className = 'uni-plus-button';
    this.plusBtn.title = 'Add block';
    this.plusBtn.setAttribute('aria-label', 'Add block');
    this.plusBtn.innerHTML = PLUS_SVG;
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
    document.body.appendChild(this.root);

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
    this.root.style.top = `${rect.top + 2}px`;
    this.root.style.left = `${Math.max(4, rect.left - 52)}px`;
    this.root.style.height = `${Math.max(24, Math.min(rect.height, 40))}px`;
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

const PLUS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const DRAG_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="5" cy="3.5" r="1" fill="currentColor"/>
  <circle cx="9" cy="3.5" r="1" fill="currentColor"/>
  <circle cx="5" cy="7" r="1" fill="currentColor"/>
  <circle cx="9" cy="7" r="1" fill="currentColor"/>
  <circle cx="5" cy="10.5" r="1" fill="currentColor"/>
  <circle cx="9" cy="10.5" r="1" fill="currentColor"/>
</svg>`;
