import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  type HeadingTagType,
} from '@lexical/rich-text';
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
} from '@lexical/list';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import type { EventEmitter } from '../core/EventEmitter';
import type { BlockHoverPayload } from '../core/types';
import { $createBlockWrapperNode, $isBlockWrapperNode } from '../nodes/BlockWrapperNode';
import {
  $findDragNode,
  $getMoveGroup,
  $moveDragGroup,
  $resolveDragUnitFromDOM,
  $resolveSameLevelTarget,
} from './blockDrag';
import { $isContainerNode, $createContainerNode } from '../nodes/ContainerNode';
import { $isToggleNode, $createToggleWithTitle } from '../nodes/ToggleNode';
import { $isImageNode } from '../nodes/ImageNode';
import { $isHorizontalRuleNode } from '../nodes/HorizontalRuleNode';
import { $createSelectableParagraph, $safeSelectStart, $safeSelectEnd } from '../utils/selection';
import {
  $findBlockById,
  $getBlockWrapper,
  $insertParagraphBlockAfter,
  $insertParagraphBlockBefore,
  $isBlockEffectivelyEmpty,
} from './blockTransform';

/** Kind of content inside a top-level block wrapper */
export type BlockContentKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'code'
  | 'bullet'
  | 'number'
  | 'check'
  | 'container'
  | 'toggle'
  | 'image'
  | 'hr'
  | 'table'
  | 'unknown';

export interface BlockInfo {
  blockId: string;
  kind: BlockContentKind;
  label: string;
  /** Whether text-color actions apply */
  supportsTextColor: boolean;
  /** Whether "Turn into" applies */
  supportsTurnInto: boolean;
}

const KIND_LABELS: Record<BlockContentKind, string> = {
  paragraph: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  quote: 'Quote',
  code: 'Code',
  bullet: 'Bulleted list',
  number: 'Numbered list',
  check: 'To-do list',
  container: 'Callout',
  toggle: 'Toggle',
  image: 'Image',
  hr: 'Divider',
  table: 'Table',
  unknown: 'Block',
};

function $detectBlockKind(content: LexicalNode | null): BlockContentKind {
  if (!content) return 'paragraph';
  if ($isHeadingNode(content)) return content.getTag() as BlockContentKind;
  if ($isQuoteNode(content)) return 'quote';
  if ($isCodeNode(content)) return 'code';
  if ($isListNode(content)) {
    const t = content.getListType();
    return t === 'number' ? 'number' : t === 'check' ? 'check' : 'bullet';
  }
  if ($isContainerNode(content)) return 'container';
  if ($isToggleNode(content)) return 'toggle';
  if ($isImageNode(content)) return 'image';
  if ($isHorizontalRuleNode(content)) return 'hr';
  if (content.getType() === 'table') return 'table';
  if ($isParagraphNode(content)) return 'paragraph';
  return 'unknown';
}

/**
 * BlockOverlayController – hover detection, drag-and-drop reorder,
 * plus-button insertion. Emits `blockHoverChanged` for floating UI.
 */
export class BlockOverlayController {
  private cleanups: Array<() => void> = [];
  private currentBlockId: string | null = null;
  private dragBlockId: string | null = null;
  private rootEl: HTMLElement | null = null;
  private dropIndicator: HTMLElement | null = null;
  /** Clone used as drag image — never use the live block (avoids permanent grey look) */
  private dragGhost: HTMLElement | null = null;
  private editorDragging = false;

  constructor(
    private editor: LexicalEditor,
    private emitter: EventEmitter,
  ) {}

  mount(rootElement: HTMLElement): void {
    this.rootEl = rootElement;

    const onMove = (e: PointerEvent) => {
      this.handlePointerMove(e);
    };
    const onLeave = (e: PointerEvent) => {
      // If the pointer moved onto the floating overlay, do not clear hover
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest?.('.uni-block-overlay')) return;
      this.clearHover();
    };

    rootElement.addEventListener('pointermove', onMove);
    rootElement.addEventListener('pointerleave', onLeave);

