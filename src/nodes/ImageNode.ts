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

export type SerializedImageNode = Spread<
  {
    src: string;
    alt: string;
    width: number | 'inherit';
    height: number | 'inherit';
    status: ImageStatus;
    type: 'image';
    version: 1;
  },
  SerializedLexicalNode
>;

/**
 * Image DecoratorNode — full DOM in createDOM/updateDOM for vanilla Lexical
 * (no React decorator reconciler required; decorate() returns null).
 */
export class ImageNode extends DecoratorNode<null> {
  __src: string;
  __alt: string;
  __width: number | 'inherit';
  __height: number | 'inherit';
  __status: ImageStatus;

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
      node.__key,
    );
  }

  constructor(
    src: string,
    alt = '',
    width: number | 'inherit' = 'inherit',
    height: number | 'inherit' = 'inherit',
    status: ImageStatus = 'ready',
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__width = width;
    this.__height = height;
    this.__status = status;
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
      prev.__status !== this.__status
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
    wrap.className = `uni-image-wrap ${theme.image ?? 'uni-image'}`.trim();
    wrap.contentEditable = 'false';
    wrap.setAttribute('data-uni-image', 'true');

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

    const img = document.createElement('img');
    img.src = this.__src;
    img.alt = this.__alt || 'image';
    img.draggable = false;
    img.className = 'uni-image-el';
    // data:/blob: should load immediately — lazy can delay/hide them
    if (!this.__src.startsWith('data:') && !this.__src.startsWith('blob:')) {
      img.loading = 'lazy';
    }
    img.decoding = 'async';
    if (this.__width !== 'inherit') {
      img.width = this.__width;
      img.style.width = `${this.__width}px`;
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
    wrap.appendChild(img);
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img');
    img.setAttribute('src', this.__src);
    img.setAttribute('alt', this.__alt);
    if (this.__width !== 'inherit') img.setAttribute('width', String(this.__width));
    if (this.__height !== 'inherit') img.setAttribute('height', String(this.__height));
    return { element: img };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (domNode: HTMLElement): DOMConversionOutput | null => {
          if (!(domNode instanceof HTMLImageElement)) return null;
          const { src, alt, width, height } = domNode;
          if (!src) return null;
          return {
            node: $createImageNode({
              src,
              alt,
              width: width || 'inherit',
              height: height || 'inherit',
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
      type: 'image',
      version: 1,
    };
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: json.src,
      alt: json.alt,
      width: json.width,
      height: json.height,
      status: json.status,
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

  getTextContent(): string {
    return this.__alt ? `[image: ${this.__alt}]` : '[image]';
  }

  /**
   * Vanilla Lexical has no React decorator host — createDOM owns the UI.
   */
  decorate(): null {
    return null;
  }

  isInline(): false {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  isIsolated(): boolean {
    return true;
  }
}

export interface CreateImageNodeOptions {
  src: string;
  alt?: string;
  width?: number | 'inherit';
  height?: number | 'inherit';
  status?: ImageStatus;
}

export function $createImageNode(options: CreateImageNodeOptions): ImageNode {
  const {
    src,
    alt = '',
    width = 'inherit',
    height = 'inherit',
    status = 'ready',
  } = options;
  return $applyNodeReplacement(new ImageNode(src, alt, width, height, status));
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return !!node && node.getType() === 'image';
}
