import {
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import {
  $createBlockWrapperNode,
  $isBlockWrapperNode,
  BlockWrapperNode,
} from '../nodes/BlockWrapperNode';
import { $createSelectableParagraph, $safeSelectStart } from '../utils/selection';

/**
 * Ensure every direct child of root is a BlockWrapperNode.
 * Non-wrapped nodes are auto-wrapped; nested wrappers are flattened.
 */
export function $normalizeRootBlocks(): void {
  const root = $getRoot();
  const children = root.getChildren();

  for (const child of children) {
    if ($isBlockWrapperNode(child)) {
      const grand = child.getChildren();
      for (const g of grand) {
        if ($isBlockWrapperNode(g)) {
          const inner = g.getChildren();
          for (const n of inner) {
            g.insertBefore(n);
          }
          g.remove();
        }
      }
      if (child.getChildrenSize() === 0) {
        child.append($createSelectableParagraph());
      }
      continue;
    }

    const wrapper = $createBlockWrapperNode();
    child.replace(wrapper);
    wrapper.append(child);
  }

  if (root.getChildrenSize() === 0) {
    const wrapper = $createBlockWrapperNode();
    wrapper.append($createSelectableParagraph());
    root.append(wrapper);
  }
}

/**
 * Register transforms that keep root children as BlockWrapperNodes
 * and create a new block on Enter (Notion-style).
 */
export function registerBlockNormalizeTransform(editor: LexicalEditor): () => void {
  const unregNormalize = editor.registerUpdateListener(({ editorState, tags }) => {
    if (tags.has('history-merge') || tags.has('uni-normalize')) return;

    let needsNormalize = false;
    editorState.read(() => {
      const root = $getRoot();
      for (const child of root.getChildren()) {
        if (!$isBlockWrapperNode(child)) {
          needsNormalize = true;
          break;
        }
      }
      if (root.getChildrenSize() === 0) needsNormalize = true;
    });

    if (!needsNormalize) return;

    editor.update(
      () => {
        $normalizeRootBlocks();
      },
      { tag: 'uni-normalize' },
    );
  });

  // Enter at end of a plain paragraph block → insert a new paragraph block after it.
  const unregEnter = editor.registerCommand(
    INSERT_PARAGRAPH_COMMAND,
    () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

      const anchor = selection.anchor.getNode();
      if (!anchor.isAttached()) return false;

      const block = $getBlockWrapper(anchor);
      if (!block || !block.isAttached()) return false;

      const content = block.getFirstChild();
      if (!$isParagraphNode(content)) return false;

      const blockText = block.getTextContent();
      if (blockText.length > 0 && !$isAtBlockEnd(selection, block)) {
        return false;
      }

      // Empty plain paragraph: let Lexical handle (or stay)
      if (blockText.trim() === '') {
        return false;
      }

      // Clear selection before structural insert, then select the NEW paragraph's text
      $setSelection(null);
      const next = $insertParagraphBlockAfter(block);
      const para = next.getFirstChild();
      $safeSelectStart(para ?? next);
      return true;
    },
    COMMAND_PRIORITY_LOW,
  );

  return () => {
    unregNormalize();
    unregEnter();
  };
}

function $isAtBlockEnd(
  selection: ReturnType<typeof $getSelection> & object,
  block: BlockWrapperNode,
): boolean {
  if (!$isRangeSelection(selection)) return false;
  const focus = selection.focus.getNode();
  if ($isParagraphNode(focus) || focus.getType() === 'text') {
    // ok
  }
  const textSize =
    typeof (focus as { getTextContentSize?: () => number }).getTextContentSize === 'function'
      ? (focus as { getTextContentSize: () => number }).getTextContentSize()
      : focus.getTextContent().length;
  // For text nodes use offset; for elements use children size
  if (selection.focus.type === 'text') {
    if (selection.focus.offset !== textSize) return false;
  }
  let current: LexicalNode | null = focus;
  while (current && current !== block) {
    if (current.getNextSibling()) return false;
    current = current.getParent();
  }
  return current === block;
}

/** Get the enclosing BlockWrapperNode for a node, if any */
export function $getBlockWrapper(node: LexicalNode | null): BlockWrapperNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isBlockWrapperNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

/** Get the primary content node inside a block (first element child) */
export function $getBlockContent(block: BlockWrapperNode): LexicalNode | null {
  return block.getFirstChild();
}

/**
 * Replace the content node of a block while keeping the wrapper.
 */
export function $replaceBlockContent(
  block: BlockWrapperNode,
  newContent: LexicalNode,
): LexicalNode {
  // Snapshot first — getChildren() may be live in some Lexical versions
  for (const c of [...block.getChildren()]) {
    if (c.isAttached()) c.remove();
  }
  block.append(newContent);
  return newContent;
}

/**
 * Create a new empty paragraph block after the given block.
 */
export function $insertParagraphBlockAfter(block: BlockWrapperNode): BlockWrapperNode {
  const next = $createBlockWrapperNode();
  next.append($createSelectableParagraph());
  block.insertAfter(next);
  return next;
}

/**
 * Create a new empty paragraph block before the given block.
 */
export function $insertParagraphBlockBefore(block: BlockWrapperNode): BlockWrapperNode {
  const prev = $createBlockWrapperNode();
  prev.append($createSelectableParagraph());
  block.insertBefore(prev);
  return prev;
}

export function $isEmptyParagraph(node: LexicalNode): boolean {
  return $isParagraphNode(node) && node.getTextContent().trim() === '';
}

/**
 * Block is "empty" for plus-button purposes:
 * - no real text (ignore zwsp / nbsp / bare newlines)
 * - OR only a leftover slash query from a previous plus click (`/`, `/todo`, …)
 * Structural nodes (image / hr / table / attachment) are never empty.
 */
export function $isBlockEffectivelyEmpty(block: BlockWrapperNode): boolean {
  const content = block.getFirstChild();
  if (content) {
    const t = content.getType();
    if (
      t === 'image' ||
      t === 'horizontalrule' ||
      t === 'table' ||
      t === 'attachment' ||
      t === 'container'
    ) {
      return false;
    }
  }

  const text = block
    .getTextContent()
    .replace(/[\u200B\u00A0]/g, '')
    .replace(/\r/g, '')
    .trim();

  if (text === '') return true;
  // Reuse line if it only holds an open slash trigger (no real body text)
  if (/^\/[^\n]*$/.test(text)) return true;
  return false;
}

export function $findBlockById(blockId: string): BlockWrapperNode | null {
  const root = $getRoot();
  for (const child of root.getChildren()) {
    if ($isBlockWrapperNode(child) && child.getBlockId() === blockId) {
      return child;
    }
  }
  return null;
}

export function $getTopLevelBlocks(): BlockWrapperNode[] {
  const root = $getRoot();
  return root.getChildren().filter($isBlockWrapperNode);
}
