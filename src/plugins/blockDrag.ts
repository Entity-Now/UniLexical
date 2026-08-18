import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  type LexicalNode,
} from 'lexical';
import { $isListItemNode, $isListNode, type ListItemNode } from '@lexical/list';
import { $isTableNode } from '@lexical/table';
import {
  $isBlockWrapperNode,
  type BlockWrapperNode,
} from '../nodes/BlockWrapperNode';
import { $isContainerNode } from '../nodes/ContainerNode';
import { $isToggleNode } from '../nodes/ToggleNode';
import { $findBlockById, $getBlockWrapper } from './blockTransform';

export type DragUnitKind = 'block' | 'list-item' | 'inner';

export interface DragUnit {
  id: string;
  kind: DragUnitKind;
  key: string;
}

const NODE_PREFIX = 'nk:';

export function isNodeDragId(id: string): boolean {
  return id.startsWith(NODE_PREFIX);
}

export function makeNodeDragId(key: string): string {
  return `${NODE_PREFIX}${key}`;
}

/** List item whose only role is to host a nested list (no own text). */
export function $isNestedListWrapper(node: LexicalNode | null): boolean {
  return !!node && $isListItemNode(node) && $isListNode(node.getFirstChild());
}

/**
 * Nodes that must move together.
 * A real list item is followed by 0+ nested-list wrappers (Lexical indent
 * stores children as the next sibling, not as descendants).
 */
export function $getMoveGroup(node: LexicalNode): LexicalNode[] {
  const group: LexicalNode[] = [node];
  if (!$isListItemNode(node) || $isNestedListWrapper(node)) return group;
  let next = node.getNextSibling();
  while (next && $isNestedListWrapper(next)) {
    group.push(next);
    next = next.getNextSibling();
  }
  return group;
}

export function $findDragNode(id: string): LexicalNode | null {
  if (isNodeDragId(id)) {
    const node = $getNodeByKey(id.slice(NODE_PREFIX.length));
    return node?.isAttached() ? node : null;
  }
  const block = $findBlockById(id);
  return block?.isAttached() ? block : null;
}

/**
 * Resolve the drag unit under a DOM node.
 *
 * Special cases:
 * - Table is atomic (never a cell / inner paragraph).
 * - List items drag at their own indent level; nested items follow.
 * - Container / Toggle chrome drags the whole block; inner children
 *   only reorder among siblings inside that host.
 */
export function $resolveDragUnitFromDOM(dom: HTMLElement): DragUnit | null {
  const chrome = dom.closest(
    '[data-uni-chrome], .uni-container-icon, .uni-toggle-caret',
  );
  if (chrome instanceof HTMLElement) {
    const host = chrome.closest('[data-uni-container], [data-uni-toggle]');
    const node = host
      ? $getNearestNodeFromDOMNode(host)
      : $getNearestNodeFromDOMNode(dom);
    if (node) {
      const wrap = $getBlockWrapper(node);
      if (wrap) return $unitFromBlock(wrap);
    }
  }

  const tableEl = dom.closest('table');
  if (tableEl instanceof HTMLElement) {
    const tableNode = $getNearestNodeFromDOMNode(tableEl);
    const table = tableNode ? $findAncestor(tableNode, $isTableNode) : null;
    if (table) return $unitFromTable(table);
  }

  const liEl = closestRealListItem(dom);
  if (liEl) {
    const liNode = $getNearestNodeFromDOMNode(liEl);
    const item = liNode ? $findListItemUnit(liNode) : null;
    if (item) return $unitFromListItem(item);
  }

  const nestHost = dom.closest('[data-uni-container], [data-uni-toggle]');
  if (nestHost instanceof HTMLElement) {
    const hostNode = $getNearestNodeFromDOMNode(nestHost);
    if (hostNode && ($isContainerNode(hostNode) || $isToggleNode(hostNode))) {
      const innerNode = $getNearestNodeFromDOMNode(dom);
      const child = innerNode ? $directChildOf(innerNode, hostNode) : null;
      if (child && !($isToggleNode(hostNode) && child === hostNode.getFirstChild())) {
        return $unitFromInner(child);
      }
      const wrap = $getBlockWrapper(hostNode);
      if (wrap) return $unitFromBlock(wrap);
    }
  }

  const blockEl = dom.closest('[data-block-id]');
  if (blockEl instanceof HTMLElement) {
    const node = $getNearestNodeFromDOMNode(blockEl);
    const wrap = node ? $getBlockWrapper(node) : null;
    if (wrap) return $unitFromBlock(wrap);
  }

  const fallback = $getNearestNodeFromDOMNode(dom);
  if (!fallback) return null;
  const wrap = $getBlockWrapper(fallback);
  return wrap ? $unitFromBlock(wrap) : null;
}

