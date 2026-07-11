import {
  $applyNodeReplacement,
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

export type SerializedContainerNode = Spread<
  { type: 'container'; version: 1 },
  SerializedElementNode
>;

/** Simple callout / container block for grouping content. */
export class ContainerNode extends ElementNode {
  static getType(): string {
    return 'container';
  }

  static clone(node: ContainerNode): ContainerNode {
    return new ContainerNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = (config.theme as { container?: string }).container ?? 'uni-container';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement('div');
    div.setAttribute('data-uni-container', 'true');
    return { element: div };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (dom) => {
        if (!dom.hasAttribute('data-uni-container')) return null;
        return {
          conversion: (): DOMConversionOutput => ({ node: $createContainerNode() }),
          priority: 1,
        };
      },
    };
  }

  exportJSON(): SerializedContainerNode {
    return { ...super.exportJSON(), type: 'container', version: 1 };
  }

  static importJSON(): ContainerNode {
    return $createContainerNode();
  }

  canBeEmpty(): boolean {
    return false;
  }
}

export function $createContainerNode(): ContainerNode {
  return $applyNodeReplacement(new ContainerNode());
}

export function $isContainerNode(
  node: LexicalNode | null | undefined,
): node is ContainerNode {
  return !!node && node.getType() === 'container';
}
