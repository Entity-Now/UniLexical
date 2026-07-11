import {
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from 'lexical';

/**
 * Paragraph that always contains a TextNode so caret selection is stable.
 * Empty ElementNodes without text children often cause
 * "selection has been lost" after structural updates.
 */
export function $createSelectableParagraph(text = ''): ElementNode {
  const p = $createParagraphNode();
  p.append($createTextNode(text));
  return p;
}

/**
 * Place caret at the start of a node that is still attached.
 * Never selects BlockWrapper / empty elements without a text leaf.
 */
export function $safeSelectStart(node: LexicalNode | null | undefined): void {
  if (!node || !node.isAttached()) {
    $setSelection(null);
    return;
  }

  // Prefer an existing text leaf
  if ($isTextNode(node)) {
    node.select(0, 0);
    return;
  }

  if ($isElementNode(node)) {
    let leaf: LexicalNode | null = node.getFirstDescendant();
    // Walk to first text-ish leaf; if none, inject an empty text node
    if (!$isTextNode(leaf)) {
      // Find deepest element to append text into
      let host: ElementNode = node;
      let child = node.getFirstChild();
      while ($isElementNode(child)) {
        host = child;
        child = child.getFirstChild();
      }
      if (child === null || !$isTextNode(child)) {
        const t = $createTextNode('');
        host.append(t);
        t.select(0, 0);
        return;
      }
      leaf = child;
    }
    (leaf as TextNode).select(0, 0);
    return;
  }

  $setSelection(null);
}

/**
 * Place caret at the end of a node.
 */
export function $safeSelectEnd(node: LexicalNode | null | undefined): void {
  if (!node || !node.isAttached()) {
    $setSelection(null);
    return;
  }

  if ($isTextNode(node)) {
    const len = node.getTextContentSize();
    node.select(len, len);
    return;
  }

  if ($isElementNode(node)) {
    let leaf: LexicalNode | null = node.getLastDescendant();
    if (!$isTextNode(leaf)) {
      let host: ElementNode = node;
      let child = node.getLastChild();
      while ($isElementNode(child)) {
        host = child;
        child = child.getLastChild();
      }
      if (child === null || !$isTextNode(child)) {
        const t = $createTextNode('');
        host.append(t);
        t.select(0, 0);
        return;
      }
      leaf = child;
    }
    const t = leaf as TextNode;
    const len = t.getTextContentSize();
    t.select(len, len);
    return;
  }

  $setSelection(null);
}

