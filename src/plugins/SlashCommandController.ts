import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  type LexicalEditor,
  type NodeKey,
  type TextNode,
} from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
} from '@lexical/rich-text';
import {
  $createListItemNode,
  $createListNode,
} from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import type { EventEmitter } from '../core/EventEmitter';
import type { SlashAction, SlashMenuItem, SlashTriggerPayload } from '../core/types';
import { $getBlockWrapper } from './blockTransform';
import { $createHorizontalRuleNode } from '../nodes/HorizontalRuleNode';
import { $createBlockWrapperNode } from '../nodes/BlockWrapperNode';

export const DEFAULT_SLASH_ITEMS: SlashMenuItem[] = [
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Plain paragraph',
    keywords: ['text', 'paragraph', 'p'],
    icon: '¶',
    action: { type: 'block', blockType: 'paragraph' },
  },
  {
    id: 'h1',
    title: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'heading', 'title'],
    icon: 'H1',
    action: { type: 'block', blockType: 'h1' },
  },
  {
    id: 'h2',
    title: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'heading'],
    icon: 'H2',
    action: { type: 'block', blockType: 'h2' },
  },
  {
    id: 'h3',
    title: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    icon: 'H3',
    action: { type: 'block', blockType: 'h3' },
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quote',
    keywords: ['quote', 'blockquote', 'cite'],
    icon: '❝',
    action: { type: 'block', blockType: 'quote' },
  },
  {
    id: 'bullet',
    title: 'Bulleted list',
    description: 'Create a simple bullet list',
    keywords: ['bullet', 'list', 'ul', 'unordered'],
    icon: '•',
    action: { type: 'block', blockType: 'bullet' },
  },
  {
    id: 'number',
    title: 'Numbered list',
    description: 'Create a list with numbering',
    keywords: ['number', 'ordered', 'ol', 'list'],
    icon: '1.',
    action: { type: 'block', blockType: 'number' },
  },
  {
    id: 'todo',
    title: 'To-do list',
    description: 'Track tasks with a checklist',
    keywords: ['todo', 'task', 'check', 'checkbox'],
    icon: '☑',
    action: { type: 'block', blockType: 'check' },
  },
  {
    id: 'code',
    title: 'Code block',
    description: 'Capture a code snippet',
    keywords: ['code', 'snippet', 'pre'],
    icon: '</>',
    action: { type: 'block', blockType: 'code' },
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Pick rows × columns',
    keywords: ['table', 'grid'],
    icon: '▦',
    action: { type: 'block', blockType: 'table' },
  },
  {
    id: 'hr',
    title: 'Divider',
    description: 'Visual separator',
    keywords: ['hr', 'divider', 'line', 'separator'],
    icon: '—',
    action: { type: 'block', blockType: 'hr' },
  },
  {
    id: 'image',
    title: 'Image',
    description: 'Upload or embed an image',
    keywords: ['image', 'img', 'photo', 'picture'],
    icon: '🖼',
    action: { type: 'image' },
  },
];

function getCaretRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  let rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const span = document.createElement('span');
    span.appendChild(document.createTextNode('\u200b'));
    range.insertNode(span);
    rect = span.getBoundingClientRect();
    span.parentNode?.removeChild(span);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  return rect;
}

export class SlashCommandController {
  private open = false;
  private query = '';
  private slashOffset: number | null = null;
  private activeIndex = 0;
  private items: SlashMenuItem[];
  private filtered: SlashMenuItem[] = [];
  private cleanups: Array<() => void> = [];
  private onImageRequest: (() => void) | null = null;
  private onTableRequest: (() => void) | null = null;
  private slashTextKey: NodeKey | null = null;
  private slashCaretOffset: number | null = null;
  private lastRect: DOMRect | null = null;
  private onActiveIndexChange: ((index: number) => void) | null = null;

  constructor(
    private editor: LexicalEditor,
    private emitter: EventEmitter,
    items?: SlashMenuItem[],
  ) {
    this.items = items ?? DEFAULT_SLASH_ITEMS;
    this.filtered = this.items;
  }

  setImageRequestHandler(handler: () => void): void {
    this.onImageRequest = handler;
  }

  setTableRequestHandler(handler: () => void): void {
    this.onTableRequest = handler;
  }

  setActiveIndexChangeHandler(handler: (index: number) => void): void {
    this.onActiveIndexChange = handler;
  }

  setItems(items: SlashMenuItem[]): void {
    this.items = items;
    this.applyFilter();
  }

  getFilteredItems(): SlashMenuItem[] {
    return this.filtered;
  }

  getActiveIndex(): number {
    return this.activeIndex;
  }

