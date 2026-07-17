import type { TableAction, TableActionController } from '../plugins/TableActionController';

/**
 * Floating toolbar shown above the active table for row/col insert & delete.
 */
export class TableActionUI {
  private root: HTMLElement;
  private unsub: (() => void) | null = null;
  private visible = false;

  constructor(private controller: TableActionController) {
    this.root = document.createElement('div');
    this.root.className = 'uni-table-action-bar';
    this.root.style.display = 'none';
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Table actions');

    const actions: Array<{ action: TableAction; label: string; title: string }> = [
      { action: 'insert-row-above', label: '↑ Row', title: 'Insert row above' },
      { action: 'insert-row-below', label: '↓ Row', title: 'Insert row below' },
      { action: 'insert-col-left', label: '← Col', title: 'Insert column left' },
      { action: 'insert-col-right', label: '→ Col', title: 'Insert column right' },
      { action: 'delete-row', label: 'Del row', title: 'Delete row' },
      { action: 'delete-col', label: 'Del col', title: 'Delete column' },
      { action: 'delete-table', label: 'Del table', title: 'Delete table' },
    ];

    for (const a of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'uni-table-action-btn';
      if (a.action.startsWith('delete')) {
        btn.classList.add('uni-table-action-btn-danger');
      }
      btn.textContent = a.label;
      btn.title = a.title;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.run(a.action);
      });
      this.root.appendChild(btn);
    }

    document.body.appendChild(this.root);

    this.controller.setActiveChangeHandler(({ active, rect }) => {
      if (!active || !rect) {
        this.hide();
        return;
      }
      this.showAt(rect);
    });
  }

  private showAt(rect: DOMRect): void {
    this.visible = true;
    this.root.style.display = 'flex';
    const barW = this.root.offsetWidth || 420;
    let left = rect.left + rect.width / 2 - barW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - barW - 8));
    let top = rect.top - 40;
    if (top < 8) top = rect.bottom + 8;
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
  }

  private hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.unsub?.();
    this.root.remove();
  }

  getElement(): HTMLElement {
    return this.root;
  }

  isVisible(): boolean {
    return this.visible;
  }
}
