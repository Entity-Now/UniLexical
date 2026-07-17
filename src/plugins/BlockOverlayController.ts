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
  $isListNode,
} from '@lexical/list';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import type { EventEmitter } from '../core/EventEmitter';
import type { BlockHoverPayload } from '../core/types';
import { $createBlockWrapperNode } from '../nodes/BlockWrapperNode';
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

    const blockEl = target.closest('[data-block-id]') as HTMLElement | null;
    if (!blockEl) return;

    const blockId = blockEl.getAttribute('data-block-id');
    if (!blockId) return;
    if (blockId === this.currentBlockId) {
      this.emitHover(blockId, blockEl);
      return;
    }

    this.setHoveredBlock(blockId, blockEl);
  }

  private setHoveredBlock(blockId: string, element: HTMLElement): void {
    // Toggle hover ring on the live block
    if (this.currentBlockId && this.currentBlockId !== blockId && this.rootEl) {
      this.rootEl
        .querySelector(`[data-block-id="${CSS.escape(this.currentBlockId)}"]`)
        ?.classList.remove('uni-block-hover');
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
      this.rootEl
        .querySelector(`[data-block-id="${CSS.escape(this.currentBlockId)}"]`)
        ?.classList.remove('uni-block-hover');
      // Belt-and-suspenders: clear any leftover hover rings
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

      const el = this.rootEl?.querySelector(
        `[data-block-id="${CSS.escape(blockId)}"]`,
      ) as HTMLElement | null;

      if (el) {
        // Mark source block (do NOT set opacity via setDragImage on live node —
        // browsers leave the element looking grey permanently in some cases).
        el.classList.add('uni-block-dragging');
        el.classList.remove('uni-block-hover');

        // Floating ghost for drag image
        this.removeDragGhost();
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.classList.remove('uni-block-dragging', 'uni-block-hover');
        ghost.classList.add('uni-block-drag-ghost');
        ghost.style.width = `${el.getBoundingClientRect().width}px`;
        ghost.removeAttribute('data-block-id');
        document.body.appendChild(ghost);
        this.dragGhost = ghost;
        try {
          event.dataTransfer.setDragImage(ghost, 24, 12);
        } catch {
          /* some browsers restrict setDragImage */
        }
        // Remove ghost after browser snapshots it
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
    const target = this.findBlockElementAtPoint(e.clientX, e.clientY);
    if (!target) {
      this.clearDropIndicator();
      return;
    }
    const blockId = target.getAttribute('data-block-id');
    if (!blockId || blockId === this.dragBlockId) {
      this.clearDropIndicator();
      return;
    }

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const placeBefore = e.clientY < midY;

    // Highlight drop target
    this.rootEl?.querySelectorAll('.uni-block-drop-target').forEach((el) => {
      el.classList.remove('uni-block-drop-target', 'uni-block-drop-before', 'uni-block-drop-after');
    });
    target.classList.add(
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
    ind.dataset.targetId = blockId;
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
      if (el.hasAttribute('data-block-id')) return el;
      const parent = el.closest('[data-block-id]');
      if (parent instanceof HTMLElement) return parent;
    }
    return null;
  }

  private handleDrop(e: DragEvent): void {
    const dragId = this.dragBlockId;
    if (!dragId) return;

    // Prefer indicator metadata (more reliable during drag)
    let targetId = this.dropIndicator?.dataset.targetId ?? null;
    let placeBefore = this.dropIndicator?.dataset.place === 'before';

    if (!targetId) {
      const targetEl = this.findBlockElementAtPoint(e.clientX, e.clientY);
      if (!targetEl) return;
      targetId = targetEl.getAttribute('data-block-id');
      if (!targetId) return;
      const rect = targetEl.getBoundingClientRect();
      placeBefore = e.clientY < rect.top + rect.height / 2;
    }

    if (!targetId || targetId === dragId) return;

    this.editor.update(() => {
      const dragNode = $findBlockById(dragId);
      const targetNode = $findBlockById(targetId!);
      if (!dragNode || !targetNode) return;
      if (dragNode === targetNode) return;
      if (!dragNode.getParent() || !targetNode.getParent()) return;

      // insertBefore/After require the node to still be in the tree; remove first carefully
      if (placeBefore) {
        targetNode.insertBefore(dragNode);
      } else {
        targetNode.insertAfter(dragNode);
      }
    });
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
        let block = $findBlockById(blockId);

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
      const block = $findBlockById(blockId);
      if (!block?.isAttached()) return;
      const kind = $detectBlockKind(block.getFirstChild());
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
      const block = $findBlockById(blockId);
      if (!block?.isAttached()) return;
      const content = block.getFirstChild();
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
      const block = $findBlockById(blockId);
      if (!block?.isAttached()) return;
      const root = $getRoot();
      const prev = block.getPreviousSibling();
      const next = block.getNextSibling();
      block.remove();
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
      const block = $findBlockById(blockId);
      if (!block?.isAttached()) return;
      $setSelection(null);
      // Rebuild from kind + text (keeps type; nested rich structure simplified)
      const kind = $detectBlockKind(block.getFirstChild());
      const text = block.getTextContent();
      const fresh = this.$createContentForKind(kind, text);
      const wrap = $createBlockWrapperNode();
      wrap.append(fresh);
      block.insertAfter(wrap);
      $safeSelectStart(wrap.getFirstChild() ?? wrap);
    });
  }

  insertRelative(blockId: string, where: 'before' | 'after'): void {
    this.editor.update(() => {
      const block = $findBlockById(blockId);
      if (!block?.isAttached()) return;
      $setSelection(null);
      const created =
        where === 'before'
          ? $insertParagraphBlockBefore(block)
          : $insertParagraphBlockAfter(block);
      $safeSelectStart(created.getFirstChild() ?? created);
    });
  }

  turnInto(blockId: string, kind: BlockContentKind): void {
    this.editor.update(
      () => {
        const block = $findBlockById(blockId);
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
      const block = $findBlockById(blockId);
      if (!block?.isAttached()) return;

      // Prefer Lexical $patchStyleText over a full-block selection
      const content = block.getFirstChild();
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
