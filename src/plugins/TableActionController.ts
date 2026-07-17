import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableNode,
  $isTableSelection,
  TableCellNode,
  TableNode,
} from '@lexical/table';

export type TableAction =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'insert-col-left'
  | 'insert-col-right'
  | 'delete-row'
  | 'delete-col'
  | 'delete-table';

/**
 * Table row/column insert & delete helpers + selection detection for floating UI.
 */
export class TableActionController {
  private cleanups: Array<() => void> = [];
  private onActiveChange: ((payload: {
    active: boolean;
    tableEl: HTMLElement | null;
    rect: DOMRect | null;
  }) => void) | null = null;
  private rootEl: HTMLElement | null = null;

  constructor(private editor: LexicalEditor) {}

  mount(rootElement: HTMLElement): void {
    this.rootEl = rootElement;

    const emit = () => this.syncActive();
    const unsubUpdate = this.editor.registerUpdateListener(() => {
      // Debounce via rAF
      requestAnimationFrame(emit);
    });
    rootElement.addEventListener('pointerup', emit);
    rootElement.addEventListener('keyup', emit);
    rootElement.addEventListener('focusin', emit);

    this.cleanups.push(() => {
      unsubUpdate();
      rootElement.removeEventListener('pointerup', emit);
      rootElement.removeEventListener('keyup', emit);
      rootElement.removeEventListener('focusin', emit);
    });
  }

  setActiveChangeHandler(
    handler: (payload: {
      active: boolean;
      tableEl: HTMLElement | null;
      rect: DOMRect | null;
    }) => void,
  ): void {
    this.onActiveChange = handler;
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.onActiveChange = null;
  }

  private syncActive(): void {
    if (!this.onActiveChange || !this.rootEl) return;
    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      let cell: TableCellNode | null = null;

      if ($isTableSelection(selection)) {
        const nodes = selection.getNodes();
        for (const n of nodes) {
          if ($isTableCellNode(n)) {
            cell = n;
            break;
          }
        }
      } else if ($isRangeSelection(selection)) {
        let n = selection.anchor.getNode();
        while (n) {
          if ($isTableCellNode(n)) {
            cell = n;
            break;
          }
          n = n.getParent() as typeof n;
        }
      }

      if (!cell) {
        this.onActiveChange?.({ active: false, tableEl: null, rect: null });
        return;
      }

      let table: TableNode | null = null;
      let p = cell.getParent();
      while (p) {
        if ($isTableNode(p)) {
          table = p;
          break;
        }
        p = p.getParent();
      }
      if (!table) {
        this.onActiveChange?.({ active: false, tableEl: null, rect: null });
        return;
      }

      const dom = this.editor.getElementByKey(table.getKey());
      if (!dom) {
        this.onActiveChange?.({ active: false, tableEl: null, rect: null });
        return;
      }
      this.onActiveChange?.({
        active: true,
        tableEl: dom,
        rect: dom.getBoundingClientRect(),
      });
    });
  }

  run(action: TableAction): void {
    this.editor.focus();
    this.editor.update(() => {
      try {
        switch (action) {
          case 'insert-row-above':
            $insertTableRow__EXPERIMENTAL(false);
            break;
          case 'insert-row-below':
            $insertTableRow__EXPERIMENTAL(true);
            break;
          case 'insert-col-left':
            $insertTableColumn__EXPERIMENTAL(false);
            break;
          case 'insert-col-right':
            $insertTableColumn__EXPERIMENTAL(true);
            break;
          case 'delete-row':
            $deleteTableRow__EXPERIMENTAL();
            break;
          case 'delete-col':
            $deleteTableColumn__EXPERIMENTAL();
            break;
          case 'delete-table': {
            const selection = $getSelection();
            let node =
              $isRangeSelection(selection)
                ? selection.anchor.getNode()
                : $isTableSelection(selection)
                  ? selection.getNodes()[0]
                  : null;
            while (node) {
              if ($isTableNode(node)) {
                const parent = node.getParent();
                node.remove();
                // If table was sole content of a block, leave a paragraph via normalize
                parent?.selectEnd?.();
                break;
              }
              node = node.getParent();
            }
            break;
          }
        }
      } catch (err) {
        console.warn('[UniLexical] table action failed:', action, err);
      }
    });
  }

  /** Resolve table from a DOM target (for context menu) */
  getTableFromDOM(target: HTMLElement | null): HTMLElement | null {
    return target?.closest?.('table.uni-table, .uni-table, table') as HTMLElement | null;
  }

  selectTableFromDOM(tableEl: HTMLElement): void {
    this.editor.update(() => {
      const node = $getNearestNodeFromDOMNode(tableEl);
      if ($isTableNode(node)) {
        try {
          node.selectStart();
        } catch {
          /* ignore */
        }
      }
    });
  }
}
