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

export type SerializedHorizontalRuleNode = Spread<
  { type: 'horizontalrule'; version: 1 },
  SerializedLexicalNode
>;

export class HorizontalRuleNode extends DecoratorNode<HTMLElement> {
  static getType(): string {
    return 'horizontalrule';
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = (config.theme as { hr?: string }).hr ?? 'uni-hr';
    return hr;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('hr') };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: (): DOMConversionOutput => ({ node: $createHorizontalRuleNode() }),
        priority: 0,
      }),
    };
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return { type: 'horizontalrule', version: 1 };
  }

  static importJSON(): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  decorate(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'uni-hr';
    return hr;
  }

  isInline(): false {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return $applyNodeReplacement(new HorizontalRuleNode());
}

export function $isHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is HorizontalRuleNode {
  return !!node && node.getType() === 'horizontalrule';
}
