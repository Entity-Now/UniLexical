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

export type SerializedAttachmentNode = Spread<
  {
    src: string;
    name: string;
    size: number;
    type: 'attachment';
    version: 1;
  },
  SerializedLexicalNode
>;

export class AttachmentNode extends DecoratorNode<HTMLElement> {
  __src: string;
  __name: string;
  __size: number;

  static getType(): string {
    return 'attachment';
  }

  static clone(node: AttachmentNode): AttachmentNode {
    return new AttachmentNode(node.__src, node.__name, node.__size, node.__key);
  }

  constructor(src: string, name: string, size = 0, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__name = name;
    this.__size = size;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const el = document.createElement('a');
    el.className = (config.theme as { attachment?: string }).attachment ?? 'uni-attachment';
    el.href = this.__src;
    el.download = this.__name;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    el.contentEditable = 'false';
    el.textContent = `📎 ${this.__name}${this.__size ? ` (${formatSize(this.__size)})` : ''}`;
    return el;
  }

  updateDOM(prev: AttachmentNode, dom: HTMLElement): boolean {
    if (prev.__src !== this.__src) (dom as HTMLAnchorElement).href = this.__src;
    if (prev.__name !== this.__name || prev.__size !== this.__size) {
      dom.textContent = `📎 ${this.__name}${this.__size ? ` (${formatSize(this.__size)})` : ''}`;
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const a = document.createElement('a');
    a.className = 'uni-attachment';
    a.href = this.__src;
    a.download = this.__name;
    a.setAttribute('data-uni-attachment', 'true');
    a.textContent = this.__name;
    return { element: a };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (dom) => {
        if (!(dom instanceof HTMLAnchorElement) || !dom.hasAttribute('download')) return null;
        return {
          conversion: (el: HTMLElement): DOMConversionOutput => {
            const a = el as HTMLAnchorElement;
            return {
              node: $createAttachmentNode({
                src: a.href,
                name: a.download || a.textContent || 'file',
              }),
            };
          },
          priority: 2,
        };
      },
    };
  }

  exportJSON(): SerializedAttachmentNode {
    return {
      src: this.__src,
      name: this.__name,
      size: this.__size,
      type: 'attachment',
      version: 1,
    };
  }

  static importJSON(json: SerializedAttachmentNode): AttachmentNode {
    return $createAttachmentNode({
      src: json.src,
      name: json.name,
      size: json.size,
    });
  }

  decorate(): HTMLElement {
    return this.createDOM({ theme: {} } as EditorConfig);
  }

  isInline(): false {
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function $createAttachmentNode(opts: {
  src: string;
  name: string;
  size?: number;
}): AttachmentNode {
  return $applyNodeReplacement(new AttachmentNode(opts.src, opts.name, opts.size ?? 0));
}

export function $isAttachmentNode(
  node: LexicalNode | null | undefined,
): node is AttachmentNode {
  return !!node && node.getType() === 'attachment';
}
