import type {
  BlockContentKind,
  BlockInfo,
  BlockOverlayController,
} from '../plugins/BlockOverlayController';
import { FONT_COLORS } from './labels';
import { MATERIAL_ICONS, type MaterialIconName } from './icons';
import { animateIn } from './motion';

type MenuAction =
  | { type: 'delete' }
  | { type: 'duplicate' }
  | { type: 'insert'; where: 'before' | 'after' }
  | { type: 'turnInto'; kind: BlockContentKind }
  | { type: 'color'; color: string }
  | { type: 'submenu'; id: 'turnInto' | 'color' };

interface MenuItemDef {
  id: string;
  label: string;
  icon?: string; // raw svg or material key
  material?: MaterialIconName;
  danger?: boolean;
  action: MenuAction;
  /** Hide when predicate returns false */
  when?: (info: BlockInfo) => boolean;
}

const TURN_INTO_OPTIONS: Array<{ kind: BlockContentKind; label: string; material: MaterialIconName }> = [
  { kind: 'paragraph', label: 'Text', material: 'notes' },
  { kind: 'h1', label: 'Heading 1', material: 'looks_one' },
  { kind: 'h2', label: 'Heading 2', material: 'looks_two' },
  { kind: 'h3', label: 'Heading 3', material: 'looks_3' },
  { kind: 'quote', label: 'Quote', material: 'format_quote' },
  { kind: 'bullet', label: 'Bulleted list', material: 'format_list_bulleted' },
  { kind: 'number', label: 'Numbered list', material: 'format_list_numbered' },
  { kind: 'check', label: 'To-do list', material: 'checklist' },
  { kind: 'code', label: 'Code', material: 'data_object' },
  { kind: 'container', label: 'Container', material: 'view_agenda' },
];