function closestRealListItem(dom: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = dom.closest('li');
  while (el) {
    if (!el.classList.contains('uni-nested-li')) return el;
    const parent = el.parentElement;
    el = parent ? parent.closest('li') : null;
  }
  return null;
}

function $findListItemUnit(node: LexicalNode): ListItemNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isListItemNode(current)) {
      if ($isNestedListWrapper(current)) {
        current = current.getParent();
        continue;
      }
      return current;
    }
    current = current.getParent();
  }
  return null;
}

function $unitFromTable(table: LexicalNode): DragUnit {
  const wrap = $getBlockWrapper(table);
  if (wrap && wrap.getFirstChild() === table) return $unitFromBlock(wrap);
  return $unitFromInner(table);
}

function $unitFromBlock(block: BlockWrapperNode): DragUnit {
  return { id: block.getBlockId(), kind: 'block', key: block.getKey() };
}

function $unitFromListItem(item: ListItemNode): DragUnit {
  return { id: makeNodeDragId(item.getKey()), kind: 'list-item', key: item.getKey() };
}

function $unitFromInner(node: LexicalNode): DragUnit {
  return { id: makeNodeDragId(node.getKey()), kind: 'inner', key: node.getKey() };
}

function $findAncestor(
  node: LexicalNode,
  test: (n: LexicalNode) => boolean,
): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if (test(current)) return current;
    current = current.getParent();
  }
  return null;
}

function $directChildOf(node: LexicalNode, host: LexicalNode): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if (current.getParent() === host) return current;
    current = current.getParent();
  }
  return null;
}

/**
 * Walk from the hit node up to the first sibling that shares `drag`'s parent.
 * That is the only legal drop target (same level, same host).
 */
export function $resolveSameLevelTarget(
  drag: LexicalNode,
  hit: LexicalNode,
): LexicalNode | null {
  const parent = drag.getParent();
  if (!parent) return null;
  const group = $getMoveGroup(drag);
  const groupKeys = new Set(group.map((n) => n.getKey()));

  let current: LexicalNode | null = hit;
  while (current) {
    if (current.getParent() === parent && !groupKeys.has(current.getKey())) {
      if ($isNestedListWrapper(current) && !$isNestedListWrapper(drag)) {
        const prev = $previousRealListItem(current);
        if (prev && !groupKeys.has(prev.getKey()) && prev.getParent() === parent) {
          return prev;
        }
      }
      return current;
    }
    current = current.getParent();
  }
  return null;
}

function $previousRealListItem(node: LexicalNode): ListItemNode | null {
  let prev = node.getPreviousSibling();
  while (prev) {
    if ($isListItemNode(prev) && !$isNestedListWrapper(prev)) return prev;
    prev = prev.getPreviousSibling();
  }
  return null;
}

export function $moveDragGroup(
  drag: LexicalNode,
  target: LexicalNode,
  placeBefore: boolean,
): void {
  if (!drag.isAttached() || !target.isAttached()) return;
  if (!drag.getParent() || !target.getParent()) return;
  if (drag.getParent() !== target.getParent()) return;

  const group = $getMoveGroup(drag).filter((n) => n.isAttached() && n.getParent());
  if (group.length === 0) return;
  if (group.some((n) => n.getKey() === target.getKey())) return;

  if (placeBefore) {
    let cursor: LexicalNode = target;
    let first = true;
    for (const n of group) {
      if (!n.isAttached()) continue;
      if (first) {
        cursor.insertBefore(n);
        cursor = n;
        first = false;
      } else {
        cursor.insertAfter(n);
        cursor = n;
      }
    }
    return;
  }

  const targetGroup = $getMoveGroup(target).filter((n) => n.isAttached());
  let cursor = targetGroup[targetGroup.length - 1] ?? target;
  if (!cursor.isAttached() || !cursor.getParent()) return;
  for (const n of group) {
    if (!n.isAttached()) continue;
    cursor.insertAfter(n);
    cursor = n;
  }
}


