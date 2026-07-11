import { createApp, ref, shallowRef } from 'vue';
import { UniLexical, UniLexicalPreview } from '../../src/wrappers/vue';
import type { UniEditor } from '../../src/core/UniEditor';
import '../../src/ui/styles.css';
import '../../src/ui/preview.css';

const App = {
  components: { UniLexical, UniLexicalPreview },
  setup() {
    const source = ref('');
    const html = ref('');
    const editor = shallowRef<UniEditor | null>(null);
    const initialMd = `# Vue 3 + UniLexical

Only **bold**, *italic*, underline on the toolbar.

> Live preview updates as you type.
`;

    function onChange(payload: { markdown: string; html: string }) {
      source.value = payload.markdown;
      html.value = payload.html;
    }

    function onReady(ed: UniEditor) {
      editor.value = ed;
      html.value = ed.getHtml();
      console.log('[Vue] editor ready', ed);
    }

    return { source, html, editor, initialMd, onChange, onReady };
  },
  template: `
    <div style="max-width:820px;margin:32px auto;padding:0 16px;font-family:system-ui">
      <h1 style="font-size:1.5rem">UniLexical · Vue 3</h1>
      <p style="color:#64748b;font-size:14px">Editor + live Preview (content styles only).</p>
      <div style="display:flex;flex-direction:column;gap:24px">
        <div>
          <p style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px">Editor</p>
          <UniLexical
            :toolbar-items="['bold','italic','underline','divider','heading1','heading2','quote','bulletList','image','todo']"
            placeholder="Vue 3 封装示例…"
            :initial-content="initialMd"
            initial-format="markdown"
            @change="onChange"
            @ready="onReady"
          />
        </div>
        <div>
          <p style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px">Preview</p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;min-height:200px">
            <!-- Host has no library chrome; :html keeps it reactive -->
            <UniLexicalPreview :html="html" />
          </div>
        </div>
      </div>
    </div>
  `,
};

createApp(App).mount('#app');
