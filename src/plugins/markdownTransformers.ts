import {
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  $isDecoratorNode,
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
  TableNode,
  TableRowNode,
  TableCellNode,
  TableCellHeaderStates,
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
} from '@lexical/table';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CODE,
  TRANSFORMERS,
  type ElementTransformer,
  type MultilineElementTransformer,
  type TextMatchTransformer,
  type Transformer,
} from '@lexical/markdown';
import {
  $createContainerNode,
  $isContainerNode,
  ContainerNode,
  type ContainerVariant,
} from '../nodes/ContainerNode';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '../nodes/HorizontalRuleNode';
import {
  $createImageNode,
  $isImageNode,
  ImageNode,
} from '../nodes/ImageNode';
import {
  BlockWrapperNode,
  $isBlockWrapperNode,
} from '../nodes/BlockWrapperNode';

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
 * Text-level format and match transformers safe to run inside table cells
 * and inline text containers without triggering multiline/block transforms.
 */
export const INLINE_TRANSFORMERS: Transformer[] = TRANSFORMERS.filter(
  (t) => t.type === 'text-format' || t.type === 'text-match',
);

/**
 * Splits a markdown table row by unescaped pipe characters (|).
 * Correctly preserves escaped pipes (\|).
 */
export function splitTableRow(line: string): string[] {
  let content = line.trim();
  if (content.startsWith('|')) content = content.slice(1);
  if (content.endsWith('|')) content = content.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  let escaped = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (escaped) {
      if (char === '|') {
        current += '|';
      } else {
        current += '\\' + char;
      }
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (escaped) {
    current += '\\';
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Tests whether a line matches a GFM table delimiter row (e.g. `| --- | :---: | ---: |`).
 */
export function isTableDividerRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * Multiline Transformer for GFM Tables.
 * Parses markdown tables into TableNode -> TableRowNode -> TableCellNode,
 * and exports TableNode back to clean GFM markdown table syntax.
 */
export const TABLE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode, ParagraphNode],
  type: 'multiline-element',
  regExpStart: /^[ \t]*\|?.+\|.*$/,
  regExpEnd: {
    optional: true,
    regExp: /^[ \t]*$/,
  },
  replace: () => {},
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    // Table requires a valid delimiter row immediately following the header row
    if (startLineIndex + 1 >= lines.length) return null;
    const dividerLine = lines[startLineIndex + 1];
    if (!isTableDividerRow(dividerLine)) return null;

    const headerCells = splitTableRow(lines[startLineIndex]);
    const colCount = headerCells.length;
    if (colCount === 0) return null;

    let endLineIndex = startLineIndex + 1;
    while (endLineIndex + 1 < lines.length) {
      const nextLine = lines[endLineIndex + 1].trim();
      if (!nextLine || !nextLine.includes('|')) break;
      endLineIndex++;
    }

    const table = $createTableNode();
    for (let i = startLineIndex; i <= endLineIndex; i++) {
      if (i === startLineIndex + 1) continue; // Skip divider row
      const isHeader = i === startLineIndex;
      const row = $createTableRowNode();
      const rawCells = splitTableRow(lines[i]);
      for (let c = 0; c < colCount; c++) {
        const text = rawCells[c] || '';
        const cell = $createTableCellNode(
          isHeader ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS,
        );
        const p = $createParagraphNode();
        if (text) {
          $convertFromMarkdownString(text, INLINE_TRANSFORMERS, p);
        }
        if (p.getChildrenSize() === 0) {
          p.append($createTextNode(''));
        }
        cell.append(p);
        row.append(cell);
      }
      table.append(row);
    }

    rootNode.append(table);
    return [true, endLineIndex];
  },
  export: (node: LexicalNode): string | null => {
    if (!$isTableNode(node)) return null;
    const rows = node.getChildren();
    if (rows.length === 0) return null;

    const output: string[] = [];
    let maxCols = 0;
    const rowData: string[][] = [];

    for (const row of rows) {
      if (!$isTableRowNode(row)) continue;
      const cells = row.getChildren();
      maxCols = Math.max(maxCols, cells.length);
      const cellTexts: string[] = [];
      for (const cell of cells) {
        if (!$isTableCellNode(cell)) continue;
        const text = $convertToMarkdownString(INLINE_TRANSFORMERS, cell)
          .trim()
          .replace(/\n+/g, '<br>')
          .replace(/\|/g, '\\|');
        cellTexts.push(text);
      }
      rowData.push(cellTexts);
    }

    if (rowData.length === 0) return null;

    rowData.forEach((cells, rIdx) => {
      while (cells.length < maxCols) cells.push('');
      output.push('| ' + cells.join(' | ') + ' |');
      if (rIdx === 0) {
        output.push('| ' + Array(maxCols).fill('---').join(' | ') + ' |');
      }
    });

    return output.join('\n');
  },
};

