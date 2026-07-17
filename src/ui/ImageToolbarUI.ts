import type { ImageAlign, ImageDisplay } from '../nodes/ImageNode';

export interface ImageToolbarActions {
  setAlign: (align: ImageAlign) => void;
  setDisplay: (display: ImageDisplay) => void;
  setWidth: (width: number | 'inherit') => void;
  deleteImage: () => void;
}

/**
 * Floating toolbar for selected / focused images: align, display, width presets.
 */
export class ImageToolbarUI {
  private root: HTMLElement;
  private actions: ImageToolbarActions | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'uni-image-toolbar';
    this.root.style.display = 'none';
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Image options');

    const group = (label: string, children: HTMLElement[]) => {
      const g = document.createElement('div');
      g.className = 'uni-image-toolbar-group';
      const lab = document.createElement('span');
      lab.className = 'uni-image-toolbar-label';
      lab.textContent = label;
      g.appendChild(lab);
      for (const c of children) g.appendChild(c);
      return g;
    };

    const mkBtn = (text: string, title: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'uni-image-toolbar-btn';
      b.textContent = text;
      b.title = title;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return b;
    };

    this.root.appendChild(
      group('Align', [
        mkBtn('⬅', 'Align left', () => this.actions?.setAlign('left')),
        mkBtn('▮', 'Align center', () => this.actions?.setAlign('center')),
        mkBtn('➡', 'Align right', () => this.actions?.setAlign('right')),
      ]),
    );

    this.root.appendChild(
      group('Display', [
        mkBtn('Block', 'Block (full width row)', () =>
          this.actions?.setDisplay('block'),
        ),
        mkBtn('Inline', 'Inline with text', () =>
          this.actions?.setDisplay('inline'),
        ),
      ]),
    );

    this.root.appendChild(
      group('Width', [
        mkBtn('25%', '25% width', () => this.actions?.setWidth(0.25)),
        mkBtn('50%', '50% width', () => this.actions?.setWidth(0.5)),
        mkBtn('75%', '75% width', () => this.actions?.setWidth(0.75)),
        mkBtn('100%', 'Full width', () => this.actions?.setWidth(0.999)),
        mkBtn('Auto', 'Original size', () => this.actions?.setWidth('inherit')),
      ]),
    );

    const del = mkBtn('Delete', 'Remove image', () => this.actions?.deleteImage());
    del.classList.add('uni-image-toolbar-btn-danger');
    this.root.appendChild(del);

    document.body.appendChild(this.root);
  }

  /**
   * @param widthPresets as fraction of container — controller converts to px
   */
  show(rect: DOMRect, actions: ImageToolbarActions): void {
    this.actions = actions;
    // Inline critical styles so host CSS / previous hide cannot win
    this.root.style.cssText = [
      'display:flex',
      'position:fixed',
      'z-index:10060',
      'flex-wrap:wrap',
      'align-items:center',
      'gap:6px',
      'padding:6px 8px',
      'border-radius:8px',
      'background:#ffffff',
      'border:1px solid #e5e7eb',
      'box-shadow:0 8px 28px rgba(15,23,42,0.16)',
      'opacity:1',
      'visibility:visible',
      'pointer-events:auto',
      'max-width:calc(100vw - 16px)',
    ].join(';');
    // Measure after visible
    const barW = Math.max(this.root.offsetWidth, 360);
    let left = rect.left + rect.width / 2 - barW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - barW - 8));
    let top = rect.top - 48;
    if (top < 8) top = rect.bottom + 8;
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
  }

  hide(): void {
    this.root.style.display = 'none';
    this.actions = null;
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }
}
