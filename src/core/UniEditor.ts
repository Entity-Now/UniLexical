import {
  $getRoot,
  COMMAND_PRIORITY_LOW,
  createEditor,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { ListItemNode, ListNode, registerList } from '@lexical/list';
import { registerCheckList } from '../plugins/checkList';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import {
  LinkNode,
  AutoLinkNode,
  TOGGLE_LINK_COMMAND,
  $toggleLink,
} from '@lexical/link';
import { registerHistory, createEmptyHistoryState } from '@lexical/history';
import {
  TableCellNode,
  TableNode,
  TableRowNode,
  registerTablePlugin,
  registerTableSelectionObserver,
} from '@lexical/table';

import { EventEmitter } from './EventEmitter';
import { defaultTheme } from './theme';
import {
  DEFAULT_TOOLBAR_ITEMS,
  type ContentFormat,
  type SlashMenuItem,
  type ToolbarItemId,
  type ToolbarState,
  type UniEditorConfig,
  type UniEditorEvents,
  type EventHandler,
} from './types';
import { BlockWrapperNode, $createBlockWrapperNode } from '../nodes/BlockWrapperNode';
import { ImageNode } from '../nodes/ImageNode';
import { HorizontalRuleNode } from '../nodes/HorizontalRuleNode';
import { AttachmentNode } from '../nodes/AttachmentNode';
import { ContainerNode } from '../nodes/ContainerNode';
import { ToggleNode } from '../nodes/ToggleNode';
import { DateTimeNode } from '../nodes/DateTimeNode';
import { registerBlockNormalizeTransform, $normalizeRootBlocks } from '../plugins/blockTransform';
import { registerEmptyBlockExit } from '../plugins/EmptyBlockExit';
import { registerPasteSupport } from '../plugins/PasteController';
import { registerLowlightCodeHighlighting } from '../plugins/codeHighlight';
import { $createSelectableParagraph } from '../utils/selection';
import { MarkdownShortcutsManager } from '../plugins/MarkdownShortcutsManager';
import { SlashCommandController } from '../plugins/SlashCommandController';
import { ToolbarController } from '../plugins/ToolbarController';
import { BlockOverlayController } from '../plugins/BlockOverlayController';
import { SerializationRegistry, exportHtml, exportMarkdown, exportJson } from '../plugins/SerializationRegistry';
import { ImageController } from '../plugins/ImageController';
import { AttachmentController } from '../plugins/AttachmentController';
import { BlockExtrasController } from '../plugins/BlockExtrasController';
import { TableActionController } from '../plugins/TableActionController';
import { ToolbarUI } from '../ui/ToolbarUI';
import { SlashMenuUI } from '../ui/SlashMenuUI';
import { BlockOverlayUI } from '../ui/BlockOverlayUI';
import { TableActionUI } from '../ui/TableActionUI';

export class UniEditor {
  private editor: LexicalEditor;
  private emitter = new EventEmitter();
  private config: Required<
    Pick<UniEditorConfig, 'namespace' | 'placeholder' | 'builtinUI' | 'editable' | 'toolbarItems'>
  > &
    UniEditorConfig;

  private shell: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private rootEl: HTMLElement | null = null;
  private mounted = false;
  private cleanups: Array<() => void> = [];
  private sourceOverlay: HTMLElement | null = null;

  readonly toolbar: ToolbarController;
  readonly slash: SlashCommandController;
  readonly overlay: BlockOverlayController;
  readonly serialization: SerializationRegistry;
  readonly images: ImageController;
  readonly attachments: AttachmentController;
  readonly extras: BlockExtrasController;
  readonly tableActions: TableActionController;
  private markdown: MarkdownShortcutsManager;

  private toolbarUI: ToolbarUI | null = null;
  private slashUI: SlashMenuUI | null = null;
  private overlayUI: BlockOverlayUI | null = null;
  private tableActionUI: TableActionUI | null = null;

  private version = 0;
  private listeners = new Set<() => void>();

  constructor(config: UniEditorConfig = {}) {
    this.config = {
      namespace: config.namespace ?? 'UniLexical',
      placeholder: config.placeholder ?? "Type '/' for commands…",
      builtinUI: config.builtinUI ?? true,
      editable: config.editable ?? true,
      // undefined → full feature set; explicit array (even empty) → user rules
      toolbarItems:
        config.toolbarItems !== undefined
          ? [...config.toolbarItems]
          : [...DEFAULT_TOOLBAR_ITEMS],
      theme: config.theme,
      nodes: config.nodes,
      imageOptions: config.imageOptions,
      attachmentOptions: config.attachmentOptions,
      initialContent: config.initialContent,
      initialFormat: config.initialFormat,
      onCustomAction: config.onCustomAction,
      // Table picker default board: 5×5
      tableMaxSize: config.tableMaxSize ?? { rows: 5, cols: 5 },
    };

    const theme = { ...defaultTheme, ...config.theme };
    const nodes: Array<Klass<LexicalNode>> = [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      BlockWrapperNode,
      ImageNode,
      HorizontalRuleNode,
      AttachmentNode,
      ContainerNode,
      ToggleNode,
      DateTimeNode,
      ...(config.nodes ?? []),
    ];

    this.editor = createEditor({
      namespace: this.config.namespace,
      theme,
      nodes,
      editable: this.config.editable,
      onError: (error) => {
        this.emitter.emit('error', error);
        console.error('[UniLexical]', error);
      },
    });

    this.toolbar = new ToolbarController(this.editor, this.emitter, this.config.toolbarItems);
    this.slash = new SlashCommandController(this.editor, this.emitter);
    this.overlay = new BlockOverlayController(this.editor, this.emitter);
    this.serialization = new SerializationRegistry(this.editor);
    this.images = new ImageController(this.editor, config.imageOptions ?? {});
    this.attachments = new AttachmentController(this.editor, config.attachmentOptions ?? {});
    this.extras = new BlockExtrasController(this.editor);
    this.tableActions = new TableActionController(this.editor);
    this.markdown = new MarkdownShortcutsManager(this.editor);

    const requestImage = () => this.images.requestUpload();
    this.toolbar.setImageRequestHandler(requestImage);
    this.slash.setImageRequestHandler(requestImage);
    this.toolbar.setAttachmentRequestHandler(() => this.attachments.requestUpload());
    const requestDateTime = (includeTime: boolean) => this.extras.insertDateTime(includeTime);
    this.toolbar.setDateTimeRequestHandler(requestDateTime);
    this.slash.setDateTimeRequestHandler(requestDateTime);
    if (config.onCustomAction) {
      this.toolbar.setCustomActionHandler(config.onCustomAction);
    }
    // Slash “Table” opens the same interactive grid picker as the toolbar
    this.slash.setTableRequestHandler(() => {
      const rect = getCaretRect() ?? new DOMRect(window.innerWidth / 2 - 90, 120, 180, 0);
      if (this.toolbarUI) {
        this.toolbarUI.openTablePickerAt(rect);
      } else {
        // Headless: insert a sensible default if no UI
        this.toolbar.insertTable(3, 3);
      }
    });
  }

  mount(container: HTMLElement): void {
    if (this.mounted) {
      throw new Error('[UniLexical] Editor is already mounted. Call destroy() first.');
    }

    container.classList.add('uni-editor-root');
    this.rootEl = container;

    const shell = document.createElement('div');
    shell.className = 'uni-editor-shell';

    const content = document.createElement('div');
    content.className = 'uni-editor-content';
    content.setAttribute('data-placeholder', this.config.placeholder);
    content.contentEditable = this.config.editable ? 'true' : 'false';
    content.setAttribute('role', 'textbox');
    content.setAttribute('aria-multiline', 'true');
    content.spellcheck = true;

    shell.appendChild(content);
    container.appendChild(shell);

    this.shell = shell;
    this.contentEl = content;

    this.editor.setRootElement(content);

    this.cleanups.push(registerRichText(this.editor));
    this.cleanups.push(registerList(this.editor));
    this.cleanups.push(registerCheckList(this.editor));
    // Syntax highlighting via lowlight (highlight.js grammars)
    this.cleanups.push(registerLowlightCodeHighlighting(this.editor));
    this.cleanups.push(registerTablePlugin(this.editor));
    this.cleanups.push(registerTableSelectionObserver(this.editor));
    this.cleanups.push(
      this.editor.registerCommand(
        TOGGLE_LINK_COMMAND,
        (payload) => {
          if (payload === null) {
            $toggleLink(null);
            return true;
          }
          if (typeof payload === 'string') {
            $toggleLink(payload);
            return true;
          }
          const { url, target, rel, title } = payload;
          $toggleLink(url, { rel, target, title });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
    this.cleanups.push(registerHistory(this.editor, createEmptyHistoryState(), 300));
    this.cleanups.push(registerBlockNormalizeTransform(this.editor));
    this.cleanups.push(registerEmptyBlockExit(this.editor));
    // Ctrl/Cmd+V images & drag-drop files
    this.cleanups.push(
      registerPasteSupport(this.editor, this.emitter, this.images, this.attachments),
    );

    this.markdown.mount();
    this.slash.mount();
    this.toolbar.mount();
    this.overlay.mount(content);
    this.extras.mount(content);
    this.tableActions.mount(content);

    // Fullscreen / source handlers
    this.toolbar.setFullscreenHandler(() => {
      const next = !this.toolbar.getState().isFullscreen;
      container.classList.toggle('uni-fullscreen', next);
      this.toolbar.setFullscreen(next);
    });

    this.toolbar.setSourceHandler(() => {
      const open = !this.toolbar.getState().isSourceMode;
      if (open) {
        this.openSourceMode();
      } else {
        this.closeSourceMode(true);
      }
    });

    // Debounce expensive serialize-on-change to avoid UI thrash / toolbar flicker
    let changeTimer: ReturnType<typeof setTimeout> | null = null;
    this.cleanups.push(
      this.editor.registerUpdateListener(({ editorState, tags }) => {
        this.version += 1;
        for (const l of this.listeners) l();

        // Skip historic / internal normalize / slash tags for change payload
        if (
          tags.has('historic') ||
          tags.has('uni-normalize') ||
          tags.has('uni-slash-exec')
        ) {
          return;
        }

        if (changeTimer) clearTimeout(changeTimer);
        changeTimer = setTimeout(() => {
          editorState.read(() => {
            try {
              this.emitter.emit('change', {
                json: exportJson(this.editor),
                html: exportHtml(this.editor),
                markdown: exportMarkdown(this.editor),
              });
            } catch {
              /* export mid-transform */
            }
          });
        }, 120);
      }),
    );
    this.cleanups.push(() => {
      if (changeTimer) clearTimeout(changeTimer);
    });

    if (this.config.initialContent && this.config.initialFormat) {
      this.setContent(this.config.initialContent, this.config.initialFormat);
    } else {
      this.editor.update(() => {
        const root = $getRoot();
        if (root.getChildrenSize() === 0) {
          const block = $createBlockWrapperNode();
          block.append($createSelectableParagraph());
          root.append(block);
        } else {
          $normalizeRootBlocks();
        }
      });
    }

    if (this.config.builtinUI) {
      this.toolbarUI = new ToolbarUI(shell, this.toolbar, {
        tableMaxSize: this.config.tableMaxSize,
      });
      shell.insertBefore(this.toolbarUI.getElement(), content);
      this.toolbarUI.bind((cb) => this.on('toolbarChange', cb));

      this.slashUI = new SlashMenuUI(this.slash);
      this.slashUI.bind((cb) => this.on('slashTriggered', cb));
      this.slash.setActiveIndexChangeHandler((index) => {
        this.slashUI?.setActiveHighlight(index);
      });

      // Mount overlay on editor root so it shares modal/dialog stacking contexts
      this.overlayUI = new BlockOverlayUI(this.overlay, this.slash, container);
      this.overlayUI.bind((cb) => this.on('blockHoverChanged', cb));

      this.tableActionUI = new TableActionUI(this.tableActions);
    }

    this.mounted = true;
    this.emitter.emit('ready');
  }

  private openSourceMode(): void {
    if (!this.shell || this.sourceOverlay) return;
    const html = this.getHtml();
    const overlay = document.createElement('div');
    overlay.className = 'uni-source-overlay';
    const ta = document.createElement('textarea');
    ta.className = 'uni-source-textarea';
    ta.value = html;
    const bar = document.createElement('div');
    bar.className = 'uni-source-bar';
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => {
      this.setContent(ta.value, 'html');
      this.closeSourceMode(false);
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.closeSourceMode(false));
    bar.appendChild(applyBtn);
    bar.appendChild(cancelBtn);
    overlay.appendChild(bar);
    overlay.appendChild(ta);
    this.shell.appendChild(overlay);
    this.sourceOverlay = overlay;
    this.contentEl && (this.contentEl.style.display = 'none');
    this.toolbar.setSourceMode(true, html);
  }

  private closeSourceMode(apply: boolean): void {
    if (!this.sourceOverlay) return;
    if (apply) {
      const ta = this.sourceOverlay.querySelector('textarea');
      if (ta) this.setContent(ta.value, 'html');
    }
    this.sourceOverlay.remove();
    this.sourceOverlay = null;
    if (this.contentEl) this.contentEl.style.display = '';
    this.toolbar.setSourceMode(false);
  }

  destroy(): void {
    if (!this.mounted) return;

    this.closeSourceMode(false);
    this.rootEl?.classList.remove('uni-fullscreen');

    this.toolbarUI?.destroy();
    this.slashUI?.destroy();
    this.overlayUI?.destroy();
    this.tableActionUI?.destroy();
    this.toolbarUI = null;
    this.slashUI = null;
    this.overlayUI = null;
    this.tableActionUI = null;

    this.markdown.destroy();
    this.slash.destroy();
    this.toolbar.destroy();
    this.overlay.destroy();
    this.extras.destroy();
    this.tableActions.destroy();
    this.images.destroy();
    this.attachments.destroy();

    for (const c of this.cleanups) {
      try {
        c();
      } catch {
        /* ignore */
      }
    }
    this.cleanups = [];

    this.editor.setRootElement(null);
    this.shell?.remove();
    this.shell = null;
    this.contentEl = null;
    this.rootEl = null;
    this.mounted = false;

    this.emitter.emit('destroy');
    this.emitter.removeAllListeners();
  }

  getContent(format: ContentFormat = 'json'): string {
    return this.serialization.serialize(format);
  }

  setContent(content: string, format: ContentFormat = 'json'): void {
    this.serialization.deserialize(format, content);
  }

  getHtml(): string {
    return this.getContent('html');
  }

  getMarkdown(): string {
    return this.getContent('markdown');
  }

  getJson(): string {
    return this.getContent('json');
  }

  getLexicalEditor(): LexicalEditor {
    return this.editor;
  }

  isMounted(): boolean {
    return this.mounted;
  }

  setEditable(editable: boolean): void {
    this.editor.setEditable(editable);
    if (this.contentEl) {
      this.contentEl.contentEditable = editable ? 'true' : 'false';
    }
  }

  focus(): void {
    this.editor.focus();
  }

  blur(): void {
    this.contentEl?.blur();
  }

  setToolbarItems(items: ToolbarItemId[]): void {
    this.toolbar.setItems(items);
    this.toolbarUI?.refreshItems();
  }

  getToolbarState(): ToolbarState {
    return this.toolbar.getState();
  }

  setSlashItems(items: SlashMenuItem[]): void {
    this.slash.setItems(items);
  }

  on<K extends keyof UniEditorEvents>(
    event: K,
    handler: EventHandler<UniEditorEvents[K]>,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  off<K extends keyof UniEditorEvents>(
    event: K,
    handler: EventHandler<UniEditorEvents[K]>,
  ): void {
    this.emitter.off(event, handler);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): number {
    return this.version;
  }

  execToolbar(item: ToolbarItemId): void {
    this.toolbar.exec(item);
  }

  insertImageFile(file: File): Promise<void> {
    return this.images.insertFile(file);
  }

  insertImageUrl(src: string, alt?: string): void {
    this.images.insertFromUrl(src, alt);
  }

  insertTable(rows: number, cols: number): void {
    this.toolbar.insertTable(rows, cols);
  }
}

export function createUniEditor(config?: UniEditorConfig): UniEditor {
  return new UniEditor(config);
}

function getCaretRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
    return null;
  }
  return rect;
}
