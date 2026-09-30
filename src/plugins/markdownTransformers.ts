import {
  $createParagraphNode,
  $createTextNode,
  ParagraphNode,
  type ElementNode,
  type LexicalNode,
} from 'lexical';
import {
  $createCodeNode,
  $isCodeNode,
  CodeNode,
} from '@lexical/code';
import {
  $convertFromMarkdownString,
  CODE,
  TRANSFORMERS,
  type MultilineElementTransformer,
  type Transformer,
} from '@lexical/markdown';
import {
  $createContainerNode,
  $isContainerNode,
  ContainerNode,
  type ContainerVariant,
} from '../nodes/ContainerNode';

export function parseContainerDirective(name?: string): {
  variant: ContainerVariant;
  icon: string;
} {
  const lower = (name || '').trim().toLowerCase();
  switch (lower) {
    case 'info':
    case 'note':
      return { variant: 'info', icon: 'info' };
    case 'tip':
      return { variant: 'success', icon: 'lightbulb' };
    case 'success':
      return { variant: 'success', icon: 'check_circle' };
    case 'warning':
    case 'caution':
      return { variant: 'warning', icon: 'warning' };
    case 'danger':
    case 'error':
      return { variant: 'error', icon: 'error' };
    case 'details':
      return { variant: 'default', icon: 'lightbulb' };
    default:
      return { variant: 'default', icon: 'lightbulb' };
  }
}

export function variantToDirective(variant: ContainerVariant): string {
  switch (variant) {
    case 'info':
      return 'info';
    case 'warning':
      return 'warning';
    case 'error':
      return 'danger';
    case 'success':
      return 'tip';
    default:
      return 'info';
  }
}

/**
 * Multiline Transformer for :::info, :::tip, :::warning, :::danger, etc.
 * Supports VitePress / VuePress / markdown-it custom containers.
 */
export const CONTAINER_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [ContainerNode, ParagraphNode],
  type: 'multiline-element',
  regExpStart: /^[ \t]*:::([a-zA-Z0-9_-]+)?(?:\s+(.*))?$/,
  regExpEnd: {
    optional: true,
    regExp: /^[ \t]*:::[ \t]*$/,
  },
  export: (node: LexicalNode, traverseChildren: (node: ElementNode) => string): string | null => {
    if (!$isContainerNode(node)) return null;
    const directive = variantToDirective(node.getVariant());
    const inner = traverseChildren(node);
    return `:::${directive}\n${inner}\n:::`;
  },
  replace: (
    rootNode: ElementNode,
    _children: LexicalNode[] | null,
    startMatch: string[],
    _endMatch: string[] | null,
    linesInBetween: string[] | null,
    _isImport: boolean,
  ) => {
    const rawType = startMatch[1] || 'info';
    const { variant, icon } = parseContainerDirective(rawType);
    const container = $createContainerNode({ variant, icon });
    rootNode.append(container);

    if (linesInBetween && linesInBetween.length > 0) {
      const lines = [...linesInBetween];
      if (lines.length > 0 && lines[0] === '') lines.shift();
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

      const innerContent = lines.join('\n').trim();
      if (innerContent) {
        $convertFromMarkdownString(innerContent, TRANSFORMERS, container);
      }
    }

    if (container.getChildrenSize() === 0) {
      container.append($createParagraphNode());
    }
  },
};

/**
 * Robust Code Transformer that fixes standard Lexical shortcomings:
 * 1. Safely captures fence info string with options/attributes like ```json [4] or ```ts {1-3}
 *    without leaking attributes into the code body.
 * 2. Properly handles optional closing fence and whitespace.
 */
export const CUSTOM_CODE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [CodeNode],
  type: 'multiline-element',
  regExpStart: /^[ \t]*(`{3,}|~{3,})([^\n`]*)$/,
  regExpEnd: {
    optional: true,
    regExp: /^[ \t]*(`{3,}|~{3,})[ \t]*$/,
  },
  export: (node: LexicalNode): string | null => {
    if (!$isCodeNode(node)) return null;
    const lang = node.getLanguage() || '';
    const text = node.getTextContent();
    return '```' + lang + (text ? '\n' + text : '') + '\n```';
  },
  replace: (
    rootNode: ElementNode,
    _children: LexicalNode[] | null,
    startMatch: string[],
    _endMatch: string[] | null,
    linesInBetween: string[] | null,
    _isImport: boolean,
  ) => {
    const info = (startMatch[2] || '').trim();
    // First token is language; any subsequent tokens (like "[4]" or "{1-3}") are attributes/metadata
    const [lang] = info.split(/\s+/);
    const codeNode = $createCodeNode(lang || undefined);

    let codeContent = '';
    if (linesInBetween && linesInBetween.length > 0) {
      const lines = [...linesInBetween];
      if (lines.length > 0 && lines[0] === '') {
        lines.shift();
      }
      while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      codeContent = lines.join('\n');
    }

    if (codeContent) {
      codeNode.append($createTextNode(codeContent));
    }
    rootNode.append(codeNode);
  },
};

/**
 * Standard UniLexical markdown transformers list, including container support
 * and hardened code fence parsing.
 */
export const UNI_TRANSFORMERS: Transformer[] = [
  CONTAINER_TRANSFORMER,
  CUSTOM_CODE_TRANSFORMER,
  ...TRANSFORMERS.filter((t) => t !== CODE),
];
