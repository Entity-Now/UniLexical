import {
  $applyNodeReplacement,
  $createParagraphNode,
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

export type SerializedBlockWrapperNode = Spread<
  { blockId: string; type: 'block-wrapper'; version: 1 },
  SerializedElementNode
>;

let blockIdCounter = 0;
function generateBlockId(): string {
  blockIdCounter += 1;
  return `block-${Date.now().toString(36)}-${blockIdCounter.toString(36)}`;
}

/**
 * Notion-style top-level block envelope.
 * Every top-level child under root is wrapped so drag/plus overlays can
 * target a stable [data-block-id] element.
 */
export class BlockWrapperNode extends ElementNode {
  __blockId: string;

  static getType(): string {
    return 'block-wrapper';
  }

  static clone(node: BlockWrapperNode): BlockWrapperNode {
    return new BlockWrapperNode(node.__blockId, node.__key);
  }

  constructor(blockId?: string, key?: NodeKey) {
    super(key);
    this.__blockId = blockId ?? generateBlockId();
  }

  getBlockId(): string {
    return this.__blockId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement('div');
    dom.classList.add(
      config.theme.blockWrapper ?? 'uni-block-wrapper',
      'uni-block-wrapper',
    );
    dom.setAttribute('data-block-id', this.__blockId);
    dom.setAttribute('data-lexical-block', 'true');
    return dom;
  }

  updateDOM(prev: BlockWrapperNode, dom: HTMLElement): boolean {
    if (prev.__blockId !== this.__blockId) {
      dom.setAttribute('data-block-id', this.__blockId);
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    // Structural wrapper is stripped on export – children render as siblings.
    // Use a fragment-like approach: export first meaningful child container.
    const element = document.createElement('div');
    element.setAttribute('data-uni-block', this.__blockId);
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-uni-block') && !domNode.hasAttribute('data-block-id')) {
          return null;
        }
        return {
          conversion: (node: HTMLElement): DOMConversionOutput => ({
            node: $createBlockWrapperNode(node.getAttribute('data-uni-block') ?? node.getAttribute('data-block-id') ?? undefined),
          }),
          priority: 1,
        };
      },
    };
  }

  exportJSON(): SerializedBlockWrapperNode {
    return {
      ...super.exportJSON(),
      blockId: this.__blockId,
      type: 'block-wrapper',
      version: 1,
    };
  }

  static importJSON(json: SerializedBlockWrapperNode): BlockWrapperNode {
    return $createBlockWrapperNode(json.blockId);
  }

  isShadowRoot(): boolean {
    // Allow nested element structure similar to root children
    return false;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  collapseAtStart(): boolean {
    // Convert empty block collapse into removing the wrapper if needed
    const children = this.getChildren();
    if (children.length === 1 && children[0].getType() === 'paragraph') {
      const p = children[0];
      if (p.getTextContentSize() === 0) {
        return false;
      }
    }
    return false;
  }

  extractWithChild(): boolean {
    return true;
  }
}

export function $createBlockWrapperNode(blockId?: string): BlockWrapperNode {
  return $applyNodeReplacement(new BlockWrapperNode(blockId));
}

export function $isBlockWrapperNode(
  node: LexicalNode | null | undefined,
): node is BlockWrapperNode {
  // Prefer getType() over instanceof so Vite HMR / dual-package copies stay correct
  return !!node && node.getType() === 'block-wrapper';
}

/** Ensure a block has at least one paragraph child */
export function $ensureBlockContent(block: BlockWrapperNode): void {
  if (block.getChildrenSize() === 0) {
    block.append($createParagraphNode());
  }
}
