import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UniLexical, UniLexicalPreview } from '../../src/wrappers/react';
import '../../src/ui/styles.css';
import '../../src/ui/preview.css';

function App() {
  const [html, setHtml] = useState('');

  return (
    <div
      style={{
        maxWidth: 820,
        margin: '32px auto',
        padding: '0 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.5rem' }}>UniLexical · React</h1>
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Editor + live Preview (content styles only).
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: '0 0 8px',
            }}
          >
            Editor
          </p>
          <UniLexical
            toolbarItems={[
              'bold',
              'italic',
              'underline',
              'divider',
              'heading1',
              'heading2',
              'quote',
              'bulletList',
              'image',
              'todo',
            ]}
            placeholder="React 封装示例…"
            initialContent={
              '# React + UniLexical\n\nToolbar limited set.\n\n> Live preview updates as you type.\n'
            }
            initialFormat="markdown"
            onChange={({ html: next }) => setHtml(next)}
            onReady={(editor) => {
              setHtml(editor.getHtml());
              console.log('[React] ready', editor);
            }}
          />
        </div>
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: '0 0 8px',
            }}
          >
            Preview
          </p>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '16px 18px',
              minHeight: 200,
            }}
          >
            {/* Host has no library chrome */}
            <UniLexicalPreview html={html} />
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
