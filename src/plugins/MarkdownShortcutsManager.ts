import {
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_SPACE_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type RangeSelection,
  type TextNode,
  TextNode as TextNodeClass,
} from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
} from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { $safeSelectEnd } from '../utils/selection';

type BlockRule = {
  regex: RegExp;
  create: () => ElementNode;
  listType?: 'bullet' | 'number';
};

/** Match text before the space key (space not yet inserted) */
const BLOCK_RULES_BEFORE_SPACE: BlockRule[] = [
  { regex: /^#$/, create: () => $createHeadingNode('h1') },
  { regex: /^##$/, create: () => $createHeadingNode('h2') },
  { regex: /^###$/, create: () => $createHeadingNode('h3') },
  { regex: /^>$/, create: () => $createQuoteNode() },
  { regex: /^[-*]$/, create: () => $createListNode('bullet'), listType: 'bullet' },
  { regex: /^\d+\.$/, create: () => $createListNode('number'), listType: 'number' },
];

/** Match text that already includes trailing space */
const BLOCK_RULES_WITH_SPACE: BlockRule[] = [
  { regex: /^#\s$/, create: () => $createHeadingNode('h1') },
  { regex: /^##\s$/, create: () => $createHeadingNode('h2') },
  { regex: /^###\s$/, create: () => $createHeadingNode('h3') },
  { regex: /^>\s$/, create: () => $createQuoteNode() },
  { regex: /^[-*]\s$/, create: () => $createListNode('bullet'), listType: 'bullet' },
  { regex: /^\d+\.\s$/, create: () => $createListNode('number'), listType: 'number' },
  { regex: /^```$/, create: () => $createCodeNode() },
];

const INLINE_RULES: Array<{
  open: string;
  close: string;
  format: 'bold' | 'italic' | 'code' | 'strikethrough';
  minInner: number;
}> = [
  { open: '**', close: '**', format: 'bold', minInner: 1 },
  { open: '__', close: '__', format: 'bold', minInner: 1 },
  { open: '~~', close: '~~', format: 'strikethrough', minInner: 1 },
  { open: '*', close: '*', format: 'italic', minInner: 1 },
  { open: '_', close: '_', format: 'italic', minInner: 1 },
  { open: '`', close: '`', format: 'code', minInner: 1 },
];

function canConvertFrom(parent: ElementNode | null): boolean {
  if (!parent) return false;
  return (
    $isParagraphNode(parent) ||
    $isHeadingNode(parent) ||
    $isQuoteNode(parent) ||
    $isListItemNode(parent)
  );
}

function matchBlockRule(
  selection: RangeSelection,
  rules: BlockRule[],
): BlockRule | null {
  const anchor = selection.anchor;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return null;

  const parent = node.getParent();
  if (!canConvertFrom(parent)) return null;
  if (node.getPreviousSibling() !== null) return null;

  const prefix = node.getTextContent().slice(0, anchor.offset);
  for (const rule of rules) {
    if (rule.regex.test(prefix)) return rule;
  }
  return null;
}

/**
 * Convert a block-level markdown prefix into the target node type.
 * Selection-safe: never leaves caret on a node that is about to be removed.
 */
function applyBlockRule(selection: RangeSelection, rule: BlockRule): boolean {
  const anchor = selection.anchor;
  const node = anchor.getNode();
  if (!$isTextNode(node)) return false;

  const parent = node.getParent();
  if (!parent || !$isElementNode(parent)) return false;

  const offset = anchor.offset;
  const text = node.getTextContent();
  const remaining = text.slice(offset); // content after the trigger

  // Drop selection before we tear down the paragraph
  $setSelection(null);

  if (rule.listType) {
    const list = $createListNode(rule.listType);
    const item = $createListItemNode();
    // IMPORTANT: ListItemNode.append() unwraps Paragraph children into direct
    // text nodes. Select the ListItem (or its text leaf) AFTER replace — never
    // hold a reference to a temporary Paragraph that will be detached.
    const textNode = $createTextNode(remaining);
    item.append(textNode);
    list.append(item);

    parent.replace(list);
    // Caret at end of the list item text
    if (textNode.isAttached()) {
      const len = textNode.getTextContentSize();
      textNode.select(len, len);
    } else {
      $safeSelectEnd(item);
    }
    return true;
  }

  const newNode = rule.create();
  const textNode = $createTextNode(remaining);
  newNode.append(textNode);
  parent.replace(newNode);
  if (textNode.isAttached()) {
    const len = textNode.getTextContentSize();
    textNode.select(len, len);
  } else {
    $safeSelectEnd(newNode);
  }
  return true;
}

function tryInlineTransform(textNode: TextNode): boolean {
  const text = textNode.getTextContent();
  for (const rule of INLINE_RULES) {
    const closeLen = rule.close.length;
    if (!text.endsWith(rule.close)) continue;
    if ((rule.open === '*' || rule.open === '_') && text.endsWith(rule.open + rule.open)) {
      continue;
    }

    const beforeClose = text.slice(0, text.length - closeLen);
    let openIdx = -1;

    for (let i = beforeClose.length - rule.minInner; i >= 0; i--) {
      if (!beforeClose.startsWith(rule.open, i)) continue;
      const inner = beforeClose.slice(i + rule.open.length);
      if (inner.length < rule.minInner) continue;
      if (rule.open.length === 1) {
        if (beforeClose[i + 1] === rule.open) continue;
        if (i > 0 && beforeClose[i - 1] === rule.open) continue;
      }
      openIdx = i;
      break;
    }

    if (openIdx < 0) continue;

    const before = text.slice(0, openIdx);
    const inner = text.slice(openIdx + rule.open.length, text.length - closeLen);
    if (!inner.length) continue;
    if (!textNode.getParent()) return false;

    const nodes: TextNode[] = [];
    if (before) nodes.push($createTextNode(before));
    const formatted = $createTextNode(inner);
    formatted.toggleFormat(rule.format);
    nodes.push(formatted);

    let target = textNode;
    for (let i = 0; i < nodes.length; i++) {
      if (i === 0) {
        target.replace(nodes[0]);
        target = nodes[0];
      } else {
        target.insertAfter(nodes[i]);
        target = nodes[i];
      }
    }
    nodes[nodes.length - 1].selectEnd();
    return true;
  }
  return false;
}

/**
 * MarkdownShortcutsManager – block prefixes (#, >, -, 1.) and
 * inline delimiters (**bold**, *italic*, `code`, ~~strike~~).
 */
export class MarkdownShortcutsManager {
  private unregister: (() => void) | null = null;

  constructor(private editor: LexicalEditor) {}

  mount(): void {
    const unregText = this.editor.registerNodeTransform(TextNodeClass, (node) => {
      const t = node.getTextContent();
      if (
        t.endsWith('**') ||
        t.endsWith('__') ||
        t.endsWith('~~') ||
        t.endsWith('*') ||
        t.endsWith('_') ||
        t.endsWith('`')
      ) {
        tryInlineTransform(node);
      }
    });

    const unregSpace = this.editor.registerCommand(
      KEY_SPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const rule = matchBlockRule(selection, BLOCK_RULES_BEFORE_SPACE);
        if (!rule) return false;

        event?.preventDefault();
        try {
          const ok = applyBlockRule(selection, rule);
          if (!ok) {
            // Conversion failed — insert the space normally
            const sel = $getSelection();
            if ($isRangeSelection(sel)) sel.insertText(' ');
          }
        } catch (err) {
          console.error('[UniLexical] markdown block convert failed', err);
          $setSelection(null);
        }
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregUpdate = this.editor.registerUpdateListener(({ editorState, tags, dirtyLeaves }) => {
      if (tags.has('historic') || tags.has('uni-md-block')) return;
      if (dirtyLeaves.size === 0) return;

      let matched = false;
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
        matched = matchBlockRule(selection, BLOCK_RULES_WITH_SPACE) !== null;
      });
      if (!matched) return;

      queueMicrotask(() => {
        this.editor.update(
          () => {
            const sel = $getSelection();
            if (!$isRangeSelection(sel)) return;
            const rule = matchBlockRule(sel, BLOCK_RULES_WITH_SPACE);
            if (rule) {
              try {
                applyBlockRule(sel, rule);
              } catch (err) {
                console.error('[UniLexical] markdown block convert failed', err);
                $setSelection(null);
              }
            }
          },
          { tag: 'uni-md-block' },
        );
      });
    });

    this.unregister = () => {
      unregText();
      unregSpace();
      unregUpdate();
    };
  }

  destroy(): void {
    this.unregister?.();
    this.unregister = null;
  }
}
