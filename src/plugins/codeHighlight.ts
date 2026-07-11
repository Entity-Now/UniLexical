import { registerCodeHighlighting } from '@lexical/code';
import type { LexicalEditor } from 'lexical';
import { createLowlight } from 'lowlight';

// Common languages (keep bundle reasonable)
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';

/** Mirror @lexical/code Tokenizer shape (not always re-exported from package root). */
interface Token {
  type: string;
  content: string | Token | (string | Token)[];
}

interface Tokenizer {
  defaultLanguage: string;
  tokenize(code: string, language?: string): (string | Token)[];
}

const lowlight = createLowlight({
  javascript,
  js: javascript,
  typescript,
  ts: typescript,
  tsx: typescript,
  jsx: javascript,
  xml,
  html: xml,
  css,
  json,
  bash,
  shell: bash,
  sh: bash,
  python,
  py: python,
  markdown,
  md: markdown,
  sql,
  java,
  go,
  rust,
});

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

/**
 * Convert lowlight/hast tree into Lexical/Prism-compatible tokens.
 */
function hastToTokens(nodes: HastNode[] | undefined): (string | Token)[] {
  if (!nodes) return [];
  const out: (string | Token)[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.value) out.push(node.value);
      continue;
    }
    if (node.type === 'element') {
      const classes = node.properties?.className ?? [];
      // highlight.js: "hljs-keyword" → "keyword"
      const type =
        classes
          .map((c) => c.replace(/^hljs-/, ''))
          .find((c) => c && c !== 'hljs') ?? 'plain';
      const content = hastToTokens(node.children);
      if (content.length === 1 && typeof content[0] === 'string') {
        out.push({ type, content: content[0] });
      } else if (content.length > 0) {
        out.push({ type, content });
      }
    }
  }
  return out;
}

export const LowlightTokenizer: Tokenizer = {
  defaultLanguage: 'javascript',
  tokenize(code: string, language = 'javascript'): (string | Token)[] {
    try {
      const lang = language || 'javascript';
      const registered = lowlight.listLanguages();
      if (registered.includes(lang)) {
        try {
          const tree = lowlight.highlight(lang, code) as unknown as HastNode;
          return hastToTokens(tree.children);
        } catch {
          /* fall through */
        }
      }
      const auto = lowlight.highlightAuto(code) as unknown as HastNode;
      return hastToTokens(auto.children);
    } catch {
      return [code];
    }
  },
};

/**
 * Register code highlighting powered by lowlight (highlight.js grammars).
 */
export function registerLowlightCodeHighlighting(editor: LexicalEditor): () => void {
  return registerCodeHighlighting(editor, LowlightTokenizer as never);
}

export { lowlight };
