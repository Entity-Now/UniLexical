import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  INSERT_PARAGRAPH_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  type ListItemNode,
} from '@lexical/list';
import { $isCodeNode } from '@lexical/code';
import { $createBlockWrapperNode } from '../nodes/BlockWrapperNode';
import { $isContainerNode, type ContainerNode } from '../nodes/ContainerNode';
import {
  $getBlockWrapper,
  $insertParagraphBlockAfter,
} from './blockTransform';
import { $createSelectableParagraph, $safeSelectStart } from '../utils/selection';

/** True when a node has no meaningful text. */
export function $isEffectivelyEmpty(node: LexicalNode | null | undefined): boolean {
  if (!node) return true;
  const t = node.getTextContent().replace(/[\u200B\u00A0]/g, '').trim();
  return t === '';
}

function $findListItem(node: LexicalNode | null): ListItemNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isListItemNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

function $createEmptyListItem(from?: ListItemNode): ListItemNode {
  const item = $createListItemNode();
  if (from?.getChecked()) item.setChecked(false);
  // ListItem unwraps Paragraph on append — put TextNode directly
  item.append($createTextNode(''));
  return item;
}

/**
 * Non-empty list item + Enter → new list item after (split at caret if needed).
 */
function $continueListItem(
  listItem: ListItemNode,
  selection: RangeSelection,
): boolean {
  if (!listItem.isAttached()) return false;

  if (!selection.isCollapsed()) {
    selection.removeText();
  }

  const sel = $getSelection();
  if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;

  const li = $findListItem(sel.anchor.getNode());
  if (!li?.isAttached()) return false;

  // ── Caret at end → blank new item ────────────────────────────────────
  if ($isAtEndOfNode(sel, li)) {
    const newItem = $createEmptyListItem(li);
    // Detach selection from current item before structural change
    $setSelection(null);
    li.insertAfter(newItem, false);
    $safeSelectStart(newItem);
    return true;
  }

  // ── Caret at start → blank item before ───────────────────────────────
  if ($isAtStartOfNode(sel, li)) {
    const newItem = $createEmptyListItem(li);
    $setSelection(null);
    li.insertBefore(newItem);
    $safeSelectStart(newItem);
    return true;
  }

  // ── Mid-item split (ListItem children are usually direct TextNodes) ─
  const anchor = sel.anchor;
  const anchorNode = anchor.getNode();
  const newItem = $createListItemNode();
  if (li.getChecked()) newItem.setChecked(false);

  if ($isTextNode(anchorNode) && anchor.type === 'text') {
    const offset = anchor.offset;
    const text = anchorNode.getTextContent();
    const nodesAfter: LexicalNode[] = [];

    if (offset < text.length) {
      const parts = anchorNode.splitText(offset);
      const right = parts[1];
      if (right) {
        nodesAfter.push(right);
        let sib = right.getNextSibling();
        while (sib) {
          const n = sib.getNextSibling();
          nodesAfter.push(sib);
          sib = n;
        }
      }
    } else {
      let sib = anchorNode.getNextSibling();
      while (sib) {
        const n = sib.getNextSibling();
        nodesAfter.push(sib);
        sib = n;
      }
    }

    if (nodesAfter.length === 0) {
      newItem.append($createTextNode(''));
    } else {
      for (const n of nodesAfter) newItem.append(n);
    }
  } else {
    newItem.append($createTextNode(''));
  }

  $setSelection(null);
  li.insertAfter(newItem, false);
  $safeSelectStart(newItem);
  return true;
}

function $isAtStartOfNode(selection: RangeSelection, node: LexicalNode): boolean {
  if (!selection.isCollapsed()) return false;
  const focus = selection.focus.getNode();

  if ($isTextNode(focus)) {
    if (selection.focus.offset !== 0) return false;
  } else if ($isElementNode(focus)) {
    if (selection.focus.offset !== 0) return false;
  } else {
    return false;
  }

  let current: LexicalNode | null = focus;
  while (current && current !== node) {
    if (current.getPreviousSibling()) return false;
    current = current.getParent();
  }
  return current === node;
}

