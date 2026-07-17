import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import { $isToggleNode } from '../nodes/ToggleNode';
import { $createDateTimeNode, $isDateTimeNode } from '../nodes/DateTimeNode';
import {
  $isContainerNode,
  CONTAINER_ICONS,
  type ContainerVariant,
} from '../nodes/ContainerNode';
import {
  $isImageNode,
  type ImageAlign,
  type ImageDisplay,
} from '../nodes/ImageNode';
import { getCalloutIconSvg, normalizeCalloutIcon } from '../ui/calloutIcons';
import { DateTimePickerUI } from '../ui/DateTimePickerUI';
import { ImageToolbarUI } from '../ui/ImageToolbarUI';

/**
 * Click handlers for toggle carets, datetime chips, container icons,
 * and image selection / resize / floating toolbar.
 *
 * IMPORTANT: Lexical `$…` helpers must run inside `editor.read()` / `editor.update()`,
 * never `getEditorState().read()` (no active editor).
 */
export class BlockExtrasController {
  private cleanups: Array<() => void> = [];
  private datePicker = new DateTimePickerUI();
  private imageToolbar = new ImageToolbarUI();
  private activeImageKey: NodeKey | null = null;
  private resizing: {
    key: NodeKey;
    startX: number;
    startWidth: number;
    previewWidth?: number;
  } | null = null;
  private rootEl: HTMLElement | null = null;

  constructor(private editor: LexicalEditor) {}

