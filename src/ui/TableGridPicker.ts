import { animateIn, animateTableCells, pulseActive } from './motion';
import type { TippyInstance } from './tippy';
import { showFloatingContent, attachPopover } from './tippy';

/**
 * Interactive row × column grid picker for table insertion.
 *
 * Starts at a base size (default 5×5). When the selection reaches the current
 * edge, the board grows by one row/col (up to hardMax, default 20) — Notion-like.
 */
export class TableGridPicker {
  private panel: HTMLElement;
  private status: HTMLElement;
  private grid: HTMLElement;
  private cells: HTMLButtonElement[][] = [];
  /** Current painted board size (grows dynamically) */
  private boardRows: number;
  private boardCols: number;
  private baseRows: number;
  private baseCols: number;
  private hardMax: number;
  private onPick: ((rows: number, cols: number) => void) | null = null;
  private hoverRows = 0;
  private hoverCols = 0;
  private dragging = false;
  private confirmed = false;
  private tippyInst: TippyInstance | null = null;
  private freeInst: TippyInstance | null = null;

  constructor(baseRows = 5, baseCols = 5, hardMax = 20) {
    this.baseRows = Math.max(1, Math.min(baseRows, hardMax));
    this.baseCols = Math.max(1, Math.min(baseCols, hardMax));
    this.hardMax = Math.max(this.baseRows, Math.min(hardMax, 30));
    this.boardRows = this.baseRows;
    this.boardCols = this.baseCols;

    this.panel = document.createElement('div');
    this.panel.className = 'uni-table-picker';

    const title = document.createElement('div');
    title.className = 'uni-table-picker-title';
    title.textContent = 'Insert table';
    this.panel.appendChild(title);

    this.status = document.createElement('div');
    this.status.className = 'uni-table-picker-status';
    this.status.textContent = 'Select size';
    this.panel.appendChild(this.status);

    this.grid = document.createElement('div');
    this.grid.className = 'uni-table-picker-grid';
    this.grid.setAttribute('role', 'grid');
    this.grid.setAttribute('aria-label', 'Table size selector');
    this.rebuildGrid();

    this.grid.addEventListener('pointerleave', () => {
      if (!this.dragging) this.paint(0, 0);
    });
    document.addEventListener('pointerup', this.onDocPointerUp);

    const hint = document.createElement('div');
    hint.className = 'uni-table-picker-hint';
    hint.textContent = 'Hover edge to expand · Click to insert';

    this.panel.appendChild(this.grid);
    this.panel.appendChild(hint);
  }

  private onDocPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (!this.confirmed && this.hoverRows > 0 && this.hoverCols > 0) {
      this.confirm(this.hoverRows, this.hoverCols);
    }
  };

  private rebuildGrid(): void {
    this.grid.innerHTML = '';
    this.cells = [];
    this.grid.style.gridTemplateColumns = `repeat(${this.boardCols}, minmax(0, 1fr))`;

    for (let r = 0; r < this.boardRows; r++) {
      const row: HTMLButtonElement[] = [];
      for (let c = 0; c < this.boardCols; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'uni-table-picker-cell';
        cell.dataset.row = String(r + 1);
        cell.dataset.col = String(c + 1);
        cell.setAttribute('aria-label', `${r + 1} by ${c + 1}`);
        cell.tabIndex = -1;

        cell.addEventListener('pointerenter', () => {
          this.paint(r + 1, c + 1);
          this.maybeExpand(r + 1, c + 1);
        });
        cell.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dragging = true;
          this.paint(r + 1, c + 1);
        });
        cell.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.confirm(r + 1, c + 1);
        });

        this.grid.appendChild(cell);
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  /** Grow board when selection touches current edge */
  private maybeExpand(rows: number, cols: number): void {
    let changed = false;
    if (rows >= this.boardRows && this.boardRows < this.hardMax) {
      this.boardRows = Math.min(this.hardMax, this.boardRows + 1);
      changed = true;
    }
    if (cols >= this.boardCols && this.boardCols < this.hardMax) {
      this.boardCols = Math.min(this.hardMax, this.boardCols + 1);
      changed = true;
    }
    if (changed) {
      const keepR = this.hoverRows;
      const keepC = this.hoverCols;
      this.rebuildGrid();
      this.paint(keepR || rows, keepC || cols);
      // Keep tippy sized
      this.tippyInst?.popperInstance?.update?.();
      this.freeInst?.popperInstance?.update?.();
    }
  }

  openOn(anchor: HTMLElement, onPick: (rows: number, cols: number) => void): void {
    this.resetBoard();
    this.onPick = onPick;
    this.confirmed = false;
    this.paint(0, 0);
    this.destroyInstances();

    this.tippyInst = attachPopover(anchor, this.panel, {
      trigger: 'manual',
      onShow: () => {
        animateIn(this.panel, { y: 8, scale: 0.94, duration: 0.2 });
      },
      onHidden: () => {
        this.onPick = null;
        this.confirmed = false;
      },
    });
    this.tippyInst.show();
  }

  openAt(rect: DOMRect, onPick: (rows: number, cols: number) => void): void {
    this.resetBoard();
    this.onPick = onPick;
    this.confirmed = false;
    this.paint(0, 0);
    this.destroyInstances();
    this.freeInst = showFloatingContent(this.panel, rect, {
      onShow: () => animateIn(this.panel, { y: 8, scale: 0.94 }),
      onHidden: () => {
        this.onPick = null;
        this.confirmed = false;
      },
    });
  }

  private resetBoard(): void {
    this.boardRows = this.baseRows;
    this.boardCols = this.baseCols;
    this.rebuildGrid();
  }

  hide(): void {
    this.tippyInst?.hide();
    this.freeInst?.hide();
    this.dragging = false;
    this.paint(0, 0);
  }

  isOpen(): boolean {
    return !!(this.tippyInst?.state.isVisible || this.freeInst?.state.isVisible);
  }

  contains(node: Node | null): boolean {
    return !!node && this.panel.contains(node);
  }

  private confirm(rows: number, cols: number): void {
    if (this.confirmed) return;
    if (rows < 1 || cols < 1) return;
    this.confirmed = true;
    this.dragging = false;

    const pick = this.onPick;
    const active: Element[] = [];
    for (let r = 0; r < Math.min(rows, this.boardRows); r++) {
      for (let c = 0; c < Math.min(cols, this.boardCols); c++) {
        active.push(this.cells[r][c]);
      }
    }
    animateTableCells(active);
    pulseActive(this.status);
    this.hide();
    window.setTimeout(() => {
      pick?.(rows, cols);
      this.confirmed = false;
    }, 60);
  }

  private paint(rows: number, cols: number): void {
    this.hoverRows = rows;
    this.hoverCols = cols;
    this.status.textContent = rows && cols ? `${rows} × ${cols}` : 'Select size';
    for (let r = 0; r < this.boardRows; r++) {
      for (let c = 0; c < this.boardCols; c++) {
        this.cells[r][c]?.classList.toggle(
          'uni-table-picker-cell-active',
          r < rows && c < cols,
        );
      }
    }
  }

  private destroyInstances(): void {
    this.tippyInst?.destroy();
    this.freeInst?.destroy();
    this.tippyInst = null;
    this.freeInst = null;
  }

  destroy(): void {
    document.removeEventListener('pointerup', this.onDocPointerUp);
    this.destroyInstances();
    this.panel.remove();
  }
}