/**
 * Empty list item + Enter → exit list mode.
 *
 * CRITICAL: never leave selection on a node that will be removed.
 */
function $exitEmptyListItem(listItem: ListItemNode): boolean {
  if (!listItem.isAttached()) return false;

  const parentList = listItem.getParent();
  if (!$isListNode(parentList)) return false;

  const block = $getBlockWrapper(parentList);
  const listType = parentList.getListType();

  // Collect & detach following items
  const nextItems: ListItemNode[] = [];
  let cur: LexicalNode | null = listItem.getNextSibling();
  while (cur) {
    const next = cur.getNextSibling();
    if ($isListItemNode(cur)) nextItems.push(cur);
    cur = next;
  }
  for (const item of nextItems) item.remove();

  const hasPrev = listItem.getPreviousSiblings().some($isListItemNode);
  const isOnlyItem = !hasPrev && nextItems.length === 0;

  // ── Only empty item: replace list content inside the block ───────────
  if (isOnlyItem) {
    // Drop selection BEFORE any remove()
    $setSelection(null);

    if (block && block.isAttached()) {
      // Remove list entirely, put a fresh paragraph in the same block
      if (parentList.isAttached()) parentList.remove();
      // Clear anything left
      for (const c of [...block.getChildren()]) c.remove();
      const paragraph = $createSelectableParagraph();
      block.append(paragraph);
      $safeSelectStart(paragraph);
      return true;
    }

    // No block wrapper
    const paragraph = $createSelectableParagraph();
    parentList.insertAfter(paragraph);
    $safeSelectStart(paragraph);
    if (listItem.isAttached()) listItem.remove();
    if (parentList.isAttached()) parentList.remove();
    $safeSelectStart(paragraph);
    return true;
  }

  // ── Has previous items: paragraph block after the list block ─────────
  $setSelection(null);
  if (listItem.isAttached()) listItem.remove();

  const paragraph = $createSelectableParagraph();

  if (block && block.isAttached()) {
    const paraBlock = $createBlockWrapperNode();
    paraBlock.append(paragraph);
    block.insertAfter(paraBlock);
    $safeSelectStart(paragraph);

    if (nextItems.length > 0) {
      const trailing = $createListNode(listType);
      for (const item of nextItems) trailing.append(item);
      const trailBlock = $createBlockWrapperNode();
      trailBlock.append(trailing);
      paraBlock.insertAfter(trailBlock);
    }
    return true;
  }

  if (parentList.isAttached()) {
    parentList.insertAfter(paragraph);
    $safeSelectStart(paragraph);
    if (nextItems.length > 0) {
      const trailing = $createListNode(listType);
      for (const item of nextItems) trailing.append(item);
      paragraph.insertAfter(trailing);
    }
    return true;
  }

  return false;
}

function $isAtEndOfNode(
  selection: ReturnType<typeof $getSelection>,
  node: LexicalNode,
): boolean {
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
  const focus = selection.focus.getNode();

  if ($isTextNode(focus)) {
    if (selection.focus.offset !== focus.getTextContentSize()) return false;
  } else if ($isElementNode(focus)) {
    if (selection.focus.offset !== focus.getChildrenSize()) return false;
  } else {
    return false;
  }

  let current: LexicalNode | null = focus;
  while (current && current !== node) {
    if (current.getNextSibling()) return false;
    current = current.getParent();
  }
  return current === node;
}

function $exitEmptySpecialBlock(content: ElementNode): boolean {
  $setSelection(null);
  const paragraph = $createSelectableParagraph();
  content.replace(paragraph);
  $safeSelectStart(paragraph);
  return true;
}

function $findContainer(node: LexicalNode | null): ContainerNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isContainerNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

/** Direct child element of the container that holds the selection. */
function $findContainerInnerChild(
  anchor: LexicalNode,
  container: ContainerNode,
): ElementNode | null {
  let current: LexicalNode | null = anchor;
  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (parent === container && $isElementNode(current)) {
      return current;
    }
    current = parent;
  }
  return null;
}

