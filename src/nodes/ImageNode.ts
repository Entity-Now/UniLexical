import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  DecoratorNode,
} from 'lexical';

export type ImageStatus = 'loading' | 'ready' | 'error';
export type ImageAlign = 'left' | 'center' | 'right';
export type ImageDisplay = 'block' | 'inline';

export type SerializedImageNode = Spread<
  {
    src: string;
    alt: string;
    width: number | 'inherit';
    height: number | 'inherit';
    status: ImageStatus;
    align: ImageAlign;
    display: ImageDisplay;
    type: 'image';
    version: 2;
  },
  SerializedLexicalNode
>;

/**
 * Image DecoratorNode — full DOM in createDOM/updateDOM for vanilla Lexical
 * (no React decorator reconciler required; decorate() returns null).
 *
 * Supports align (left/center/right), display (block/inline), and width resize.
 */
export class ImageNode extends DecoratorNode<null> {
  __src: string;
  __alt: string;
  __width: number | 'inherit';
  __height: number | 'inherit';
  __status: ImageStatus;
  __align: ImageAlign;
  __display: ImageDisplay;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__alt,
      node.__width,
      node.__height,
      node.__status,
      node.__align,
      node.__display,
      node.__key,
    );
  }

  constructor(
    src: string,
    alt = '',
    width: number | 'inherit' = 'inherit',
    height: number | 'inherit' = 'inherit',
    status: ImageStatus = 'ready',
    align: ImageAlign = 'left',
    display: ImageDisplay = 'block',
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__width = width;
    this.__height = height;
    this.__status = status;
    this.__align = align;
    this.__display = display;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const theme = config.theme as { image?: string; imageLoading?: string };
    const wrap = document.createElement('div');
    wrap.className = `uni-image-wrap ${theme.image ?? 'uni-image'}`.trim();
    wrap.contentEditable = 'false';
    wrap.setAttribute('data-lexical-decorator', 'true');
    wrap.setAttribute('data-uni-image', 'true');
    this.renderInto(wrap, theme);
    return wrap;
  }

  updateDOM(prev: ImageNode, dom: HTMLElement, config: EditorConfig): boolean {
    if (
      prev.__src !== this.__src ||
      prev.__alt !== this.__alt ||
      prev.__width !== this.__width ||
      prev.__height !== this.__height ||
      prev.__status !== this.__status ||
      prev.__align !== this.__align ||
      prev.__display !== this.__display
    ) {
      const theme = config.theme as { image?: string; imageLoading?: string };
      this.renderInto(dom, theme);
    }
    return false;
  }

  private renderInto(
    wrap: HTMLElement,
    theme: { image?: string; imageLoading?: string },
  ): void {
    wrap.innerHTML = '';
    wrap.className = [
      'uni-image-wrap',
      theme.image ?? 'uni-image',
      `uni-image-align-${this.__align}`,
      `uni-image-display-${this.__display}`,
    ]
      .filter(Boolean)
      .join(' ');
    wrap.contentEditable = 'false';
    wrap.setAttribute('data-uni-image', 'true');
    wrap.setAttribute('data-align', this.__align);
    wrap.setAttribute('data-display', this.__display);
    if (this.__width !== 'inherit') {
      wrap.setAttribute('data-width', String(this.__width));
    } else {
      wrap.removeAttribute('data-width');
    }

    if (this.__status === 'loading') {
      wrap.classList.add(theme.imageLoading ?? 'uni-image-loading');
      const spinner = document.createElement('span');
      spinner.className = 'uni-image-spinner';
      spinner.textContent = 'Uploading…';
      wrap.appendChild(spinner);
    } else {
      wrap.classList.remove(theme.imageLoading ?? 'uni-image-loading');
    }

    if (this.__status === 'error') {
      const err = document.createElement('span');
      err.className = 'uni-image-error';
      err.textContent = 'Image failed to load';
      wrap.appendChild(err);
      return;
    }

    if (!this.__src) {
      const empty = document.createElement('span');
      empty.className = 'uni-image-error';
      empty.textContent = 'No image source';
      wrap.appendChild(empty);
      return;
    }

    const frame = document.createElement('div');
    frame.className = 'uni-image-frame';

    const img = document.createElement('img');
    img.src = this.__src;
    img.alt = this.__alt || 'image';
    img.draggable = false;
    img.className = 'uni-image-el';
    if (!this.__src.startsWith('data:') && !this.__src.startsWith('blob:')) {
      img.loading = 'lazy';
    }
    img.decoding = 'async';
    if (this.__width !== 'inherit') {
      img.width = this.__width;
      img.style.width = `${this.__width}px`;
      frame.style.width = `${this.__width}px`;
    }
    if (this.__height !== 'inherit') {
      img.height = this.__height;
      img.style.height = `${this.__height}px`;
    }
    if (this.__status === 'loading') {
      img.style.opacity = '0.45';
    }
    img.addEventListener('error', () => {
      img.style.display = 'none';
      if (!wrap.querySelector('.uni-image-error')) {
        const err = document.createElement('span');
        err.className = 'uni-image-error';
        err.textContent = 'Image failed to load';
        wrap.appendChild(err);
      }
    });

    // Resize handles (right + corner)
    const handleR = document.createElement('span');
    handleR.className = 'uni-image-resize-handle uni-image-resize-e';
    handleR.setAttribute('data-resize', 'e');
    handleR.title = 'Drag to resize';

    const handleSE = document.createElement('span');
    handleSE.className = 'uni-image-resize-handle uni-image-resize-se';
    handleSE.setAttribute('data-resize', 'se');
    handleSE.title = 'Drag to resize';

    frame.appendChild(img);
    frame.appendChild(handleR);
    frame.appendChild(handleSE);
    wrap.appendChild(frame);
  }

  exportDOM(): DOMExportOutput {
    // Keep a styled wrap so preview.css can apply align / display / width
    const wrap = document.createElement('div');
    wrap.className = [
      'uni-image-wrap',
      'uni-image',
      `uni-image-align-${this.__align}`,
      `uni-image-display-${this.__display}`,
    ].join(' ');
    wrap.setAttribute('data-uni-image', 'true');
    wrap.setAttribute('data-align', this.__align);
    wrap.setAttribute('data-display', this.__display);

    const img = document.createElement('img');
    img.className = 'uni-image-el';
    img.setAttribute('src', this.__src);
    img.setAttribute('alt', this.__alt);
    img.setAttribute('data-align', this.__align);
    img.setAttribute('data-display', this.__display);
    if (this.__width !== 'inherit') {
      img.setAttribute('width', String(this.__width));
      img.style.width = `${this.__width}px`;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      wrap.setAttribute('data-width', String(this.__width));
    }
    if (this.__height !== 'inherit') {
      img.setAttribute('height', String(this.__height));
    }
    wrap.appendChild(img);
    return { element: wrap };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: () => ({
        conversion: (domNode: HTMLElement): DOMConversionOutput | null => {
          if (
            !domNode.hasAttribute('data-uni-image') &&
            !domNode.classList.contains('uni-image-wrap')
          ) {
            return null;
          }
          const img = domNode.querySelector('img');
          if (!img?.src) return null;
          const align = (domNode.getAttribute('data-align') as ImageAlign) || 'left';
          const display =
            (domNode.getAttribute('data-display') as ImageDisplay) || 'block';
          const wAttr = domNode.getAttribute('data-width') || img.getAttribute('width');
          return {
            node: $createImageNode({
              src: img.src,
              alt: img.alt || '',
              width: wAttr ? Number(wAttr) || 'inherit' : img.width || 'inherit',
              height: img.height || 'inherit',
              align: ['left', 'center', 'right'].includes(align) ? align : 'left',
              display: display === 'inline' ? 'inline' : 'block',
            }),
          };
        },
        priority: 3,
      }),
      img: () => ({
        conversion: (domNode: HTMLElement): DOMConversionOutput | null => {
          if (!(domNode instanceof HTMLImageElement)) return null;
          // Skip imgs that will be handled by parent wrap conversion
          if (
            domNode.parentElement?.hasAttribute('data-uni-image') ||
            domNode.parentElement?.classList.contains('uni-image-wrap')
          ) {
            return null;
          }
          const { src, alt, width, height } = domNode;
          if (!src) return null;
          const align = (domNode.getAttribute('data-align') as ImageAlign) || 'left';
          const display =
            (domNode.getAttribute('data-display') as ImageDisplay) || 'block';
          return {
            node: $createImageNode({
              src,
              alt,
              width: width || 'inherit',
              height: height || 'inherit',
              align: ['left', 'center', 'right'].includes(align) ? align : 'left',
              display: display === 'inline' ? 'inline' : 'block',
            }),
          };
        },
        priority: 2,
      }),
    };
  }

  exportJSON(): SerializedImageNode {
    return {
      src: this.__src,
      alt: this.__alt,
      width: this.__width,
      height: this.__height,
      status: this.__status,
      align: this.__align,
      display: this.__display,
      type: 'image',
      version: 2,
    };
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: json.src,
      alt: json.alt,
      width: json.width,
      height: json.height,
      status: json.status,
      align: json.align ?? 'left',
      display: json.display ?? 'block',
    });
  }

  getSrc(): string {
    return this.getLatest().__src;
  }
  getAlt(): string {
    return this.getLatest().__alt;
  }
  getStatus(): ImageStatus {
    return this.getLatest().__status;
  }
  getWidth(): number | 'inherit' {
    return this.getLatest().__width;
  }
  getAlign(): ImageAlign {
    return this.getLatest().__align;
  }
  getDisplay(): ImageDisplay {
    return this.getLatest().__display;
  }

  setSrc(src: string): this {
    const writable = this.getWritable();
    writable.__src = src;
    return this;
  }

  setStatus(status: ImageStatus): this {
    const writable = this.getWritable();
    writable.__status = status;
    return this;
  }

  setAlt(alt: string): this {
    const writable = this.getWritable();
    writable.__alt = alt;
    return this;
  }

  setWidth(width: number | 'inherit'): this {
    const writable = this.getWritable();
    writable.__width = width;
    return this;
  }

  setHeight(height: number | 'inherit'): this {
    const writable = this.getWritable();
    writable.__height = height;
    return this;
  }

  setAlign(align: ImageAlign): this {
    const writable = this.getWritable();
    writable.__align = align;
    return this;
  }

  setDisplay(display: ImageDisplay): this {
    const writable = this.getWritable();
    writable.__display = display;
    return this;
  }

  getTextContent(): string {
    return this.__alt ? `[image: ${this.__alt}]` : '[image]';
  }

  decorate(): null {
    return null;
  }

  isInline(): boolean {
    return this.getLatest().__display === 'inline';
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  isIsolated(): boolean {
    return this.getLatest().__display !== 'inline';
  }
}

export interface CreateImageNodeOptions {
  src: string;
  alt?: string;
  width?: number | 'inherit';
  height?: number | 'inherit';
  status?: ImageStatus;
  align?: ImageAlign;
  display?: ImageDisplay;
}

export function $createImageNode(options: CreateImageNodeOptions): ImageNode {
  const {
    src,
    alt = '',
    width = 'inherit',
    height = 'inherit',
    status = 'ready',
    align = 'left',
    display = 'block',
  } = options;
  return $applyNodeReplacement(
    new ImageNode(src, alt, width, height, status, align, display),
  );
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return !!node && node.getType() === 'image';
}