  mount(rootElement: HTMLElement): void {
    this.rootEl = rootElement;

    const onClick = (e: MouseEvent) => this.handleClick(e);
    const onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
    const onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
    const onPointerUp = () => this.handlePointerUp();
    // Use pointerdown on document so image toolbar isn't cleared by the same click
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.closest?.('.uni-image-toolbar') ||
        t.closest?.('.uni-image-wrap') ||
        t.closest?.('.uni-datetime-picker') ||
        t.closest?.('.uni-block-overlay')
      ) {
        return;
      }
      this.clearImageSelection();
    };

    rootElement.addEventListener('click', onClick);
    rootElement.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    // Defer so the selecting click on the image is not cancelled
    document.addEventListener('pointerdown', onDocPointerDown, true);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.target instanceof HTMLElement) {
          const container = m.target.closest?.('.uni-container') as HTMLElement | null;
          if (container?.hasAttribute('data-uni-container')) {
            this.ensureContainerBadge(container);
          }
          if (m.target.hasAttribute('data-uni-container')) {
            this.ensureContainerBadge(m.target);
          }
        }
      }
    });
    mo.observe(rootElement, { childList: true, subtree: true });

    this.cleanups.push(() => {
      rootElement.removeEventListener('click', onClick);
      rootElement.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      mo.disconnect();
    });
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.datePicker.destroy();
    this.imageToolbar.destroy();
  }

  private ensureContainerBadge(dom: HTMLElement): void {
    let badge = dom.querySelector(':scope > .uni-container-icon') as HTMLButtonElement | null;
    const icon = normalizeCalloutIcon(dom.getAttribute('data-icon'));
    if (!badge) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'uni-container-icon';
      badge.setAttribute('data-uni-chrome', 'true');
      badge.setAttribute('contenteditable', 'false');
      badge.title = 'Change icon (Shift+click: change style)';
      badge.setAttribute('aria-label', 'Change callout icon');
      dom.insertBefore(badge, dom.firstChild);
    } else if (badge !== dom.firstChild) {
      dom.insertBefore(badge, dom.firstChild);
    }
    if (badge.dataset.icon !== icon) {
      badge.dataset.icon = icon;
      badge.innerHTML = getCalloutIconSvg(icon);
    }
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Toggle caret zone
    const toggleEl = target.closest('.uni-toggle') as HTMLElement | null;
    if (toggleEl) {
      const first = toggleEl.querySelector(
        ':scope > .uni-toggle-title, :scope > :first-child',
      ) as HTMLElement | null;
      const isCaretBtn = !!target.closest('.uni-toggle-caret');
      const clickOnTitleStart =
        first &&
        (target === first || first.contains(target)) &&
        e.clientX - first.getBoundingClientRect().left < 32;
      if (isCaretBtn || clickOnTitleStart) {
        e.preventDefault();
        e.stopPropagation();
        this.editor.update(() => {
          const node = $getNearestNodeFromDOMNode(toggleEl);
          if ($isToggleNode(node)) node.toggleOpen();
        });
        return;
      }
    }

    // DateTime chip
    const dtEl = target.closest('[data-uni-datetime]') as HTMLElement | null;
    if (dtEl) {
      e.preventDefault();
      e.stopPropagation();
      const rect = dtEl.getBoundingClientRect();
      let key: NodeKey | null = null;
      let datetime = new Date().toISOString();
      let includeTime = false;

      this.editor.read(() => {
        const node = $getNearestNodeFromDOMNode(dtEl);
        if (!$isDateTimeNode(node)) return;
        key = node.getKey();
        datetime = node.getDateTime();
        includeTime = node.getIncludeTime();
      });

      if (!key) return;
      const nodeKey = key;
      this.datePicker.open(rect, { datetime, includeTime }, (result) => {
        this.editor.update(() => {
          const n = $getNodeByKey(nodeKey);
          if ($isDateTimeNode(n)) {
            n.setDateTime(result.datetime);
            n.setIncludeTime(result.includeTime);
          }
        });
      });
      return;
    }

    // Container icon
    const iconBtn = target.closest('.uni-container-icon') as HTMLElement | null;
    if (iconBtn) {
      e.preventDefault();
      e.stopPropagation();
      const containerEl = iconBtn.closest('.uni-container') as HTMLElement | null;
      if (!containerEl) return;
      this.editor.update(() => {
        const node = $getNearestNodeFromDOMNode(containerEl);
        if (!$isContainerNode(node)) return;
        if (e.shiftKey) {
          const order: ContainerVariant[] = [
            'default',
            'info',
            'warning',
            'success',
            'error',
            'gray',
          ];
          const i = order.indexOf(node.getVariant());
          node.setVariant(order[(i + 1) % order.length]);
        } else {
          const cur = node.getIcon();
          const idx = CONTAINER_ICONS.indexOf(cur);
          const next = CONTAINER_ICONS[(idx + 1 + CONTAINER_ICONS.length) % CONTAINER_ICONS.length];
          node.setIcon(next);
        }
      });
      return;
    }

    // Image select
    const imgWrap = target.closest('.uni-image-wrap') as HTMLElement | null;
    if (imgWrap && !target.closest('.uni-image-resize-handle')) {
      e.stopPropagation();
      this.selectImageFromDOM(imgWrap);
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    const handle = (e.target as HTMLElement).closest(
      '.uni-image-resize-handle',
    ) as HTMLElement | null;
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = handle.closest('.uni-image-wrap') as HTMLElement | null;
    if (!wrap) return;

    this.editor.read(() => {
      const node = $getNearestNodeFromDOMNode(wrap);
      if (!$isImageNode(node)) return;
      const key = node.getKey();
      const img = wrap.querySelector('img.uni-image-el') as HTMLImageElement | null;
      const startWidth =
        typeof node.getWidth() === 'number'
          ? (node.getWidth() as number)
          : img?.getBoundingClientRect().width || 320;
      this.resizing = { key, startX: e.clientX, startWidth };
    });
    this.selectImageFromDOM(wrap);
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.resizing) return;
    const dx = e.clientX - this.resizing.startX;
    const next = Math.max(80, Math.round(this.resizing.startWidth + dx));
    const key = this.resizing.key;
    const dom = this.editor.getElementByKey(key);
    const img = dom?.querySelector('img.uni-image-el') as HTMLImageElement | null;
    const frame = dom?.querySelector('.uni-image-frame') as HTMLElement | null;
    if (img) {
      img.style.width = `${next}px`;
      img.width = next;
    }
    if (frame) frame.style.width = `${next}px`;
    this.resizing.previewWidth = next;
  }

  private handlePointerUp(): void {
    if (!this.resizing) return;
    const { key, previewWidth } = this.resizing;
    this.resizing = null;
    if (previewWidth == null) return;
    this.editor.update(() => {
      const n = $getNodeByKey(key);
      if ($isImageNode(n)) {
        n.setWidth(previewWidth);
        n.setHeight('inherit');
      }
    });
  }

  private selectImageFromDOM(wrap: HTMLElement): void {
    let key: NodeKey | null = null;

    this.editor.read(() => {
      const node = $getNearestNodeFromDOMNode(wrap);
      if (!$isImageNode(node)) return;
      key = node.getKey();
    });

    if (!key) return;
    const nodeKey = key;

    this.activeImageKey = nodeKey;
    wrap.classList.add('uni-image-selected');
    this.rootEl?.querySelectorAll('.uni-image-selected').forEach((el) => {
      if (el !== wrap) el.classList.remove('uni-image-selected');
    });

    const rect = wrap.getBoundingClientRect();
    const containerWidth =
      this.rootEl?.clientWidth || wrap.parentElement?.clientWidth || 640;

    this.imageToolbar.show(rect, {
      setAlign: (align: ImageAlign) => {
        this.editor.update(() => {
          const n = $getNodeByKey(nodeKey);
          if ($isImageNode(n)) n.setAlign(align);
        });
        requestAnimationFrame(() => {
          const el = this.editor.getElementByKey(nodeKey);
          if (el) this.selectImageFromDOM(el);
        });
      },
      setDisplay: (display: ImageDisplay) => {
        this.editor.update(() => {
          const n = $getNodeByKey(nodeKey);
          if ($isImageNode(n)) n.setDisplay(display);
        });
        requestAnimationFrame(() => {
          const el = this.editor.getElementByKey(nodeKey);
          if (el) this.selectImageFromDOM(el);
        });
      },
      setWidth: (width: number | 'inherit') => {
        this.editor.update(() => {
          const n = $getNodeByKey(nodeKey);
          if (!$isImageNode(n)) return;
          if (width === 'inherit') {
            n.setWidth('inherit');
            n.setHeight('inherit');
          } else {
            const px = Math.round(containerWidth * width);
            n.setWidth(Math.max(80, px));
            n.setHeight('inherit');
          }
        });
        requestAnimationFrame(() => {
          const el = this.editor.getElementByKey(nodeKey);
          if (el) this.selectImageFromDOM(el);
        });
      },
      deleteImage: () => {
        this.editor.update(() => {
          const n = $getNodeByKey(nodeKey);
          if ($isImageNode(n)) {
            const parent = n.getParent();
            n.remove();
            parent?.selectEnd?.();
          }
        });
        this.clearImageSelection();
      },
    });
  }

  private clearImageSelection(): void {
    this.activeImageKey = null;
    this.rootEl?.querySelectorAll('.uni-image-selected').forEach((el) => {
      el.classList.remove('uni-image-selected');
    });
    this.imageToolbar.hide();
  }

  insertDateTime(includeTime = false): void {
    this.editor.focus();
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const node = $createDateTimeNode(undefined, includeTime);
      selection.insertNodes([node]);
      try {
        node.selectNext(0, 0);
      } catch {
        /* ignore */
      }
    });
  }

  setContainerIcon(blockKey: NodeKey, icon: string): void {
    this.editor.update(() => {
      const n = $getNodeByKey(blockKey);
      if ($isContainerNode(n)) n.setIcon(icon);
    });
  }

  setContainerVariant(blockKey: NodeKey, variant: ContainerVariant): void {
    this.editor.update(() => {
      const n = $getNodeByKey(blockKey);
      if ($isContainerNode(n)) n.setVariant(variant);
    });
  }
}