    // Listen on document so drop works even when indicator covers the target
    const onDragOver = (e: DragEvent) => {
      if (!this.dragBlockId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      this.updateDropIndicator(e);
    };

    const onDrop = (e: DragEvent) => {
      if (!this.dragBlockId) return;
      e.preventDefault();
      this.handleDrop(e);
      // Always fully clean drag chrome (class + ghost), not only clear id
      this.finishDrag();
    };

    const onDragEnd = () => {
      this.finishDrag();
    };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragend', onDragEnd);

    this.cleanups.push(() => {
      rootElement.removeEventListener('pointermove', onMove);
      rootElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('dragend', onDragEnd);
    });
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.clearHover();
    this.finishDrag();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.editorDragging) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.uni-block-overlay')) return;

    let hit: { id: string; element: HTMLElement } | null = null;
    try {
      hit = this.resolveHoverUnit(target);
    } catch {
      return;
    }
    if (!hit) return;

    if (hit.id === this.currentBlockId) {
      this.emitHover(hit.id, hit.element);
      return;
    }

    this.setHoveredBlock(hit.id, hit.element);
  }

  /** Finest draggable unit under the pointer (list item / inner / top-level block). */
  private resolveHoverUnit(
    target: HTMLElement,
  ): { id: string; element: HTMLElement } | null {
    // $getNearestNodeFromDOMNode needs an active editor — editor.read(), not editorState.read()
    const unit = this.editor.read(() => {
      const resolved = $resolveDragUnitFromDOM(target);
      return resolved ? { id: resolved.id, key: resolved.key } : null;
    });
    if (!unit) return null;
    const el =
      this.editor.getElementByKey(unit.key) ??
      target.closest('li, [data-block-id], [data-uni-container], [data-uni-toggle], table');
    if (!(el instanceof HTMLElement)) return null;
    return { id: unit.id, element: el };
  }

  private setHoveredBlock(blockId: string, element: HTMLElement): void {
    if (this.rootEl) {
      this.rootEl.querySelectorAll('.uni-block-hover').forEach((el) => {
        if (el !== element) el.classList.remove('uni-block-hover');
      });
    }
    this.currentBlockId = blockId;
    element.classList.add('uni-block-hover');
    this.emitHover(blockId, element);
  }

  private emitHover(blockId: string, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const payload: BlockHoverPayload = { blockId, rect, element };
    this.emitter.emit('blockHoverChanged', payload);
  }

  private clearHover(): void {
    if (this.currentBlockId === null) return;
    if (this.rootEl) {
      this.rootEl.querySelectorAll('.uni-block-hover').forEach((el) => {
        el.classList.remove('uni-block-hover');
      });
    }
    this.currentBlockId = null;
    this.emitter.emit('blockHoverChanged', {
      blockId: null,
      rect: null,
      element: null,
    });
  }

  /** Called by UI when user starts dragging the handle */
  beginDrag(blockId: string, event: DragEvent): void {
    this.dragBlockId = blockId;
    this.editorDragging = true;
    this.rootEl?.classList.add('uni-editor-is-dragging');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', blockId);
      event.dataTransfer.setData('text/uni-block-id', blockId);

      const els = this.getDragGroupElements(blockId);

      if (els.length > 0) {
        // Mark source (do NOT setDragImage on a live node — some browsers
        // leave the original looking grey permanently).
        for (const el of els) {
          el.classList.add('uni-block-dragging');
          el.classList.remove('uni-block-hover');
        }

        this.removeDragGhost();
        const ghost = document.createElement('div');
        ghost.className = 'uni-block-drag-ghost';
        const width = Math.max(...els.map((el) => el.getBoundingClientRect().width));
        ghost.style.width = `${width}px`;
        for (const el of els) {
          const clone = el.cloneNode(true) as HTMLElement;
          clone.classList.remove('uni-block-dragging', 'uni-block-hover', 'uni-block-drop-target');
          clone.removeAttribute('data-block-id');
          ghost.appendChild(clone);
        }
        document.body.appendChild(ghost);
        this.dragGhost = ghost;
        try {
          event.dataTransfer.setDragImage(ghost, 24, 12);
        } catch {
          /* some browsers restrict setDragImage */
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.removeDragGhost());
        });
      }
    }
  }

  /** Always safe to call — cleans drag class even if dragBlockId was cleared early */
  endDrag(): void {
    this.finishDrag();
  }

  private finishDrag(): void {
    // Remove dragging class from ANY block (not only the remembered id)
    this.rootEl?.querySelectorAll('.uni-block-dragging').forEach((el) => {
      el.classList.remove('uni-block-dragging');
    });
    this.rootEl?.classList.remove('uni-editor-is-dragging');
    this.removeDragGhost();
    this.clearDropIndicator();
    this.dragBlockId = null;
    this.editorDragging = false;
  }

  private removeDragGhost(): void {
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    document.querySelectorAll('.uni-block-drag-ghost').forEach((el) => el.remove());
  }

  private updateDropIndicator(e: DragEvent): void {
    const hit = this.resolveDropAtPoint(e.clientX, e.clientY);
    if (!hit) {
      this.clearDropIndicator();
      return;
    }

    const rect = hit.element.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const placeBefore = e.clientY < midY;

    this.rootEl?.querySelectorAll('.uni-block-drop-target').forEach((el) => {
      el.classList.remove('uni-block-drop-target', 'uni-block-drop-before', 'uni-block-drop-after');
    });
    hit.element.classList.add(
      'uni-block-drop-target',
      placeBefore ? 'uni-block-drop-before' : 'uni-block-drop-after',
    );

    if (!this.dropIndicator) {
      this.dropIndicator = document.createElement('div');
      this.dropIndicator.className = 'uni-drop-indicator';
      document.body.appendChild(this.dropIndicator);
    }
    const ind = this.dropIndicator;
    ind.style.display = 'block';
    ind.style.position = 'fixed';
    ind.style.left = `${rect.left}px`;
    ind.style.width = `${rect.width}px`;
    ind.style.top = `${placeBefore ? rect.top - 1 : rect.bottom - 1}px`;
    ind.dataset.place = placeBefore ? 'before' : 'after';
    ind.dataset.targetId = hit.id;
  }

  /**
   * Same-level drop only: a level-1 unit cannot land between level-2 siblings,
   * and a nested item cannot escape its parent list / container.
   */
  private resolveDropAtPoint(
    x: number,
    y: number,
  ): { id: string; element: HTMLElement } | null {
    const dragId = this.dragBlockId;
    if (!dragId) return null;

    const rawEl = this.findBlockElementAtPoint(x, y);
    if (!rawEl) return null;

    const result = this.editor.read(() => {
      const dragNode = $findDragNode(dragId);
      if (!dragNode) return null;
      const hitUnit = $resolveDragUnitFromDOM(rawEl);
      if (!hitUnit) return null;
      const hitNode = $findDragNode(hitUnit.id);
      if (!hitNode) return null;
      const target = $resolveSameLevelTarget(dragNode, hitNode);
      if (!target) return null;
      return $isBlockWrapperNode(target)
        ? { id: target.getBlockId(), key: target.getKey() }
        : { id: `nk:${target.getKey()}`, key: target.getKey() };
    });
    if (!result) return null;
    const el = this.editor.getElementByKey(result.key);
    if (!(el instanceof HTMLElement)) return null;
    return { id: result.id, element: el };
  }

  private clearDropIndicator(): void {
    if (this.dropIndicator) {
      this.dropIndicator.remove();
      this.dropIndicator = null;
    }
    this.rootEl?.querySelectorAll('.uni-block-drop-target').forEach((el) => {
      el.classList.remove('uni-block-drop-target', 'uni-block-drop-before', 'uni-block-drop-after');
    });
  }

  private findBlockElementAtPoint(x: number, y: number): HTMLElement | null {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.classList.contains('uni-drop-indicator')) continue;
      if (el.classList.contains('uni-block-overlay')) continue;
      if (el.closest('.uni-block-overlay, .uni-drop-indicator')) continue;
      // Prefer the raw hit so list items / container children resolve at their level
      if (this.rootEl?.contains(el)) return el;
    }
    return null;
  }

  private handleDrop(e: DragEvent): void {
    const dragId = this.dragBlockId;
    if (!dragId) return;

    let targetId = this.dropIndicator?.dataset.targetId ?? null;
    let placeBefore = this.dropIndicator?.dataset.place === 'before';

    if (!targetId) {
      const hit = this.resolveDropAtPoint(e.clientX, e.clientY);
      if (!hit) return;
      targetId = hit.id;
      const rect = hit.element.getBoundingClientRect();
      placeBefore = e.clientY < rect.top + rect.height / 2;
    }

    if (!targetId || targetId === dragId) return;

    this.editor.update(() => {
      const dragNode = $findDragNode(dragId);
      const targetNode = $findDragNode(targetId!);
      if (!dragNode || !targetNode) return;
      if (dragNode.getKey() === targetNode.getKey()) return;
      $moveDragGroup(dragNode, targetNode, placeBefore);
    });
  }

  private getDragGroupElements(id: string): HTMLElement[] {
    const keys: string[] = [];
    this.editor.read(() => {
      const node = $findDragNode(id);
      if (!node) return;
      for (const n of $getMoveGroup(node)) keys.push(n.getKey());
    });
    const els: HTMLElement[] = [];
    for (const key of keys) {
      const el = this.editor.getElementByKey(key);
      if (el instanceof HTMLElement) els.push(el);
    }
    return els;
  }

  /**
   * Plus button:
   * - empty / slash-only block → reuse it (no extra line), place caret
   * - non-empty → insert a new empty block after, place caret there
   * Invokes `onReady` after the update commits so slash can open reliably.
   */
  handlePlusClick(blockId: string, onReady?: () => void): void {
    this.editor.update(
      () => {
        const unit = $findDragNode(blockId);

        if ($isListItemNode(unit) && unit.isAttached()) {
          const group = $getMoveGroup(unit);
          const last = group[group.length - 1] ?? unit;
          const item = $createListItemNode();
          item.append($createTextNode(''));
          last.insertAfter(item);
          $safeSelectStart(item);
          return;
        }

        if (unit && !$isBlockWrapperNode(unit) && unit.isAttached()) {
          const p = $createSelectableParagraph();
          unit.insertAfter(p);
          $safeSelectStart(p);
          return;
        }

        let block = $isBlockWrapperNode(unit) ? unit : $findBlockById(blockId);

        // Fallback: use current selection's block (never invent a trailing line)
        if (!block || !block.isAttached()) {
          const sel = $getSelection();
          if ($isRangeSelection(sel)) {
            block = $getBlockWrapper(sel.anchor.getNode());
          }
        }

        if (!block || !block.isAttached()) {
          // Last resort: focus last root block; only create one if the doc is empty
          const root = $getRoot();
          const last = root.getLastChild();
          const wrap = last ? $getBlockWrapper(last) : null;
          if (wrap && wrap.isAttached()) {
            $safeSelectStart(wrap.getFirstChild() ?? wrap);
            return;
          }
          const w = $createBlockWrapperNode();
          w.append($createSelectableParagraph());
          root.append(w);
          $safeSelectStart(w.getFirstChild() ?? w);
          return;
        }

        if ($isBlockEffectivelyEmpty(block)) {
          // Empty (or only leftover `/query`) → do NOT insert a new line
          $safeSelectStart(block.getFirstChild() ?? block);
          return;
        }

        // Has content → insert a fresh empty block after for the slash menu
        const next = $insertParagraphBlockAfter(block);
        $safeSelectStart(next.getFirstChild() ?? next);
      },
      {
        onUpdate: () => {
          onReady?.();
        },
      },
    );
  }

  /** @deprecated use handlePlusClick */
  insertBlockAfter(blockId: string): void {
    this.handlePlusClick(blockId);
  }

  insertBlockBefore(blockId: string): void {
    this.editor.update(() => {
      const block = $findBlockById(blockId);
      if (!block || !block.isAttached()) return;
      const prev = $insertParagraphBlockBefore(block);
      prev.selectEnd();
    });
  }

  getCurrentBlockId(): string | null {
    return this.currentBlockId;
  }

  // ─── Block more-menu actions ─────────────────────────────────────────

  getBlockInfo(blockId: string): BlockInfo | null {
    let info: BlockInfo | null = null;
    this.editor.getEditorState().read(() => {
      const node = $findDragNode(blockId);
      if (!node?.isAttached()) return;

      if ($isListItemNode(node)) {
        const list = node.getParent();
        const t = $isListNode(list) ? list.getListType() : 'bullet';
        const kind: BlockContentKind =
          t === 'number' ? 'number' : t === 'check' ? 'check' : 'bullet';
        info = {
          blockId,
          kind,
          label: KIND_LABELS[kind],
          supportsTextColor: true,
          supportsTurnInto: false,
        };
        return;
      }

      if (!$isBlockWrapperNode(node)) {
        const kind = $detectBlockKind(node);
        info = {
          blockId,
          kind,
          label: KIND_LABELS[kind],
          supportsTextColor: !['image', 'hr', 'table'].includes(kind),
          supportsTurnInto: false,
        };
        return;
      }

      const kind = $detectBlockKind(node.getFirstChild());
      info = {
        blockId,
        kind,
        label: KIND_LABELS[kind],
        supportsTextColor: !['image', 'hr', 'table'].includes(kind),
        supportsTurnInto: !['image', 'hr', 'table'].includes(kind),
      };
    });
    return info;
  }

  /** Select entire block content (for color apply etc.) */
  selectBlock(blockId: string): void {
    this.editor.update(() => {
      const node = $findDragNode(blockId);
      if (!node?.isAttached()) return;
      const content = $isBlockWrapperNode(node) ? node.getFirstChild() : node;
      if (!content) return;
      try {
        if ($isElementNode(content)) {
          content.select(0, content.getChildrenSize());
        } else {
          content.selectStart();
        }
      } catch {
        $safeSelectStart(content);
      }
    });
  }

  deleteBlock(blockId: string): void {
    this.editor.update(() => {
      $setSelection(null);
      const node = $findDragNode(blockId);
      if (!node?.isAttached()) return;

      if (!$isBlockWrapperNode(node)) {
        const group = $getMoveGroup(node);
        const parent = node.getParent();
        const prev = group[0]?.getPreviousSibling() ?? null;
        const last = group[group.length - 1];
        const next = last?.getNextSibling() ?? null;
        for (const n of group) {
          if (n.isAttached()) n.remove();
        }
        if ($isListNode(parent) && parent.isAttached() && parent.getChildrenSize() === 0) {
          const wrap = $getBlockWrapper(parent);
          parent.remove();
          if (wrap?.isAttached() && wrap.getChildrenSize() === 0) {
            wrap.append($createSelectableParagraph());
            $safeSelectStart(wrap.getFirstChild() ?? wrap);
            return;
          }
        }
        const focus = next ?? prev;
        if (focus) $safeSelectStart(focus);
        return;
      }

      const root = $getRoot();
      const prev = node.getPreviousSibling();
      const next = node.getNextSibling();
      node.remove();
      // Keep at least one block
      if (root.getChildrenSize() === 0) {
        const w = $createBlockWrapperNode();
        w.append($createSelectableParagraph());
        root.append(w);
        $safeSelectStart(w.getFirstChild() ?? w);
        return;
      }
      const focus = next ?? prev;
      if (focus && $getBlockWrapper(focus)) {
        const wrap = $getBlockWrapper(focus)!;
        $safeSelectStart(wrap.getFirstChild() ?? wrap);
      } else if (focus) {
        $safeSelectStart(focus);
      }
    });
  }

  duplicateBlock(blockId: string): void {
    this.editor.update(() => {
      const node = $findDragNode(blockId);
      if (!node?.isAttached()) return;
      $setSelection(null);

      if ($isListItemNode(node)) {
        const item = $createListItemNode(node.getChecked() ?? undefined);
        item.append($createTextNode(node.getTextContent()));
        const group = $getMoveGroup(node);
        const last = group[group.length - 1] ?? node;
        last.insertAfter(item);
        $safeSelectStart(item);
        return;
      }

      if (!$isBlockWrapperNode(node)) {
        const kind = $detectBlockKind(node);
        const fresh = this.$createContentForKind(kind, node.getTextContent());
        node.insertAfter(fresh);
        $safeSelectStart(fresh);
        return;
      }

      // Rebuild from kind + text (keeps type; nested rich structure simplified)
      const kind = $detectBlockKind(node.getFirstChild());
      const text = node.getTextContent();
      const fresh = this.$createContentForKind(kind, text);
      const wrap = $createBlockWrapperNode();
      wrap.append(fresh);
      node.insertAfter(wrap);
      $safeSelectStart(wrap.getFirstChild() ?? wrap);
    });
  }

  insertRelative(blockId: string, where: 'before' | 'after'): void {
    this.editor.update(() => {
      const node = $findDragNode(blockId);
      if (!node?.isAttached()) return;
      $setSelection(null);

      if ($isListItemNode(node)) {
        const item = $createListItemNode();
        item.append($createTextNode(''));
        if (where === 'before') {
          node.insertBefore(item);
        } else {
          const group = $getMoveGroup(node);
          const last = group[group.length - 1] ?? node;
          last.insertAfter(item);
        }
        $safeSelectStart(item);
        return;
      }

      if (!$isBlockWrapperNode(node)) {
        const p = $createSelectableParagraph();
        if (where === 'before') node.insertBefore(p);
        else node.insertAfter(p);
        $safeSelectStart(p);
        return;
      }

      const created =
        where === 'before'
          ? $insertParagraphBlockBefore(node)
          : $insertParagraphBlockAfter(node);
      $safeSelectStart(created.getFirstChild() ?? created);
    });
  }

  turnInto(blockId: string, kind: BlockContentKind): void {
    this.editor.update(
      () => {
        const found = $findDragNode(blockId);
        const block = $isBlockWrapperNode(found) ? found : $findBlockById(blockId);
        if (!block?.isAttached()) return;
        const text = block.getTextContent();
        $setSelection(null);
        const content = this.$createContentForKind(kind, text);
        // Prefer atomic replace of the primary content node (safer than empty-then-append)
        const existing = block.getFirstChild();
        if (existing) {
          existing.replace(content);
          // Remove any extra siblings left in the wrapper
          for (const c of [...block.getChildren()]) {
            if (c !== content && c.isAttached()) c.remove();
          }
        } else {
          block.append(content);
        }
        $safeSelectEnd(content);
      },
      { tag: 'uni-block-turn-into', discrete: true },
    );
  }

  /**
   * Apply color to all text leaves inside the block.
   */
  applyBlockTextColor(blockId: string, color: string): void {
    this.editor.focus();
    this.editor.update(() => {
      const node = $findDragNode(blockId);
      if (!node?.isAttached()) return;
      const block = $isBlockWrapperNode(node) ? node : node;

      // Prefer Lexical $patchStyleText over a full-block selection
      const content = $isBlockWrapperNode(block) ? block.getFirstChild() : block;
      if ($isElementNode(content)) {
        try {
          content.select(0, content.getChildrenSize());
        } catch {
          // Fall through to leaf walk
        }
      }

      let selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        $patchStyleText(selection, { color: color || null });
        return;
      }

      // Fallback: set style on every text leaf
      const walk = (node: LexicalNode) => {
        if ($isTextNode(node)) {
          const w = node.getWritable();
          const prev = w.getStyle() || '';
          const parts = prev
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((s) => !s.startsWith('color:'));
          if (color) parts.push(`color: ${color}`);
          w.setStyle(parts.join('; '));
        } else if ($isElementNode(node)) {
          node.getChildren().forEach(walk);
        }
      };
      walk(block);
    });
  }

  private $createContentForKind(kind: BlockContentKind, text: string): LexicalNode {
    const makeText = () => $createTextNode(text);

    switch (kind) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const h = $createHeadingNode(kind as HeadingTagType);
        if (text) h.append(makeText());
        return h;
      }
      case 'quote': {
        const q = $createQuoteNode();
        if (text) q.append(makeText());
        else q.append($createTextNode(''));
        return q;
      }
      case 'code': {
        const c = $createCodeNode();
        if (text) c.append(makeText());
        else c.append($createTextNode(''));
        return c;
      }
      case 'bullet':
      case 'number':
      case 'check': {
        const listType =
          kind === 'number' ? 'number' : kind === 'check' ? 'check' : 'bullet';
        const list = $createListNode(listType);
        const item =
          kind === 'check' ? $createListItemNode(false) : $createListItemNode();
        item.append($createTextNode(text || ''));
        if (kind === 'check') item.setChecked(false);
        list.append(item);
        return list;
      }
      case 'container': {
        const container = $createContainerNode();
        const p = $createParagraphNode();
        p.append($createTextNode(text || ''));
        container.append(p);
        return container;
      }
      case 'toggle': {
        return $createToggleWithTitle(text || '', true);
      }
      case 'paragraph':
      default: {
        const p = $createParagraphNode();
        p.append($createTextNode(text || ''));
        return p;
      }
    }
  }
}
