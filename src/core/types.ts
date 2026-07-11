import type { EditorThemeClasses, Klass, LexicalNode } from 'lexical';

/**
 * Toolbar item identifiers.
 * Names mirror common editor component sets (Align, Bold, Table, …).
 * Legacy aliases (heading1, bulletList, strikethrough, …) remain supported.
 */
export type ToolbarItemId =
  // History
  | 'undo'
  | 'redo'
  // Inline format
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'strikethrough' // alias of strike
  | 'code'
  | 'highlight'
  | 'subscript'
  | 'superscript'
  | 'eraser'
  | 'painter'
  // Typography
  | 'fontColor'
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  // Align
  | 'align'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  // Blocks
  | 'heading'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'paragraph'
  | 'quote'
  | 'codeBlock'
  | 'bulletList'
  | 'orderedList'
  | 'numberedList' // alias of orderedList
  | 'todo'
  | 'container'
  // Insert
  | 'link'
  | 'image'
  | 'attachment'
  | 'table'
  | 'tableCellBackgroundColor'
  | 'hr'
  | 'divider' // toolbar separator
  | 'group' // toolbar group separator
  | 'break'
  | 'emoji'
  | 'custom'
  // Indent
  | 'indentIncrease'
  | 'indentDecrease'
  // View / system
  | 'sourceCode'
  | 'fullscreen'
  | 'printer';

/** Content format for import/export */
export type ContentFormat = 'html' | 'markdown' | 'json';

/** Image upload callback – return a public URL string */
export type ImageUploadHandler = (file: File) => Promise<string>;

/** Attachment upload callback */
export type AttachmentUploadHandler = (file: File) => Promise<{ url: string; name?: string }>;

export interface ImageOptions {
  upload?: ImageUploadHandler;
  accept?: string;
  maxSize?: number;
}

export interface AttachmentOptions {
  upload?: AttachmentUploadHandler;
  accept?: string;
  maxSize?: number;
}

export interface UniEditorTheme extends EditorThemeClasses {
  blockWrapper?: string;
  image?: string;
  imageLoading?: string;
  slashMenu?: string;
  slashMenuItem?: string;
  slashMenuItemActive?: string;
  blockOverlay?: string;
  dragHandle?: string;
  plusButton?: string;
  toolbar?: string;
  toolbarButton?: string;
  toolbarButtonActive?: string;
  toolbarDivider?: string;
  hr?: string;
  table?: string;
  tableCell?: string;
  tableCellHeader?: string;
  attachment?: string;
  container?: string;
  todoChecked?: string;
  todoUnchecked?: string;
}

export interface UniEditorConfig {
  theme?: UniEditorTheme;
  nodes?: Array<Klass<LexicalNode>>;
  imageOptions?: ImageOptions;
  attachmentOptions?: AttachmentOptions;
  initialContent?: string;
  initialFormat?: ContentFormat;
  toolbarItems?: ToolbarItemId[];
  placeholder?: string;
  namespace?: string;
  builtinUI?: boolean;
  editable?: boolean;
  /** Optional custom toolbar action (for `custom` item) */
  onCustomAction?: () => void;
  /** Max table picker size (default 10x10) */
  tableMaxSize?: { rows: number; cols: number };
}

/** Active formatting / block state for toolbar UI */
export interface ToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  highlight: boolean;
  subscript: boolean;
  superscript: boolean;
  link: boolean;
  blockType:
    | 'paragraph'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'quote'
    | 'bullet'
    | 'number'
    | 'check'
    | 'code'
    | 'image'
    | 'table'
    | 'unknown';
  elementFormat: 'left' | 'center' | 'right' | 'justify' | 'start' | 'end' | '';
  fontSize: string;
  fontFamily: string;
  fontColor: string;
  backgroundColor: string;
  lineHeight: string;
  canUndo: boolean;
  canRedo: boolean;
  isEmpty: boolean;
  isFullscreen: boolean;
  isSourceMode: boolean;
  painterActive: boolean;
}

export interface SlashMenuItem {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  icon?: string;
  action: SlashAction;
}

export type SlashAction =
  | {
      type: 'block';
      blockType:
        | 'paragraph'
        | 'h1'
        | 'h2'
        | 'h3'
        | 'h4'
        | 'h5'
        | 'h6'
        | 'quote'
        | 'bullet'
        | 'number'
        | 'check'
        | 'code'
        | 'hr'
        | 'table';
    }
  | { type: 'format'; format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'highlight' }
  | { type: 'image' }
  | { type: 'custom'; handler: () => void };

export interface SlashTriggerPayload {
  open: boolean;
  query: string;
  rect: DOMRect | null;
  slashOffset: number | null;
}

export interface BlockHoverPayload {
  blockId: string | null;
  rect: DOMRect | null;
  element: HTMLElement | null;
}

/** Payload for paste / drop media monitoring */
export type PastePayload = {
  kind: 'image' | 'file' | 'text';
  files: Array<{ name: string; type: string; size: number }>;
  count: number;
  hasHtml?: boolean;
  textLength?: number;
};

export type UniEditorEvents = {
  change: { json: string; html: string; markdown: string };
  toolbarChange: ToolbarState;
  slashTriggered: SlashTriggerPayload;
  blockHoverChanged: BlockHoverPayload;
  /** Fired on paste/drop of media or text (for external monitors) */
  paste: PastePayload;
  error: Error;
  destroy: void;
  ready: void;
  fullscreenChange: boolean;
  sourceModeChange: { open: boolean; content: string };
  customAction: void;
};

export type EventHandler<T> = T extends void ? () => void : (payload: T) => void;

export interface SerializeOptions {
  format: ContentFormat;
}

/** Default full toolbar (covers the full component set) */
export const DEFAULT_TOOLBAR_ITEMS: ToolbarItemId[] = [
  'undo',
  'redo',
  'divider',
  'painter',
  'eraser',
  'divider',
  'heading',
  'fontSize',
  'fontFamily',
  'divider',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'highlight',
  'fontColor',
  'divider',
  'subscript',
  'superscript',
  'divider',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'alignJustify',
  'lineHeight',
  'divider',
  'bulletList',
  'orderedList',
  'todo',
  'indentDecrease',
  'indentIncrease',
  'divider',
  'quote',
  'codeBlock',
  'container',
  'divider',
  'link',
  'image',
  'attachment',
  'table',
  'tableCellBackgroundColor',
  'hr',
  'break',
  'emoji',
  'divider',
  'sourceCode',
  'fullscreen',
  'printer',
];

/** Normalize legacy / alias item ids */
export function normalizeToolbarItemId(id: ToolbarItemId): ToolbarItemId {
  if (id === 'strikethrough') return 'strike';
  if (id === 'numberedList') return 'orderedList';
  return id;
}