  setActiveIndex(index: number): void {
    const max = Math.max(0, this.filtered.length - 1);
    this.activeIndex = Math.max(0, Math.min(index, max));
    this.onActiveIndexChange?.(this.activeIndex);
  }

  isOpen(): boolean {
    return this.open;
  }

  mount(): void {
    const unregUpdate = this.editor.registerUpdateListener(({ editorState, tags }) => {
      if (tags.has('historic') || tags.has('uni-slash-exec')) return;
      editorState.read(() => {
        this.detectSlash();
      });
    });

    const unregDown = this.editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (!this.open) return false;
        event?.preventDefault();
        this.setActiveIndex(this.activeIndex + 1);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregUp = this.editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        if (!this.open) return false;
        event?.preventDefault();
        this.setActiveIndex(this.activeIndex - 1);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregEnter = this.editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!this.open) return false;
        event?.preventDefault();
        this.confirmActive();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const unregEsc = this.editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        if (!this.open) return false;
        event?.preventDefault();
        this.close();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    this.cleanups.push(unregUpdate, unregDown, unregUp, unregEnter, unregEsc);
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.close();
  }

  private detectSlash(): void {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      if (this.open) this.close();
      return;
    }

    const anchor = selection.anchor.getNode();
    if (!$isTextNode(anchor)) {
      if (this.open) this.close();
      return;
    }

    const text = anchor.getTextContent();
    const offset = selection.anchor.offset;
    const before = text.slice(0, offset);

    const match = before.match(/(?:^|[\s])\/([^\s/\\]*)$/);
    if (!match) {
      if (this.open) this.close();
      return;
    }

    const q = match[1] ?? '';
    const slashStart = before.lastIndexOf('/');

    const prevOpen = this.open;
    const prevQuery = this.query;

    this.open = true;
    this.query = q;
    this.slashOffset = slashStart;
    this.slashTextKey = anchor.getKey();
    this.slashCaretOffset = offset;
    this.applyFilter();

    const rect = getCaretRect();
    if (rect) this.lastRect = rect;

    if (!prevOpen || prevQuery !== q) {
      this.emitState();
    } else {
      this.emitState();
    }
  }

  private applyFilter(): void {
    const q = this.query.toLowerCase();
    this.filtered = q
      ? this.items.filter((item) => {
          const hay = [item.title, item.description, ...(item.keywords ?? [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : [...this.items];
    this.activeIndex = 0;
  }

  private emitState(): void {
    const payload: SlashTriggerPayload = {
      open: this.open,
      query: this.query,
      rect: this.open ? this.lastRect ?? getCaretRect() : null,
      slashOffset: this.slashOffset,
    };
    this.emitter.emit('slashTriggered', payload);
  }

  close(): void {
    if (!this.open && this.query === '') return;
    this.open = false;
    this.query = '';
    this.slashOffset = null;
    this.slashTextKey = null;
    this.slashCaretOffset = null;
    this.activeIndex = 0;
    this.filtered = this.items;
    this.emitter.emit('slashTriggered', {
      open: false,
      query: '',
      rect: null,
      slashOffset: null,
    });
  }

  openAtSelection(): void {
    this.editor.focus();
    this.editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // If the line already starts a slash query, just re-detect (no second `/`)
      const anchor = selection.anchor.getNode();
      if ($isTextNode(anchor)) {
        const text = anchor.getTextContent();
        const offset = selection.anchor.offset;
        const before = text.slice(0, offset);
        if (/(?:^|[\s])\/([^\s/\\]*)$/.test(before) || /^\/[^\s]*$/.test(text.trim())) {
          // Move caret to end of existing slash token so detectSlash keeps menu open
          const trimmed = text;
          const slashIdx = trimmed.lastIndexOf('/');
          if (slashIdx >= 0) {
            anchor.select(trimmed.length, trimmed.length);
          }
          return;
        }
      }

      selection.insertText('/');
    });
  }

  confirmActive(): void {
    const item = this.filtered[this.activeIndex];
    if (item) this.execute(item);
  }

  execute(item: SlashMenuItem): void {
    const textKey = this.slashTextKey;
    const caretOffset = this.slashCaretOffset;
    // Actions that open UI after the update
    let deferred: (() => void) | null = null;

    this.editor.update(
      () => {
        // Always clear selection first so structural replaces can't leave a
        // dangling selection on nodes about to be removed.
        $setSelection(null);

        let block = null as ReturnType<typeof $getBlockWrapper>;
        let remainingAfterSlash = '';

        if (textKey != null) {
          const node = $getNodeByKey(textKey);
          if ($isTextNode(node) && node.isAttached()) {
            const offset = Math.min(
              caretOffset ?? node.getTextContentSize(),
              node.getTextContentSize(),
            );
            const text = node.getTextContent();
            const before = text.slice(0, offset);
            const slashStart = before.lastIndexOf('/');
            if (slashStart >= 0) {
              remainingAfterSlash = (text.slice(0, slashStart) + text.slice(offset)).trim();
            } else {
              remainingAfterSlash = text.trim();
            }
            // Remove slash query text
            if (slashStart >= 0) {
              node.setTextContent(text.slice(0, slashStart) + text.slice(offset));
            }
            block = $getBlockWrapper(node);
          }
        }

        if (!block) {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            block = $getBlockWrapper(selection.anchor.getNode());
          }
        }

        deferred = this.applyAction(item.action, block, remainingAfterSlash);
      },
      { tag: 'uni-slash-exec' },
    );
    this.close();
    if (deferred) queueMicrotask(deferred);
  }

  /**
   * Apply slash action. Returns an optional deferred callback (e.g. open picker).
   */
  private applyAction(
    action: SlashAction,
    block: ReturnType<typeof $getBlockWrapper>,
    remainingText: string,
  ): (() => void) | null {
    if (action.type === 'custom') {
      return () => action.handler();
    }

    if (action.type === 'image') {
      return () => this.onImageRequest?.();
    }

    if (action.type === 'format') {
      // re-focus editor selection is hard after $setSelection(null); skip format from slash
      return null;
    }

    if (action.type !== 'block') return null;
    if (!block || !block.isAttached()) return null;

    const { blockType } = action;

    // Table: only open picker (do NOT also insert a default table)
    if (blockType === 'table') {
      return () => this.onTableRequest?.();
    }

    // ── Lists (incl. todo/check) ───────────────────────────────────────
    // ListItemNode.append unwraps Paragraph — put TextNode as direct child.
    // For checklists, pass checked=false so DOM gets role="checkbox" on first paint.
    // IMPORTANT: never remove nodes while selection still points at them;
    // selection was already cleared at the start of execute().
    if (blockType === 'bullet' || blockType === 'number' || blockType === 'check') {
      const listType =
        blockType === 'number' ? 'number' : blockType === 'check' ? 'check' : 'bullet';
      const list = $createListNode(listType);
      const item =
        blockType === 'check' ? $createListItemNode(false) : $createListItemNode();
      const textNode = $createTextNode(remainingText || '');
      item.append(textNode);
      list.append(item);

      // Atomic replace of primary content (avoids mid-tree selection loss)
      const contentNode = block.getFirstChild();
      if (contentNode) {
        contentNode.replace(list);
      } else {
        block.append(list);
      }

      if (blockType === 'check') {
        item.setChecked(false);
      }

      // Place caret on the new text leaf AFTER replace so Lexical keeps selection
      const len = textNode.getTextContentSize();
      textNode.select(len, len);
      return null;
    }

    // ── Horizontal rule ────────────────────────────────────────────────
    if (blockType === 'hr') {
      const hr = $createHorizontalRuleNode();
      const contentNode = block.getFirstChild();
      const empty = !remainingText;

      if (contentNode && empty) {
        contentNode.replace(hr);
      } else {
        const wrap = $createBlockWrapperNode();
        wrap.append(hr);
        block.insertAfter(wrap);
      }
      // Always leave a paragraph after the rule to type into
      const after = $createBlockWrapperNode();
      const p = $createParagraphNode();
      const t = $createTextNode('');
      p.append(t);
      after.append(p);
      const host = empty && contentNode ? block : block.getNextSibling();
      if (host && 'insertAfter' in host) {
        (host as typeof block).insertAfter(after);
      } else {
        block.insertAfter(after);
      }
      t.select(0, 0);
      return null;
    }

    // ── Headings / quote / code / paragraph ────────────────────────────
    let content;
    switch (blockType) {
      case 'h1':
        content = $createHeadingNode('h1');
        break;
      case 'h2':
        content = $createHeadingNode('h2');
        break;
      case 'h3':
        content = $createHeadingNode('h3');
        break;
      case 'h4':
        content = $createHeadingNode('h4');
        break;
      case 'h5':
        content = $createHeadingNode('h5');
        break;
      case 'h6':
        content = $createHeadingNode('h6');
        break;
      case 'quote':
        content = $createQuoteNode();
        break;
      case 'code':
        content = $createCodeNode();
        break;
      case 'paragraph':
      default:
        content = $createParagraphNode();
        break;
    }

    const textNode = $createTextNode(
      remainingText && blockType !== 'code' ? remainingText : '',
    );
    content.append(textNode);

    const contentNode = block.getFirstChild();
    if (contentNode) contentNode.replace(content);
    else block.append(content);

    textNode.select(textNode.getTextContentSize(), textNode.getTextContentSize());
    return null;
  }
}