/**
 * Empty paragraph inside Container + Enter → exit the container (Notion callout).
 * - Only empty content → dissolve container into a plain paragraph
 * - Has prior content → drop empty line and insert a new block after the container
 */
function $exitEmptyContainer(
  container: ContainerNode,
  emptyChild: ElementNode,
): boolean {
  if (!container.isAttached() || !emptyChild.isAttached()) return false;

  $setSelection(null);

  const others = container
    .getChildren()
    .filter((c) => c.getKey() !== emptyChild.getKey());
  const hasOtherContent = others.some((c) => !$isEffectivelyEmpty(c));
  const block = $getBlockWrapper(container);

  if (!hasOtherContent) {
    // Dissolve container → plain paragraph in the same block
    if (block && block.isAttached()) {
      for (const c of [...block.getChildren()]) {
        if (c.isAttached()) c.remove();
      }
      const paragraph = $createSelectableParagraph();
      block.append(paragraph);
      $safeSelectStart(paragraph);
      return true;
    }
    const paragraph = $createSelectableParagraph();
    if (container.isAttached()) {
      container.replace(paragraph);
    }
    $safeSelectStart(paragraph);
    return true;
  }

  // Keep container content; leave below it
  if (emptyChild.isAttached()) emptyChild.remove();

  if (block && block.isAttached()) {
    const next = $insertParagraphBlockAfter(block);
    $safeSelectStart(next.getFirstChild() ?? next);
    return true;
  }

  const paragraph = $createSelectableParagraph();
  container.insertAfter(paragraph);
  $safeSelectStart(paragraph);
  return true;
}

/**
 * Notion-style empty-block exit + list continuation on Enter.
 */
export function registerEmptyBlockExit(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    INSERT_PARAGRAPH_COMMAND,
    () => {
      try {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchor = selection.anchor.getNode();
        if (!anchor.isAttached()) return false;

        // ── Lists ────────────────────────────────────────────────────────
        const listItem = $findListItem(anchor);
        if (listItem) {
          if (!listItem.isAttached()) return false;

          if ($isEffectivelyEmpty(listItem)) {
            return $exitEmptyListItem(listItem);
          }
          return $continueListItem(listItem, selection);
        }

        // ── Container (callout) ──────────────────────────────────────────
        // Enter on an empty line inside a container exits to a new block
        // outside — continuous empty Enters no longer stay trapped.
        const container = $findContainer(anchor);
        if (container && container.isAttached()) {
          const inner = $findContainerInnerChild(anchor, container);
          if (inner && $isEffectivelyEmpty(inner)) {
            return $exitEmptyContainer(container, inner);
          }
          // Non-empty: let Lexical create a new paragraph inside the container
          return false;
        }

        // ── Heading / Quote / Code ───────────────────────────────────────
        const block = $getBlockWrapper(anchor);
        if (!block || !block.isAttached()) return false;

        const content = block.getFirstChild();
        if (!$isElementNode(content)) return false;

        if ($isListNode(content) && $isEffectivelyEmpty(content)) {
          return $exitEmptySpecialBlock(content);
        }

        if ($isHeadingNode(content) || $isQuoteNode(content) || $isCodeNode(content)) {
          if ($isEffectivelyEmpty(content)) {
            return $exitEmptySpecialBlock(content);
          }
          if ($isAtEndOfNode(selection, content)) {
            $setSelection(null);
            const next = $insertParagraphBlockAfter(block);
            $safeSelectStart(next.getFirstChild() ?? next);
            return true;
          }
        }

        return false;
      } catch (err) {
        console.error('[UniLexical] EmptyBlockExit error', err);
        // Recover: clear broken selection so the editor stays usable
        try {
          $setSelection(null);
        } catch {
          /* ignore */
        }
        return true; // swallow — prevent other handlers from compounding the error
      }
    },
    COMMAND_PRIORITY_CRITICAL,
  );
}
