import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type LexicalEditor,
  type TextFormatType,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
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
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from '@lexical/selection';
import { $createTableNodeWithDimensions, $isTableNode } from '@lexical/table';
import type { EventEmitter } from '../core/EventEmitter';
import type { ToolbarItemId, ToolbarState } from '../core/types';
import { normalizeToolbarItemId } from '../core/types';
import { $isImageNode } from '../nodes/ImageNode';
import { $createHorizontalRuleNode } from '../nodes/HorizontalRuleNode';
import { $createContainerNode } from '../nodes/ContainerNode';
import { $createBlockWrapperNode } from '../nodes/BlockWrapperNode';
import { $getBlockWrapper } from './blockTransform';

const EMPTY_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  highlight: false,
  subscript: false,
  superscript: false,
  link: false,
  blockType: 'paragraph',
  elementFormat: '',
  fontSize: '',
  fontFamily: '',
  fontColor: '',
  backgroundColor: '',
  lineHeight: '',
  canUndo: false,
  canRedo: false,
  isEmpty: true,
  isFullscreen: false,
  isSourceMode: false,
  painterActive: false,
};

type PainterSnapshot = {
  formats: TextFormatType[];
  styles: Record<string, string>;
};

/**
 * ToolbarController – state emitter + command dispatch for all toolbar items.
 */
export class ToolbarController {
  private state: ToolbarState = { ...EMPTY_STATE };
  private cleanups: Array<() => void> = [];
  private items: ToolbarItemId[];
  private onImageRequest: (() => void) | null = null;
  private onAttachmentRequest: (() => void) | null = null;
  private onCustomAction: (() => void) | null = null;
  private onTablePickRequest: (() => void) | null = null;
  private onEmojiRequest: (() => void) | null = null;
  private onColorRequest: ((kind: 'color' | 'bg') => void) | null = null;
  private onFontSizeRequest: (() => void) | null = null;
  private onFontFamilyRequest: (() => void) | null = null;
  private onLineHeightRequest: (() => void) | null = null;
  private onHeadingMenuRequest: (() => void) | null = null;
  private onAlignMenuRequest: (() => void) | null = null;
  private onFullscreenToggle: (() => void) | null = null;
  private onSourceToggle: (() => void) | null = null;
  private painter: PainterSnapshot | null = null;

  constructor(
    private editor: LexicalEditor,
    private emitter: EventEmitter,
    items: ToolbarItemId[],
  ) {
    this.items = items.map(normalizeToolbarItemId);
  }

  getItems(): ToolbarItemId[] {
    return this.items;
  }

  setItems(items: ToolbarItemId[]): void {
    this.items = items.map(normalizeToolbarItemId);
  }

  getState(): ToolbarState {
    return this.state;
  }

  setImageRequestHandler(handler: () => void): void {
    this.onImageRequest = handler;
  }
  setAttachmentRequestHandler(handler: () => void): void {
    this.onAttachmentRequest = handler;
  }
  setCustomActionHandler(handler: () => void): void {
    this.onCustomAction = handler;
  }
  setTablePickHandler(handler: () => void): void {
    this.onTablePickRequest = handler;
  }
  setEmojiRequestHandler(handler: () => void): void {
    this.onEmojiRequest = handler;
  }
  setColorRequestHandler(handler: (kind: 'color' | 'bg') => void): void {
    this.onColorRequest = handler;
  }
  setFontSizeRequestHandler(handler: () => void): void {
    this.onFontSizeRequest = handler;
  }
  setFontFamilyRequestHandler(handler: () => void): void {
    this.onFontFamilyRequest = handler;
  }
  setLineHeightRequestHandler(handler: () => void): void {
    this.onLineHeightRequest = handler;
  }
  setHeadingMenuHandler(handler: () => void): void {
    this.onHeadingMenuRequest = handler;
  }
  setAlignMenuHandler(handler: () => void): void {
    this.onAlignMenuRequest = handler;
  }
  setFullscreenHandler(handler: () => void): void {
    this.onFullscreenToggle = handler;
  }
  setSourceHandler(handler: () => void): void {
    this.onSourceToggle = handler;
  }

