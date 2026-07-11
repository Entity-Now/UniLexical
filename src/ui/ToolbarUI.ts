import type { ToolbarController } from '../plugins/ToolbarController';
import type { ToolbarState } from '../core/types';
import {
  BG_COLORS,
  EMOJI_LIST,
  FONT_COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  LINE_HEIGHTS,
  TOOLBAR_LABELS,
  TOOLBAR_TITLES,
} from './labels';
import { createToolbarIconEl } from './icons';
import { TableGridPicker } from './TableGridPicker';
import type { HeadingTagType } from '@lexical/rich-text';
import { attachTooltip, attachPopover, destroyTippy, type TippyInstance } from './tippy';
import { animateToolbarButtons } from './motion';

/**
 * Pure DOM toolbar with tippy.js tooltips/popovers and motion micro-interactions.
 * Table uses a hover/drag grid picker (default 5×5).
 */
export class ToolbarUI {
  private root: HTMLElement;
  private buttons = new Map<string, HTMLButtonElement>();
  private tooltips: TippyInstance[] = [];
  private popovers = new Map<string, TippyInstance>();
  private unsub: (() => void) | null = null;
  private tablePicker: TableGridPicker;
  private maxTable: { rows: number; cols: number };

  constructor(
    private host: HTMLElement,
    private controller: ToolbarController,
    options?: { tableMaxSize?: { rows: number; cols: number } },
  ) {
    // Default 5×5 as requested; host can raise via tableMaxSize
    this.maxTable = options?.tableMaxSize ?? { rows: 5, cols: 5 };
    this.tablePicker = new TableGridPicker(this.maxTable.rows, this.maxTable.cols);

    this.root = document.createElement('div');
    this.root.className = 'uni-toolbar';
    this.root.setAttribute('role', 'toolbar');

    this.wireControllerUiHooks();
    this.renderButtons();
    this.host.prepend(this.root);

    // Entrance animation
    requestAnimationFrame(() => animateToolbarButtons(this.root));
  }

  private wireControllerUiHooks(): void {
    this.controller.setTablePickHandler(() => {
      const btn = this.buttons.get('table');
      if (!btn) {
        // No toolbar button — still open free-floating picker near viewport center
        const rect = new DOMRect(window.innerWidth / 2 - 80, 80, 160, 0);
        this.tablePicker.openAt(rect, (rows, cols) => this.controller.insertTable(rows, cols));
        return;
      }
      if (this.tablePicker.isOpen()) {
        this.tablePicker.hide();
        return;
      }
      this.hideAllPopovers();
      this.tablePicker.openOn(btn, (rows, cols) => {
        this.controller.insertTable(rows, cols);
      });
    });

    this.controller.setEmojiRequestHandler(() => {
      this.togglePopover('emoji', this.buttons.get('emoji') ?? this.root, () =>
        this.buildEmojiPanel(),
      );
    });

    this.controller.setColorRequestHandler((kind) => {
      // Snapshot selection before tippy steals focus
      this.controller.captureStyleSelection();
      const key = kind === 'color' ? 'fontColor' : 'tableCellBackgroundColor';
      this.togglePopover(key, this.buttons.get(key) ?? this.root, () =>
        this.buildColorPanel(kind),
      );
    });

    this.controller.setFontSizeRequestHandler(() => {
      this.controller.captureStyleSelection();
      this.togglePopover('fontSize', this.buttons.get('fontSize') ?? this.root, () =>
        this.buildListPanel(
          FONT_SIZES.map((s) => ({ label: s, value: s })),
          (v) => this.controller.setFontSize(v),
        ),
      );
    });

    this.controller.setFontFamilyRequestHandler(() => {
      this.controller.captureStyleSelection();
      this.togglePopover('fontFamily', this.buttons.get('fontFamily') ?? this.root, () =>
        this.buildListPanel(
          FONT_FAMILIES.map((f) => ({ label: f.label, value: f.value })),
          (v) => this.controller.setFontFamily(v),
        ),
      );
    });

    this.controller.setLineHeightRequestHandler(() => {
      this.controller.captureStyleSelection();
      this.togglePopover('lineHeight', this.buttons.get('lineHeight') ?? this.root, () =>
        this.buildListPanel(
          LINE_HEIGHTS.map((s) => ({ label: s, value: s })),
          (v) => this.controller.setLineHeight(v),
        ),
      );
    });

    this.controller.setHeadingMenuHandler(() => {
      this.togglePopover('heading', this.buttons.get('heading') ?? this.root, () =>
        this.buildListPanel(
          [
            { label: 'Paragraph', value: 'paragraph' },
            { label: 'Heading 1', value: 'h1' },
            { label: 'Heading 2', value: 'h2' },
            { label: 'Heading 3', value: 'h3' },
            { label: 'Heading 4', value: 'h4' },
            { label: 'Heading 5', value: 'h5' },
            { label: 'Heading 6', value: 'h6' },
          ],
          (v) => {
            if (v === 'paragraph') this.controller.setBlockType('paragraph');
            else this.controller.setHeadingTag(v as HeadingTagType);
          },
        ),
      );
    });

    this.controller.setAlignMenuHandler(() => {
      this.togglePopover('align', this.buttons.get('align') ?? this.root, () =>
        this.buildListPanel(
          [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
            { label: 'Justify', value: 'justify' },
          ],
          (v) => this.controller.formatElement(v as 'left' | 'center' | 'right' | 'justify'),
        ),
      );
    });
  }

