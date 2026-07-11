import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  forwardRef,
  type CSSProperties,
} from 'react';
import { createUniEditor, UniEditor } from '../core/UniEditor';
import type {
  ContentFormat,
  ImageOptions,
  SlashMenuItem,
  ToolbarItemId,
  ToolbarState,
  UniEditorConfig,
} from '../core/types';
import { UniPreview } from '../preview/UniPreview';

export interface UseLexicalResult {
  containerRef: (node: HTMLElement | null) => void;
  editor: UniEditor | null;
  toolbarState: ToolbarState | null;
  version: number;
  getContent: (format?: ContentFormat) => string;
  setContent: (content: string, format?: ContentFormat) => void;
  focus: () => void;
}

/**
 * React hook – bridges UniEditor via useSyncExternalStore.
 * Editor instance is stored in a ref (never put into React state)
 * to avoid deep-proxy / identity issues with Lexical.
 */
export function useLexical(config: UniEditorConfig = {}): UseLexicalResult {
  const editorRef = useRef<UniEditor | null>(null);
  const containerNode = useRef<HTMLElement | null>(null);
  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Stable subscribe / getSnapshot for useSyncExternalStore
  const subscribe = useCallback((onStoreChange: () => void) => {
    const editor = editorRef.current;
    if (!editor) return () => {};
    return editor.subscribe(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    return editorRef.current?.getSnapshot() ?? 0;
  }, []);

  const version = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  const containerRef = useCallback((node: HTMLElement | null) => {
    if (containerNode.current === node) return;

    // Teardown previous
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }

    containerNode.current = node;
    if (!node) return;

    const editor = createUniEditor(configRef.current);
    editorRef.current = editor;
    editor.on('toolbarChange', setToolbarState);
    editor.mount(node);
  }, []);

  useEffect(() => {
    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  return {
    containerRef,
    editor: editorRef.current,
    toolbarState,
    version,
    getContent: (format: ContentFormat = 'json') =>
      editorRef.current?.getContent(format) ?? '',
    setContent: (content: string, format: ContentFormat = 'json') =>
      editorRef.current?.setContent(content, format),
    focus: () => editorRef.current?.focus(),
  };
}

export interface UniLexicalProps {
  toolbarItems?: ToolbarItemId[];
  imageOptions?: ImageOptions;
  initialContent?: string;
  initialFormat?: ContentFormat;
  placeholder?: string;
  builtinUI?: boolean;
  editable?: boolean;
  slashItems?: SlashMenuItem[];
  className?: string;
  style?: CSSProperties;
  onChange?: (payload: { json: string; html: string; markdown: string }) => void;
  onReady?: (editor: UniEditor) => void;
  onToolbarChange?: (state: ToolbarState) => void;
}

export interface UniLexicalHandle {
  editor: UniEditor | null;
  getContent: (format?: ContentFormat) => string;
  setContent: (content: string, format?: ContentFormat) => void;
  getHtml: () => string;
  getMarkdown: () => string;
  focus: () => void;
}

/**
 * React component wrapper.
 *
 * @example
 * ```tsx
 * <UniLexical
 *   toolbarItems={['bold', 'italic', 'underline']}
 *   imageOptions={{ upload: uploadToS3 }}
 *   onChange={({ markdown }) => console.log(markdown)}
 * />
 * ```
 */
export const UniLexical = forwardRef<UniLexicalHandle, UniLexicalProps>(
  function UniLexical(props, ref) {
    const {
      toolbarItems,
      imageOptions,
      initialContent,
      initialFormat = 'markdown',
      placeholder,
      builtinUI = true,
      editable = true,
      slashItems,
      className,
      style,
      onChange,
      onReady,
      onToolbarChange,
    } = props;

    const editorRef = useRef<UniEditor | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);
    const callbacks = useRef({ onChange, onReady, onToolbarChange });
    callbacks.current = { onChange, onReady, onToolbarChange };

    const config = useMemo<UniEditorConfig>(
      () => ({
        toolbarItems,
        imageOptions,
        initialContent,
        initialFormat,
        placeholder,
        builtinUI,
        editable,
      }),
      // Intentionally mount-once for initial content; toolbar/editable watched below
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const editor = createUniEditor(config);
      editorRef.current = editor;

      if (slashItems) editor.setSlashItems(slashItems);

      editor.on('change', (payload) => callbacks.current.onChange?.(payload));
      editor.on('toolbarChange', (state) => callbacks.current.onToolbarChange?.(state));
      editor.on('ready', () => callbacks.current.onReady?.(editor));

      editor.mount(host);

      return () => {
        editor.destroy();
        editorRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (toolbarItems && editorRef.current) {
        editorRef.current.setToolbarItems(toolbarItems);
      }
    }, [toolbarItems]);

    useEffect(() => {
      editorRef.current?.setEditable(editable);
    }, [editable]);

    useImperativeHandle(ref, () => ({
      editor: editorRef.current,
      getContent: (format: ContentFormat = 'json') =>
        editorRef.current?.getContent(format) ?? '',
      setContent: (content: string, format: ContentFormat = 'json') =>
        editorRef.current?.setContent(content, format),
      getHtml: () => editorRef.current?.getHtml() ?? '',
      getMarkdown: () => editorRef.current?.getMarkdown() ?? '',
      focus: () => editorRef.current?.focus(),
    }));

    return (
      <div
        ref={hostRef}
        className={['uni-lexical-react', className].filter(Boolean).join(' ')}
        style={style}
      />
    );
  },
);

/**
 * Read-only live preview for UniLexical HTML.
 * Host element is not styled — import `unilexical/preview.css` for content styles.
 *
 * @example
 * ```tsx
 * <UniLexicalPreview html={html} />
 * <UniLexicalPreview editor={editor} />
 * ```
 */
export interface UniLexicalPreviewProps {
  /** Cleaned HTML string */
  html?: string;
  /** Live editor — auto-updates on change */
  editor?: UniEditor | null;
  className?: string;
  style?: CSSProperties;
}

export function UniLexicalPreview({
  html = '',
  editor = null,
  className,
  style,
}: UniLexicalPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<UniPreview | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const preview = new UniPreview(host, { className });
    previewRef.current = preview;

    return () => {
      preview.destroy();
      previewRef.current = null;
    };
    // className applied at construct; remount if class changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className]);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    if (editor) {
      return preview.bindEditor(editor);
    }
    preview.setHtml(html);
    return undefined;
  }, [editor, html]);

  return (
    <div
      ref={hostRef}
      className="uni-lexical-preview-host"
      style={style}
    />
  );
}

export default UniLexical;
export { UniEditor, createUniEditor };
export type {
  UniEditorConfig,
  ToolbarItemId,
  ToolbarState,
  ContentFormat,
  ImageOptions,
  SlashMenuItem,
};
