import type { SlashCommandController } from '../plugins/SlashCommandController';
import type { SlashMenuItem, SlashTriggerPayload } from '../core/types';
import { animateIn } from './motion';

/**
 * Pure DOM slash command popup.
 */
export class SlashMenuUI {
  private root: HTMLElement;
  private visible = false;
  private unsub: (() => void) | null = null;
  /** Avoid full re-render on every mouseenter (was destroying click targets) */
  private itemEls: HTMLButtonElement[] = [];

  constructor(
    private controller: SlashCommandController,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'uni-slash-menu';
    this.root.setAttribute('role', 'listbox');
    this.root.style.display = 'none';
    this.root.style.position = 'fixed';
    // Prevent editor selection/slash-close while interacting with the menu
    this.root.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.root.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    document.body.appendChild(this.root);
  }

  bind(onSlash: (cb: (payload: SlashTriggerPayload) => void) => () => void): void {
    this.unsub = onSlash((payload) => this.onTrigger(payload));
  }

  private onTrigger(payload: SlashTriggerPayload): void {
    if (!payload.open || !payload.rect) {
      this.hide();
      return;
    }
    this.show(payload.rect);
  }

  private show(rect: DOMRect): void {
    this.visible = true;
    this.renderItems();
    this.root.style.display = 'block';
    this.root.style.top = `${rect.bottom + 6}px`;
    this.root.style.left = `${rect.left}px`;

    requestAnimationFrame(() => {
      const menuRect = this.root.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight) {
        this.root.style.top = `${Math.max(8, rect.top - menuRect.height - 6)}px`;
      }
      if (menuRect.right > window.innerWidth) {
        this.root.style.left = `${Math.max(8, window.innerWidth - menuRect.width - 8)}px`;
      }
      animateIn(this.root, { y: 8, scale: 0.96, duration: 0.18 });
    });
  }

  private hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
    this.root.innerHTML = '';
    this.itemEls = [];
  }

  private renderItems(): void {
    const items = this.controller.getFilteredItems();
    const active = this.controller.getActiveIndex();
    this.root.innerHTML = '';
    this.itemEls = [];

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'uni-slash-menu-empty';
      empty.textContent = 'No results';
      this.root.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const el = this.createItemEl(item, index === active, index);
      this.itemEls.push(el);
      this.root.appendChild(el);
    });
  }

  private createItemEl(
    item: SlashMenuItem,
    isActive: boolean,
    index: number,
  ): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'uni-slash-menu-item' + (isActive ? ' uni-slash-menu-item-active' : '');
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    el.dataset.index = String(index);

    const icon = document.createElement('span');
    icon.className = 'uni-slash-menu-icon';
    icon.textContent = item.icon ?? '•';

    const body = document.createElement('span');
    body.className = 'uni-slash-menu-body';
    const title = document.createElement('span');
    title.className = 'uni-slash-menu-title';
    title.textContent = item.title;
    body.appendChild(title);
    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'uni-slash-menu-desc';
      desc.textContent = item.description;
      body.appendChild(desc);
    }

    el.appendChild(icon);
    el.appendChild(body);

    // Use pointerdown (not click) so action runs before selection is lost / menu unmounts
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.controller.execute(item);
    });

    el.addEventListener('mouseenter', () => {
      this.controller.setActiveIndex(index);
      this.syncActiveStyles();
    });

    return el;
  }

  private syncActiveStyles(): void {
    const active = this.controller.getActiveIndex();
    this.itemEls.forEach((el, i) => {
      const on = i === active;
      el.classList.toggle('uni-slash-menu-item-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /** Full re-render (query filter changed) */
  refresh(): void {
    if (!this.visible) return;
    this.renderItems();
  }

  /** Keyboard / hover active index only */
  setActiveHighlight(index: number): void {
    if (!this.visible) return;
    this.itemEls.forEach((el, i) => {
      const on = i === index;
      el.classList.toggle('uni-slash-menu-item-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  destroy(): void {
    this.unsub?.();
    this.root.remove();
  }

  getElement(): HTMLElement {
    return this.root;
  }
}