  /** Coalesce rapid editor updates (typing / IME) into one toolbar sync per frame */
  private rafRefresh = 0;
  private pendingUndo: boolean | null = null;
  private pendingRedo: boolean | null = null;
  private lastEmitted = '';

  mount(): void {
    const unregUpdate = this.editor.registerUpdateListener(({ tags }) => {
      // Skip pure history restore noise; still refresh after user edits
      if (tags.has('historic') && !tags.has('history-merge')) {
        // historic undo/redo should update active marks — allow through
      }
      // Ignore IME composition mid-strokes (major flicker source for CJK)
      if (this.editor.isComposing()) return;
      this.scheduleRefresh();
    });

    const unregUndo = this.editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        // Batch into the same rAF as selection refresh — avoids double DOM sync
        this.pendingUndo = payload;
        this.scheduleRefresh();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const unregRedo = this.editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        this.pendingRedo = payload;
        this.scheduleRefresh();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    this.cleanups.push(unregUpdate, unregUndo, unregRedo);
    this.cleanups.push(() => {
      if (this.rafRefresh) {
        cancelAnimationFrame(this.rafRefresh);
        this.rafRefresh = 0;
      }
    });
    this.editor.getEditorState().read(() => this.refreshState());
  }

  destroy(): void {
    if (this.rafRefresh) {
      cancelAnimationFrame(this.rafRefresh);
      this.rafRefresh = 0;
    }
    for (const c of this.cleanups) c();
    this.cleanups = [];
  }

  private scheduleRefresh(): void {
    if (this.rafRefresh) return;
    this.rafRefresh = requestAnimationFrame(() => {
      this.rafRefresh = 0;
      // Still composing after the frame? wait for next real update
      if (this.editor.isComposing()) return;
      this.editor.getEditorState().read(() => this.refreshState());
    });
  }

  private refreshState(): void {
    // Apply batched undo/redo flags first
    if (this.pendingUndo !== null) {
      this.state = { ...this.state, canUndo: this.pendingUndo };
      this.pendingUndo = null;
    }
    if (this.pendingRedo !== null) {
      this.state = { ...this.state, canRedo: this.pendingRedo };
      this.pendingRedo = null;
    }

    const selection = $getSelection();
    const root = $getRoot();
    const isEmpty = root.getTextContent().trim() === '';

    if (!$isRangeSelection(selection)) {
      // CRITICAL: do NOT wipe active marks to EMPTY_STATE.
      // Selection is often briefly non-range during IME composition, normalize,
      // or structural updates — resetting causes the whole toolbar to flash.
      if (
        this.state.isEmpty !== isEmpty ||
        this.state.painterActive !== (this.painter !== null)
      ) {
        this.state = {
          ...this.state,
          isEmpty,
          painterActive: this.painter !== null,
        };
        this.emit();
      } else {
        // Still emit if only canUndo/canRedo changed above
        this.emit();
      }
      return;
    }

    let blockType: ToolbarState['blockType'] = 'paragraph';
    const anchor = selection.anchor.getNode();
    let node: typeof anchor | null = anchor;
    let elementFormat: ToolbarState['elementFormat'] = '';

    while (node) {
      if ($isHeadingNode(node)) {
        blockType = node.getTag() as ToolbarState['blockType'];
        break;
      }
      if ($isQuoteNode(node)) {
        blockType = 'quote';
        break;
      }
      if ($isCodeNode(node)) {
        blockType = 'code';
        break;
      }
      if ($isListNode(node)) {
        const t = node.getListType();
        blockType = t === 'number' ? 'number' : t === 'check' ? 'check' : 'bullet';
        break;
      }
      if ($isTableNode(node)) {
        blockType = 'table';
        break;
      }
      if ($isImageNode(node)) {
        blockType = 'image';
        break;
      }
      if ($isParagraphNode(node)) {
        blockType = 'paragraph';
        break;
      }
      node = node.getParent();
    }

    // Element format from nearest element
    let el: typeof anchor | null = anchor;
    while (el) {
      if ($isElementNode(el) && typeof el.getFormatType === 'function') {
        const f = el.getFormatType();
        if (f) {
          elementFormat = f as ToolbarState['elementFormat'];
          break;
        }
      }
      el = el.getParent();
    }

    const parent = anchor.getParent();
    const link = $isLinkNode(parent) || $isLinkNode(anchor);

    // Normalize style strings so '' vs undefined never thrash equality
    const norm = (v: string) => (v && v !== 'null' && v !== 'undefined' ? v : '');

    this.state = {
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      code: selection.hasFormat('code'),
      highlight: selection.hasFormat('highlight'),
      subscript: selection.hasFormat('subscript'),
      superscript: selection.hasFormat('superscript'),
      link,
      blockType,
      elementFormat,
      fontSize: norm($getSelectionStyleValueForProperty(selection, 'font-size', '')),
      fontFamily: norm($getSelectionStyleValueForProperty(selection, 'font-family', '')),
      fontColor: norm($getSelectionStyleValueForProperty(selection, 'color', '')),
      backgroundColor: norm(
        $getSelectionStyleValueForProperty(selection, 'background-color', ''),
      ),
      lineHeight: norm($getSelectionStyleValueForProperty(selection, 'line-height', '')),
      canUndo: this.state.canUndo,
      canRedo: this.state.canRedo,
      isEmpty,
      isFullscreen: this.state.isFullscreen,
      isSourceMode: this.state.isSourceMode,
      painterActive: this.painter !== null,
    };
    this.emit();
  }