/**
 * Horizontal Rule (Divider) Transformer.
 * Parses ---, ***, ___ into HorizontalRuleNode and exports back to ---.
 */
export const HR_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  type: 'element',
  regExp: /^(?:---|\*\*\*|___)\s*$/,
  replace: (parentNode) => {
    const hr = $createHorizontalRuleNode();
    parentNode.replace(hr);
  },
  export: (node: LexicalNode): string | null => {
    return $isHorizontalRuleNode(node) ? '---' : null;
  },
};

/**
 * Markdown Image Transformer.
 * Parses ![alt](src "title") into ImageNode and exports back to ![alt](src).
 */
export const IMAGE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ImageNode],
  type: 'text-match',
  importRegExp: /!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)/,
  regExp: /!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)$/,
  trigger: ')',
  replace: (textNode, match) => {
    const [, alt, src] = match;
    const imageNode = $createImageNode({ src, alt });
    textNode.replace(imageNode);
  },
  export: (node: LexicalNode): string | null => {
    if (!$isImageNode(node)) return null;
    return `![${node.getAlt()}](${node.getSrc()})`;
  },
};

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
        // Use full UNI_TRANSFORMERS so nested tables, images, code blocks work
        $convertFromMarkdownString(innerContent, UNI_TRANSFORMERS, container);
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
 * Transparent exporter for BlockWrapperNode.
 * Allows nested block elements (Table, Heading, Code, Quote, Container, etc.)
 * inside BlockWrapperNode to be exported to Markdown correctly.
 */
export const BLOCK_WRAPPER_TRANSFORMER: ElementTransformer = {
  dependencies: [BlockWrapperNode],
  type: 'element',
  regExp: /^[ \t]*$/,
  replace: () => {},
  export: (
    node: LexicalNode,
    exportChildren: (node: ElementNode) => string,
  ): string | null => {
    if (!$isBlockWrapperNode(node)) return null;
    const inner = node.getFirstChild();
    if (!inner) return '';

    // Search transformers for inner node
    for (const t of UNI_TRANSFORMERS) {
      if (t !== BLOCK_WRAPPER_TRANSFORMER && 'export' in t && typeof t.export === 'function') {
        const res = (t.export as (n: LexicalNode, fn: (n: ElementNode) => string) => string | null)(
          inner,
          exportChildren,
        );
        if (res !== null && res !== undefined) return res;
      }
    }

    if ($isElementNode(inner)) {
      return exportChildren(inner);
    }
    if ($isDecoratorNode(inner)) {
      return inner.getTextContent();
    }
    return null;
  },
};

/**
 * Standard UniLexical markdown transformers list, including:
 * - BlockWrapper transparent unwrapping
 * - Table support (GFM)
 * - Container support (:::info etc.)
 * - Hardened code fence parsing (```lang [options])
 * - Horizontal rule (---)
 * - Image support (![alt](src))
 * - Lexical standard inline & block transformers
 */
export const UNI_TRANSFORMERS: Transformer[] = [
  BLOCK_WRAPPER_TRANSFORMER,
  TABLE_TRANSFORMER,
  CONTAINER_TRANSFORMER,
  CUSTOM_CODE_TRANSFORMER,
  HR_TRANSFORMER,
  IMAGE_TRANSFORMER,
  ...TRANSFORMERS.filter((t) => t !== CODE),
];
