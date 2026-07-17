import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical';

export type SerializedToggleNode = Spread<
  { open: boolean; type: 'toggle'; version: 1 },
  SerializedElementNode
>;

/**
 * Notion-style collapsible toggle block.
 * Children are body content; the first child acts as the visible title line.
 * Closed state hides all children after the first via CSS / data-open.
 */
export class ToggleNode extends ElementNode {
  __open: boolean;

  static getType(): string {
    return 'toggle';
  }

  static clone(node: ToggleNode): ToggleNode {
    return new ToggleNode(node.__open, node.__key);
  }

  constructor(open = true, key?: NodeKey) {
    super(key);
    this.__open = open;
  }

  getOpen(): boolean {
    return this.getLatest().__open;
  }

  setOpen(open: boolean): this {
    const writable = this.getWritable();
    writable.__open = open;
    return this;
  }

  toggleOpen(): this {
    return this.setOpen(!this.getOpen());
  }

  createDOM(config: EditorConfig): HTMLElement {
    const theme = config.theme as { toggle?: string };
    const dom = document.createElement('div');
    dom.className = theme.toggle ?? 'uni-toggle';
    dom.setAttribute('data-uni-toggle', 'true');
    dom.setAttribute('data-open', this.__open ? 'true' : 'false');
    return dom;
  }

  updateDOM(prev: ToggleNode, dom: HTMLElement): boolean {
    if (prev.__open !== this.__open) {
      dom.setAttribute('data-open', this.__open ? 'true' : 'false');
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const el = document.createElement('div');
    el.className = 'uni-toggle';
    el.setAttribute('data-uni-toggle', 'true');
    el.setAttribute('data-open', this.__open ? 'true' : 'false');
    return { element: el };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (dom) => {
        if (!dom.hasAttribute('data-uni-toggle')) return null;
        const open = dom.getAttribute('data-open') !== 'false';
        return {
          conversion: (): DOMConversionOutput => ({
            node: $createToggleNode(open),
          }),
          priority: 2,
        };
      },
    };
  }

  exportJSON(): SerializedToggleNode {
    return {
      ...super.exportJSON(),
      open: this.__open,
      type: 'toggle',
      version: 1,
    };
  }

  static importJSON(json: SerializedToggleNode): ToggleNode {
    return $createToggleNode(json.open !== false);
  }

  canBeEmpty(): boolean {
    return false;
  }

  isShadowRoot(): boolean {
    return false;
  }
}

export function $createToggleNode(open = true): ToggleNode {
  return $applyNodeReplacement(new ToggleNode(open));
}

export function $isToggleNode(
  node: LexicalNode | null | undefined,
): node is ToggleNode {
  return !!node && node.getType() === 'toggle';
}

/** Create a toggle with an empty title paragraph (and optional body). */
export function $createToggleWithTitle(title = '', open = true): ToggleNode {
  const toggle = $createToggleNode(open);
  const titleP = $createParagraphNode();
  titleP.append($createTextNode(title));
  toggle.append(titleP);
  return toggle;
}
