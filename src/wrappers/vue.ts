import {
  defineComponent,
  shallowRef,
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  h,
  type PropType,
  type ShallowRef,
} from 'vue';
import { createUniEditor, UniEditor } from '../core/UniEditor';
import type {
  ContentFormat,
  ImageOptions,
  ToolbarItemId,
  ToolbarState,
  UniEditorConfig,
  SlashMenuItem,
} from '../core/types';
import { UniPreview } from '../preview/UniPreview';

/**
 * Vue 3 composable – keeps UniEditor in a shallowRef so Lexical
 * objects are never deep-proxied.
 */
export function useLexical(config: UniEditorConfig = {}) {
  const editorRef: ShallowRef<UniEditor | null> = shallowRef(null);
  const containerRef = ref<HTMLElement | null>(null);
  const toolbarState = ref<ToolbarState | null>(null);
  const ready = ref(false);

  onMounted(() => {
    if (!containerRef.value) return;
    const editor = createUniEditor(config);
    editorRef.value = editor;

    const unsubToolbar = editor.on('toolbarChange', (state) => {
      toolbarState.value = state;
    });
    const unsubReady = editor.on('ready', () => {
      ready.value = true;
    });

    editor.mount(containerRef.value);

    onBeforeUnmount(() => {
      unsubToolbar();
      unsubReady();
      editor.destroy();
      editorRef.value = null;
      ready.value = false;
    });
  });

  function getContent(format: ContentFormat = 'json'): string {
    return editorRef.value?.getContent(format) ?? '';
  }

  function setContent(content: string, format: ContentFormat = 'json'): void {
    editorRef.value?.setContent(content, format);
  }

  return {
    containerRef,
    editor: editorRef,
    toolbarState,
    ready,
    getContent,
    setContent,
    focus: () => editorRef.value?.focus(),
  };
}

/**
 * Vue 3 component wrapper.
 *
 * @example
 * ```vue
 * <UniLexical
 *   :toolbar-items="['bold', 'italic', 'underline']"
 *   :image-options="{ upload }"
 *   @change="onChange"
 * />
 * ```
 */
export const UniLexical = defineComponent({
  name: 'UniLexical',
  props: {
    toolbarItems: {
      type: Array as PropType<ToolbarItemId[]>,
      default: undefined,
    },
    imageOptions: {
      type: Object as PropType<ImageOptions>,
      default: undefined,
    },
    initialContent: {
      type: String,
      default: undefined,
    },
    initialFormat: {
      type: String as PropType<ContentFormat>,
      default: 'markdown',
    },
    placeholder: {
      type: String,
      default: undefined,
    },
    builtinUI: {
      type: Boolean,
      default: true,
    },
    editable: {
      type: Boolean,
      default: true,
    },
    slashItems: {
      type: Array as PropType<SlashMenuItem[]>,
      default: undefined,
    },
  },
  emits: {
    change: (_payload: { json: string; html: string; markdown: string }) => true,
    ready: (_editor: UniEditor) => true,
    toolbarChange: (_state: ToolbarState) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLElement | null>(null);
    const editorRef = shallowRef<UniEditor | null>(null);

    onMounted(() => {
      if (!containerRef.value) return;

      const config: UniEditorConfig = {
        toolbarItems: props.toolbarItems,
        imageOptions: props.imageOptions,
        initialContent: props.initialContent,
        initialFormat: props.initialFormat,
        placeholder: props.placeholder,
        builtinUI: props.builtinUI,
        editable: props.editable,
      };

      const editor = createUniEditor(config);
      editorRef.value = editor;

      if (props.slashItems) {
        editor.setSlashItems(props.slashItems);
      }

      editor.on('change', (payload) => emit('change', payload));
      editor.on('toolbarChange', (state) => emit('toolbarChange', state));
      editor.on('ready', () => emit('ready', editor));

      editor.mount(containerRef.value);
    });

    onBeforeUnmount(() => {
      editorRef.value?.destroy();
      editorRef.value = null;
    });

    watch(
      () => props.toolbarItems,
      (items) => {
        if (items && editorRef.value) {
          editorRef.value.setToolbarItems(items);
        }
      },
    );

    watch(
      () => props.editable,
      (editable) => {
        editorRef.value?.setEditable(!!editable);
      },
    );

    expose({
      editor: editorRef,
      getContent: (format: ContentFormat = 'json') =>
        editorRef.value?.getContent(format) ?? '',
      setContent: (content: string, format: ContentFormat = 'json') =>
        editorRef.value?.setContent(content, format),
      getHtml: () => editorRef.value?.getHtml() ?? '',
      getMarkdown: () => editorRef.value?.getMarkdown() ?? '',
      focus: () => editorRef.value?.focus(),
    });

    return () =>
      h('div', {
        ref: containerRef,
        class: 'uni-lexical-vue',
      });
  },
});

/**
 * Read-only live preview for UniLexical HTML.
 * Host element is not styled — import `unilexical/preview.css` for content styles.
 *
 * @example
 * ```vue
 * <UniLexicalPreview :html="html" />
 * <!-- or live from editor -->
 * <UniLexicalPreview :editor="editor" />
 * ```
 */
export const UniLexicalPreview = defineComponent({
  name: 'UniLexicalPreview',
  props: {
    /** Raw cleaned HTML (from editor.getHtml() / change payload) */
    html: {
      type: String,
      default: '',
    },
    /** Live editor instance — when set, auto-updates on `change` */
    editor: {
      type: Object as PropType<UniEditor | null>,
      default: null,
    },
    className: {
      type: String,
      default: undefined,
    },
  },
  setup(props) {
    const hostRef = ref<HTMLElement | null>(null);
    let preview: UniPreview | null = null;
    let unbind: (() => void) | null = null;

    onMounted(() => {
      if (!hostRef.value) return;
      preview = new UniPreview(hostRef.value, {
        className: props.className,
        html: props.html,
      });
      if (props.editor) {
        unbind = preview.bindEditor(props.editor);
      }
    });

    watch(
      () => props.html,
      (html) => {
        // When bound to an editor, change events drive updates; still allow prop override
        if (props.editor) return;
        preview?.setHtml(html ?? '');
      },
    );

    watch(
      () => props.editor,
      (editor) => {
        unbind?.();
        unbind = null;
        if (editor && preview) {
          unbind = preview.bindEditor(editor);
        } else if (preview) {
          preview.setHtml(props.html ?? '');
        }
      },
    );

    onBeforeUnmount(() => {
      unbind?.();
      preview?.destroy();
      preview = null;
    });

    return () =>
      h('div', {
        ref: hostRef,
        // No uni- chrome classes on host — only an inert wrapper for the consumer
        class: 'uni-lexical-preview-host',
      });
  },
});

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