  /** Expose table picker for slash-menu integration */
  openTablePickerAt(rect: DOMRect, onPick?: (rows: number, cols: number) => void): void {
    this.tablePicker.openAt(rect, (rows, cols) => {
      if (onPick) onPick(rows, cols);
      else this.controller.insertTable(rows, cols);
    });
  }

  bind(onChange: (cb: (state: ToolbarState) => void) => () => void): void {
    this.unsub = onChange((state) => this.syncState(state));
    this.syncState(this.controller.getState());
  }

  private renderButtons(): void {
    // Tear down old tippies
    for (const t of this.tooltips) t.destroy();
    this.tooltips = [];
    for (const p of this.popovers.values()) p.destroy();
    this.popovers.clear();

    this.root.innerHTML = '';
    this.buttons.clear();
    const items = this.controller.getItems();

    for (const item of items) {
      if (item === 'divider' || item === 'group') {
        const div = document.createElement('span');
        div.className = item === 'group' ? 'uni-toolbar-group' : 'uni-toolbar-divider';
        div.setAttribute('role', 'separator');
        this.root.appendChild(div);
        continue;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'uni-toolbar-btn';
      btn.dataset.item = item;
      const title = TOOLBAR_TITLES[item as keyof typeof TOOLBAR_TITLES] ?? item;
      btn.setAttribute('aria-label', title);
      btn.title = ''; // tippy owns the tooltip

      // Material Design icon (local SVG); fall back to text label
      const iconEl = createToolbarIconEl(item);
      if (iconEl) {
        btn.appendChild(iconEl);
      } else {
        const label = TOOLBAR_LABELS[item as keyof typeof TOOLBAR_LABELS] ?? item;
        const fallback = document.createElement('span');
        fallback.className = 'uni-toolbar-label';
        fallback.textContent = label;
        btn.appendChild(fallback);
      }

      if (item === 'fontColor') {
        btn.classList.add('uni-toolbar-btn-color');
        const bar = document.createElement('span');
        bar.className = 'uni-toolbar-color-bar';
        btn.appendChild(bar);
      }

      // tippy.js tooltip (richer than native title)
      this.tooltips.push(
        attachTooltip(btn, title, {
          delay: [350, 40],
          placement: 'bottom',
        }),
      );

      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        // No pulseActive here — it reflows and feels like toolbar flicker
        this.controller.exec(item);
      });
      this.buttons.set(item, btn);
      this.root.appendChild(btn);
    }
  }

  refreshItems(): void {
    this.appliedActive.clear();
    this.appliedDisabled.clear();
    this.appliedColor = '';
    this.renderButtons();
    this.syncState(this.controller.getState());
    // Entrance animation only when the item set is rebuilt (not on every keystroke)
    requestAnimationFrame(() => animateToolbarButtons(this.root));
  }

  /** Last applied UI bits — only write DOM when a value actually changes */
  private appliedActive = new Map<string, boolean>();
  private appliedDisabled = new Map<string, boolean>();
  private appliedColor = '';

  private syncState(state: ToolbarState): void {
    const activeMap: Partial<Record<string, boolean>> = {
      bold: state.bold,
      italic: state.italic,
      underline: state.underline,
      strike: state.strikethrough,
      strikethrough: state.strikethrough,
      code: state.code,
      highlight: state.highlight,
      subscript: state.subscript,
      superscript: state.superscript,
      link: state.link,
      heading1: state.blockType === 'h1',
      heading2: state.blockType === 'h2',
      heading3: state.blockType === 'h3',
      heading4: state.blockType === 'h4',
      heading5: state.blockType === 'h5',
      heading6: state.blockType === 'h6',
      paragraph: state.blockType === 'paragraph',
      quote: state.blockType === 'quote',
      bulletList: state.blockType === 'bullet',
      orderedList: state.blockType === 'number',
      numberedList: state.blockType === 'number',
      todo: state.blockType === 'check',
      codeBlock: state.blockType === 'code',
      alignLeft: state.elementFormat === 'left',
      alignCenter: state.elementFormat === 'center',
      alignRight: state.elementFormat === 'right',
      alignJustify: state.elementFormat === 'justify',
      painter: state.painterActive,
      fullscreen: state.isFullscreen,
      sourceCode: state.isSourceMode,
    };

    for (const [id, btn] of this.buttons) {
      const active = !!activeMap[id];
      if (this.appliedActive.get(id) !== active) {
        this.appliedActive.set(id, active);
        btn.classList.toggle('uni-toolbar-btn-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }

      if (id === 'undo' || id === 'redo') {
        const disabled = id === 'undo' ? !state.canUndo : !state.canRedo;
        if (this.appliedDisabled.get(id) !== disabled) {
          this.appliedDisabled.set(id, disabled);
          btn.disabled = disabled;
        }
      }

      if (id === 'fontColor') {
        const color = state.fontColor || 'currentColor';
        if (this.appliedColor !== color) {
          this.appliedColor = color;
          const bar = btn.querySelector('.uni-toolbar-color-bar') as HTMLElement | null;
          if (bar) bar.style.background = color;
        }
      }
    }
  }

  // ─── tippy popover content builders ─────────────────────────────────

  private togglePopover(key: string, anchor: HTMLElement, build: () => HTMLElement): void {
    const existing = this.popovers.get(key);
    if (existing?.state.isVisible) {
      existing.hide();
      return;
    }
    this.hideAllPopovers();
    this.tablePicker.hide();

    const content = build();
    const inst = attachPopover(anchor, content, {
      trigger: 'manual',
      onShow: () => {
        // content is mounted by tippy at this point
      },
    });
    this.popovers.set(key, inst);
    inst.show();
  }

  private hideAllPopovers(): void {
    for (const p of this.popovers.values()) p.hide();
  }

  private buildListPanel(
    options: Array<{ label: string; value: string }>,
    onPick: (value: string) => void,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'uni-toolbar-list-popover';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'uni-toolbar-popover-item';
      btn.textContent = opt.label;
      if (opt.value) btn.style.fontFamily = opt.value;
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        onPick(opt.value);
        this.hideAllPopovers();
      });
      wrap.appendChild(btn);
    }
    return wrap;
  }

  private buildColorPanel(kind: 'color' | 'bg'): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'uni-toolbar-color-popover';
    // Keep editor selection while interacting with the palette
    wrap.addEventListener('mousedown', (e) => e.preventDefault());
    const grid = document.createElement('div');
    grid.className = 'uni-color-grid';
    const colors = kind === 'color' ? FONT_COLORS : BG_COLORS;
    for (const c of colors) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'uni-color-swatch';
      sw.style.background =
        c === 'transparent'
          ? 'conic-gradient(#ccc 0 25%, #fff 0 50%, #ccc 0 75%, #fff 0)'
          : c;
      sw.title = c;
      sw.addEventListener('mousedown', (e) => e.preventDefault());
      sw.addEventListener('click', () => {
        if (kind === 'color') this.controller.setFontColor(c);
        else this.controller.setBackgroundColor(c);
        this.hideAllPopovers();
      });
      grid.appendChild(sw);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  private buildEmojiPanel(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'uni-toolbar-emoji-popover';
    const grid = document.createElement('div');
    grid.className = 'uni-emoji-grid';
    for (const e of EMOJI_LIST) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'uni-emoji-btn';
      btn.textContent = e;
      btn.addEventListener('mousedown', (ev) => ev.preventDefault());
      btn.addEventListener('click', () => {
        this.controller.insertEmoji(e);
        this.hideAllPopovers();
      });
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  destroy(): void {
    this.unsub?.();
    for (const t of this.tooltips) t.destroy();
    for (const p of this.popovers.values()) p.destroy();
    this.tablePicker.destroy();
    for (const btn of this.buttons.values()) destroyTippy(btn);
    this.root.remove();
  }

  getElement(): HTMLElement {
    return this.root;
  }
}