  private emit(): void {
    // Skip UI work when nothing meaningful changed
    const snapshot = JSON.stringify(this.state);
    if (snapshot === this.lastEmitted) return;
    this.lastEmitted = snapshot;
    this.emitter.emit('toolbarChange', { ...this.state });
  }

  // ─── Low-level commands ─────────────────────────────────────────────

  formatText(format: TextFormatType): void {
    this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }

  formatElement(format: ElementFormatType): void {
    this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
  }

  /** Snapshot of last range selection so toolbar popovers can re-apply after focus loss */
  private savedStyleSelection: {
    anchorKey: string;
    anchorOffset: number;
    focusKey: string;
    focusOffset: number;
    format: number;
    style: string;
  } | null = null;

  /** Call before opening color / font-size popovers */
  captureStyleSelection(): void {
    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        this.savedStyleSelection = null;
        return;
      }
      this.savedStyleSelection = {
        anchorKey: selection.anchor.key,
        anchorOffset: selection.anchor.offset,
        focusKey: selection.focus.key,
        focusOffset: selection.focus.offset,
        format: selection.format,
        style: selection.style,
      };
    });
  }

  patchStyle(styles: Record<string, string | null>): void {
    this.editor.focus();
    this.editor.update(() => {
      let selection = $getSelection();

      // Restore range if color/font popover stole focus / cleared selection
      if (!$isRangeSelection(selection) && this.savedStyleSelection) {
        const snap = this.savedStyleSelection;
        const a = $getNodeByKey(snap.anchorKey);
        const f = $getNodeByKey(snap.focusKey);
        if (a && f && a.isAttached() && f.isAttached()) {
          const range = $createRangeSelection();
          const aType = $isTextNode(a) ? 'text' : 'element';
          const fType = $isTextNode(f) ? 'text' : 'element';
          range.anchor.set(snap.anchorKey, snap.anchorOffset, aType);
          range.focus.set(snap.focusKey, snap.focusOffset, fType);
          range.format = snap.format;
          range.style = snap.style;
          $setSelection(range);
          selection = range;
        }
      }

      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, styles);
      }
    });
  }

  undo(): void {
    this.editor.dispatchCommand(UNDO_COMMAND, undefined);
  }
  redo(): void {
    this.editor.dispatchCommand(REDO_COMMAND, undefined);
  }

  setLink(url: string | null): void {
    this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  }

  insertImage(): void {
    this.onImageRequest?.();
  }

  insertAttachment(): void {
    this.onAttachmentRequest?.();
  }

  insertHr(): void {
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const block = $getBlockWrapper(selection.anchor.getNode());
      const hr = $createHorizontalRuleNode();
      const wrap = $createBlockWrapperNode();
      wrap.append(hr);
      if (block) {
        block.insertAfter(wrap);
        const after = $createBlockWrapperNode();
        after.append($createParagraphNode());
        wrap.insertAfter(after);
        after.selectStart();
      } else {
        $getRoot().append(wrap);
      }
    });
  }

  insertTable(rows: number, cols: number): void {
    const r = Math.max(1, Math.min(rows, 20));
    const c = Math.max(1, Math.min(cols, 20));
    this.editor.update(() => {
      const selection = $getSelection();
      const table = $createTableNodeWithDimensions(r, c, {
        rows: true,
        columns: false,
      });
      const wrap = $createBlockWrapperNode();
      wrap.append(table);
      const after = $createBlockWrapperNode();
      after.append($createParagraphNode());

      let block =
        $isRangeSelection(selection)
          ? $getBlockWrapper(selection.anchor.getNode())
          : null;

      // Prefer replacing empty slash/paragraph block content with table only
      if (block?.isAttached() && !block.getTextContent().trim()) {
        for (const k of block.getChildren()) k.remove();
        block.append(table);
        block.insertAfter(after);
      } else if (block?.isAttached()) {
        block.insertAfter(wrap);
        wrap.insertAfter(after);
      } else {
        $getRoot().append(wrap);
        wrap.insertAfter(after);
      }
      // Select first cell safely
      try {
        table.selectStart();
      } catch {
        after.selectStart();
      }
    });
  }

  insertLineBreak(): void {
    this.editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
  }

  insertEmoji(emoji: string): void {
    this.editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(emoji);
      }
    });
  }

  setBlockType(type: ToolbarState['blockType']): void {
    if (type === 'bullet') {
      this.editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (type === 'number') {
      this.editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (type === 'check') {
      // Custom path: Lexical insertList replaces BlockWrapper (it walks up to root).
      // Convert the block's content in-place so the checklist stays visible.
      this.insertCheckListInBlock();
      return;
    }

    if (
      this.state.blockType === 'bullet' ||
      this.state.blockType === 'number' ||
      this.state.blockType === 'check'
    ) {
      this.editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }

    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const create = () => {
        switch (type) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return $createHeadingNode(type as HeadingTagType);
          case 'quote':
            return $createQuoteNode();
          case 'code':
            return $createCodeNode();
          default:
            return $createParagraphNode();
        }
      };
      $setBlocksType(selection, create);
    });
  }

  /**
   * Insert / convert current block to a checklist without destroying BlockWrapper.
   */
  private insertCheckListInBlock(): void {
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchor = selection.anchor.getNode();
      const block = $getBlockWrapper(anchor);
      if (!block || !block.isAttached()) return;

      const content = block.getFirstChild();

      // Already a check list → toggle off to paragraph
      if ($isListNode(content) && content.getListType() === 'check') {
        const text = content.getTextContent();
        const p = $createParagraphNode();
        const t = $createTextNode(text);
        p.append(t);
        // Clear selection before structural replace
        $setSelection(null);
        content.replace(p);
        t.select(t.getTextContentSize(), t.getTextContentSize());
        return;
      }

      // Collect text from current block content before tearing it down
      let body = '';
      if (content) {
        body = content.getTextContent();
      } else {
        body = selection.getTextContent();
      }

      const list = $createListNode('check');
      const item = $createListItemNode(false);
      const textNode = $createTextNode(body);
      item.append(textNode);
      list.append(item);

      // Must clear selection before replace — otherwise Lexical throws
      // "selection has been lost because the previously selected nodes have been removed"
      $setSelection(null);

      if (content) {
        content.replace(list);
      } else {
        block.append(list);
      }
      item.setChecked(false);

      const len = textNode.getTextContentSize();
      textNode.select(len, len);
    });
  }

  insertContainer(): void {
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const block = $getBlockWrapper(selection.anchor.getNode());

      const container = $createContainerNode();
      // Selectable paragraph so caret is stable inside the callout
      const inner = $createParagraphNode();
      const t = $createTextNode('');
      inner.append(t);
      container.append(inner);

      const empty =
        !!block &&
        block.isAttached() &&
        block.getTextContent().replace(/[\u200B\u00A0]/g, '').trim() === '';

      // Clear selection BEFORE replacing nodes (avoids "selection has been lost")
      $setSelection(null);

      if (block && block.isAttached() && empty) {
        const content = block.getFirstChild();
        if (content) {
          content.replace(container);
        } else {
          block.append(container);
        }
      } else if (block && block.isAttached()) {
        const wrap = $createBlockWrapperNode();
        wrap.append(container);
        block.insertAfter(wrap);
      } else {
        const wrap = $createBlockWrapperNode();
        wrap.append(container);
        $getRoot().append(wrap);
      }
      t.select(0, 0);
    });
  }

  clearFormatting(): void {
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      // Clear text formats
      const formats: TextFormatType[] = [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'code',
        'highlight',
        'subscript',
        'superscript',
      ];
      for (const f of formats) {
        if (selection.hasFormat(f)) {
          selection.toggleFormat(f);
        }
      }
      $patchStyleText(selection, {
        'font-size': null,
        'font-family': null,
        color: null,
        'background-color': null,
        'line-height': null,
      });
    });
  }

  togglePainter(): void {
    if (this.painter) {
      this.painter = null;
      this.state = { ...this.state, painterActive: false };
      this.emit();
      return;
    }
    // Capture current formats
    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const formats: TextFormatType[] = [];
      const candidates: TextFormatType[] = [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'code',
        'highlight',
        'subscript',
        'superscript',
      ];
      for (const f of candidates) {
        if (selection.hasFormat(f)) formats.push(f);
      }
      this.painter = {
        formats,
        styles: {
          'font-size': $getSelectionStyleValueForProperty(selection, 'font-size', ''),
          'font-family': $getSelectionStyleValueForProperty(selection, 'font-family', ''),
          color: $getSelectionStyleValueForProperty(selection, 'color', ''),
          'background-color': $getSelectionStyleValueForProperty(
            selection,
            'background-color',
            '',
          ),
          'line-height': $getSelectionStyleValueForProperty(selection, 'line-height', ''),
        },
      };
    });
    this.state = { ...this.state, painterActive: true };
    this.emit();
  }

  applyPainter(): void {
    if (!this.painter) return;
    const snap = this.painter;
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      for (const f of snap.formats) {
        if (!selection.hasFormat(f)) selection.toggleFormat(f);
      }
      const styles: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(snap.styles)) {
        styles[k] = v || null;
      }
      $patchStyleText(selection, styles);
    });
    this.painter = null;
    this.state = { ...this.state, painterActive: false };
    this.emit();
  }

  setFullscreen(on: boolean): void {
    this.state = { ...this.state, isFullscreen: on };
    this.emit();
    this.emitter.emit('fullscreenChange', on);
  }

  setSourceMode(on: boolean, content = ''): void {
    this.state = { ...this.state, isSourceMode: on };
    this.emit();
    this.emitter.emit('sourceModeChange', { open: on, content });
  }

  print(): void {
    window.print();
  }

  /** Dispatch a toolbar item click by id */
  exec(item: ToolbarItemId): void {
    const id = normalizeToolbarItemId(item);

    // If painter is active, apply on most format-related clicks after toggle off
    if (this.painter && id !== 'painter') {
      // Keep painter mode; user selects text then clicks painter again or we apply on second painter click
    }

    switch (id) {
      case 'bold':
        return this.formatText('bold');
      case 'italic':
        return this.formatText('italic');
      case 'underline':
        return this.formatText('underline');
      case 'strike':
      case 'strikethrough':
        return this.formatText('strikethrough');
      case 'code':
        return this.formatText('code');
      case 'highlight':
        return this.formatText('highlight');
      case 'subscript':
        return this.formatText('subscript');
      case 'superscript':
        return this.formatText('superscript');
      case 'undo':
        return this.undo();
      case 'redo':
        return this.redo();
      case 'eraser':
        return this.clearFormatting();
      case 'painter':
        if (this.painter) return this.applyPainter();
        return this.togglePainter();
      case 'link': {
        const url = window.prompt('Enter URL', this.state.link ? '' : 'https://');
        if (url !== null) this.setLink(url || null);
        return;
      }
      case 'image':
        return this.insertImage();
      case 'attachment':
        return this.insertAttachment();
      case 'hr':
        return this.insertHr();
      case 'break':
        return this.insertLineBreak();
      case 'table':
        return this.onTablePickRequest?.();
      case 'tableCellBackgroundColor':
        return this.onColorRequest?.('bg');
      case 'emoji':
        return this.onEmojiRequest?.();
      case 'fontColor':
        return this.onColorRequest?.('color');
      case 'fontSize':
        return this.onFontSizeRequest?.();
      case 'fontFamily':
        return this.onFontFamilyRequest?.();
      case 'lineHeight':
        return this.onLineHeightRequest?.();
      case 'heading':
        return this.onHeadingMenuRequest?.();
      case 'align':
        return this.onAlignMenuRequest?.();
      case 'alignLeft':
        return this.formatElement('left');
      case 'alignCenter':
        return this.formatElement('center');
      case 'alignRight':
        return this.formatElement('right');
      case 'alignJustify':
        return this.formatElement('justify');
      case 'heading1':
        return this.setBlockType('h1');
      case 'heading2':
        return this.setBlockType('h2');
      case 'heading3':
        return this.setBlockType('h3');
      case 'heading4':
        return this.setBlockType('h4');
      case 'heading5':
        return this.setBlockType('h5');
      case 'heading6':
        return this.setBlockType('h6');
      case 'paragraph':
        return this.setBlockType('paragraph');
      case 'quote':
        return this.setBlockType('quote');
      case 'bulletList':
        return this.setBlockType('bullet');
      case 'orderedList':
      case 'numberedList':
        return this.setBlockType('number');
      case 'todo':
        return this.setBlockType('check');
      case 'codeBlock':
        return this.setBlockType('code');
      case 'container':
        return this.insertContainer();
      case 'indentIncrease':
        this.editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
        return;
      case 'indentDecrease':
        this.editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
        return;
      case 'fullscreen':
        return this.onFullscreenToggle?.();
      case 'sourceCode':
        return this.onSourceToggle?.();
      case 'printer':
        return this.print();
      case 'custom':
        this.onCustomAction?.();
        this.emitter.emit('customAction');
        return;
      default:
        return;
    }
  }

  // Direct style APIs used by UI dropdowns
  setFontSize(size: string): void {
    this.patchStyle({ 'font-size': size || null });
  }
  setFontFamily(family: string): void {
    this.patchStyle({ 'font-family': family || null });
  }
  setFontColor(color: string): void {
    this.patchStyle({ color: color || null });
  }
  setBackgroundColor(color: string): void {
    this.patchStyle({ 'background-color': color === 'transparent' ? null : color || null });
  }
  setLineHeight(lh: string): void {
    this.patchStyle({ 'line-height': lh || null });
  }

  setHeadingTag(tag: HeadingTagType): void {
    this.setBlockType(tag as ToolbarState['blockType']);
  }
}