const DELETE_SVG = `<svg fill="currentColor" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const COPY_SVG = `<svg fill="currentColor" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
const ADD_ABOVE_SVG = `<svg fill="currentColor" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M8 11h3v8h2v-8h3l-4-4-4 4zM4 3v2h16V3H4z"/></svg>`;
const ADD_BELOW_SVG = `<svg fill="currentColor" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M16 13h-3V5h-2v8H8l4 4 4-4zM4 19v2h16v-2H4z"/></svg>`;
const CHEVRON_SVG = `<svg fill="currentColor" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;

/**
 * Context menu opened from the drag handle click (Notion-style block menu).
 */
export class BlockMenuUI {
  private root: HTMLElement;
  private panel: HTMLElement;
  private open = false;
  private blockId: string | null = null;
  private info: BlockInfo | null = null;
  private onDocPointer: ((e: PointerEvent) => void) | null = null;
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  constructor(private overlay: BlockOverlayController) {
    this.root = document.createElement('div');
    this.root.className = 'uni-block-menu-root';
    this.root.style.display = 'none';

    this.panel = document.createElement('div');
    this.panel.className = 'uni-block-menu';
    this.panel.setAttribute('role', 'menu');
    this.panel.addEventListener('mousedown', (e) => {
      // Keep editor selection when interacting
      e.preventDefault();
      e.stopPropagation();
    });
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
  }

  /**
   * Open menu anchored near the drag handle (or a rect).
   */
  openAt(blockId: string, anchor: DOMRect): void {
    const info = this.overlay.getBlockInfo(blockId);
    if (!info) return;

    this.blockId = blockId;
    this.info = info;
    this.open = true;
    this.renderMain();

    this.root.style.display = 'block';
    this.panel.style.position = 'fixed';
    this.panel.style.top = `${anchor.bottom + 4}px`;
    this.panel.style.left = `${Math.max(8, anchor.left - 4)}px`;

    // Flip if overflowing viewport
    requestAnimationFrame(() => {
      const r = this.panel.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 8) {
        this.panel.style.top = `${Math.max(8, anchor.top - r.height - 4)}px`;
      }
      if (r.right > window.innerWidth - 8) {
        this.panel.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
      }
      animateIn(this.panel, { y: 6, scale: 0.97, duration: 0.16 });
    });

    this.bindDismiss();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.blockId = null;
    this.info = null;
    this.root.style.display = 'none';
    this.panel.innerHTML = '';
    this.unbindDismiss();
  }

  isOpen(): boolean {
    return this.open;
  }

  destroy(): void {
    this.close();
    this.root.remove();
  }

  private bindDismiss(): void {
    this.unbindDismiss();
    this.onDocPointer = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && this.root.contains(t)) return;
      // Allow click on drag handle to re-open / not instantly close
      if (t instanceof Element && t.closest('.uni-drag-handle')) return;
      this.close();
    };
    this.onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.close();
    };
    // Delay so the opening click doesn't immediately close
    setTimeout(() => {
      document.addEventListener('pointerdown', this.onDocPointer!, true);
      document.addEventListener('keydown', this.onKey!, true);
    }, 0);
  }

  private unbindDismiss(): void {
    if (this.onDocPointer) {
      document.removeEventListener('pointerdown', this.onDocPointer, true);
      this.onDocPointer = null;
    }
    if (this.onKey) {
      document.removeEventListener('keydown', this.onKey, true);
      this.onKey = null;
    }
  }

  private renderMain(): void {
    if (!this.info) return;
    const info = this.info;

    const items: MenuItemDef[] = [
      {
        id: 'insert-above',
        label: 'Insert above',
        icon: ADD_ABOVE_SVG,
        action: { type: 'insert', where: 'before' },
      },
      {
        id: 'insert-below',
        label: 'Insert below',
        icon: ADD_BELOW_SVG,
        action: { type: 'insert', where: 'after' },
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: COPY_SVG,
        action: { type: 'duplicate' },
        when: (i) => i.kind !== 'hr',
      },
      {
        id: 'turn-into',
        label: 'Turn into',
        material: 'title',
        action: { type: 'submenu', id: 'turnInto' },
        when: (i) => i.supportsTurnInto,
      },
      {
        id: 'color',
        label: 'Color',
        material: 'format_color_text',
        action: { type: 'submenu', id: 'color' },
        when: (i) => i.supportsTextColor,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: DELETE_SVG,
        danger: true,
        action: { type: 'delete' },
      },
    ];

    this.panel.innerHTML = '';

    // Header: current type
    const header = document.createElement('div');
    header.className = 'uni-block-menu-header';
    header.textContent = info.label;
    this.panel.appendChild(header);

    for (const item of items) {
      if (item.when && !item.when(info)) continue;
      this.panel.appendChild(this.createItemEl(item));
    }
  }

  private renderTurnInto(): void {
    if (!this.info) return;
    this.panel.innerHTML = '';

    const back = this.createItemEl({
      id: 'back',
      label: '← Back',
      action: { type: 'submenu', id: 'turnInto' }, // reused as back via special id
    });
    // Override back click
    back.onclick = (e) => {
      e.preventDefault();
      this.renderMain();
    };
    this.panel.appendChild(back);

    const sep = document.createElement('div');
    sep.className = 'uni-block-menu-divider';
    this.panel.appendChild(sep);

    for (const opt of TURN_INTO_OPTIONS) {
      const active = opt.kind === this.info.kind;
      const el = this.createItemEl({
        id: `turn-${opt.kind}`,
        label: opt.label,
        material: opt.material,
        action: { type: 'turnInto', kind: opt.kind },
      });
      if (active) el.classList.add('uni-block-menu-item-active');
      this.panel.appendChild(el);
    }
  }

  private renderColor(): void {
    this.panel.innerHTML = '';

    const back = this.createItemEl({
      id: 'back',
      label: '← Back',
      action: { type: 'submenu', id: 'color' },
    });
    back.onclick = (e) => {
      e.preventDefault();
      this.renderMain();
    };
    this.panel.appendChild(back);

    const sep = document.createElement('div');
    sep.className = 'uni-block-menu-divider';
    this.panel.appendChild(sep);

    const grid = document.createElement('div');
    grid.className = 'uni-block-menu-color-grid';
    for (const c of FONT_COLORS) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'uni-block-menu-color-swatch';
      sw.style.background = c;
      sw.title = c;
      sw.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.blockId) return;
        this.overlay.applyBlockTextColor(this.blockId, c);
        this.close();
      });
      grid.appendChild(sw);
    }
    this.panel.appendChild(grid);
  }

  private createItemEl(item: MenuItemDef): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'uni-block-menu-item' + (item.danger ? ' uni-block-menu-item-danger' : '');
    btn.setAttribute('role', 'menuitem');

    const icon = document.createElement('span');
    icon.className = 'uni-block-menu-icon';
    if (item.material && MATERIAL_ICONS[item.material]) {
      icon.innerHTML = MATERIAL_ICONS[item.material];
    } else if (item.icon) {
      icon.innerHTML = item.icon;
    }
    btn.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'uni-block-menu-label';
    label.textContent = item.label;
    btn.appendChild(label);

    if (item.action.type === 'submenu') {
      const chev = document.createElement('span');
      chev.className = 'uni-block-menu-chevron';
      chev.innerHTML = CHEVRON_SVG;
      btn.appendChild(chev);
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.runAction(item);
    });

    return btn;
  }

  private runAction(item: MenuItemDef): void {
    if (!this.blockId) return;
    const id = this.blockId;
    const action = item.action;

    if (action.type === 'submenu') {
      if (item.id === 'back') {
        this.renderMain();
        return;
      }
      if (action.id === 'turnInto') {
        this.renderTurnInto();
        return;
      }
      if (action.id === 'color') {
        this.renderColor();
        return;
      }
      return;
    }

    switch (action.type) {
      case 'delete':
        this.overlay.deleteBlock(id);
        break;
      case 'duplicate':
        this.overlay.duplicateBlock(id);
        break;
      case 'insert':
        this.overlay.insertRelative(id, action.where);
        break;
      case 'turnInto':
        this.overlay.turnInto(id, action.kind);
        break;
      case 'color':
        this.overlay.applyBlockTextColor(id, action.color);
        break;
    }
    this.close();
  }
}
