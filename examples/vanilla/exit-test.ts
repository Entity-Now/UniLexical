import { createEditor } from '../../src/index';
import '../../src/ui/styles.css';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $setSelection,
  $createRangeSelection,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalEditor,
  type ElementNode,
} from 'lexical';
import {
  $createListNode,
  $createListItemNode,
  $isListNode,
  $isListItemNode,
} from '@lexical/list';
import {
  $createQuoteNode,
  $createHeadingNode,
  $isQuoteNode,
  $isHeadingNode,
} from '@lexical/rich-text';
import { $createBlockWrapperNode } from '../../src/nodes/BlockWrapperNode';

const logEl = document.getElementById('log')!;
const logs: string[] = [];
function log(msg: string) {
  logs.push(msg);
  logEl.textContent = logs.join('\n');
  console.log(msg);
}

const editor = createEditor({
  toolbarItems: ['bold', 'bulletList', 'numberedList', 'quote', 'heading1'],
  placeholder: 'test',
  builtinUI: false, // no UI chrome for unit test
});
editor.mount(document.getElementById('editor')!);

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Select the start of an element node without relying on prior selection */
function $selectElementStart(el: ElementNode) {
  const sel = $createRangeSelection();
  sel.anchor.set(el.getKey(), 0, 'element');
  sel.focus.set(el.getKey(), 0, 'element');
  $setSelection(sel);
}

function $selectElementEnd(el: ElementNode) {
  const sel = $createRangeSelection();
  const size = el.getChildrenSize();
  sel.anchor.set(el.getKey(), size, 'element');
  sel.focus.set(el.getKey(), size, 'element');
  $setSelection(sel);
}

function resetAndBuild(le: LexicalEditor, build: () => ElementNode | null) {
  le.update(
    () => {
      $setSelection(null);
      const root = $getRoot();
      const kids = root.getChildren();
      for (const k of kids) k.remove();

      const selectTarget = build();
      if (selectTarget && selectTarget.isAttached()) {
        $selectElementStart(selectTarget);
      }
    },
    { tag: 'uni-test-setup' },
  );
}

async function run() {
  const le = editor.getLexicalEditor();
  let allOk = true;

  // ── Test 1: list empty exit (3 items, last empty) ────────────────────
  resetAndBuild(le, () => {
    const root = $getRoot();
    const block = $createBlockWrapperNode();
    const list = $createListNode('bullet');

    const makeItem = (text: string) => {
      const item = $createListItemNode();
      const p = $createParagraphNode();
      if (text) p.append($createTextNode(text));
      item.append(p);
      return item;
    };

    list.append(makeItem('one'), makeItem('two'), makeItem(''));
    block.append(list);
    root.append(block);
    // Select the empty list item itself
    const emptyItem = list.getLastChild();
    return emptyItem && $isListItemNode(emptyItem) ? emptyItem : null;
  });
  await wait(40);

  const pre1 = le.getEditorState().read(() => {
    const root = $getRoot();
    const sel = $getSelection();
    let inEmptyLi = false;
    if ($isRangeSelection(sel)) {
      let n: ReturnType<typeof sel.anchor.getNode> | null = sel.anchor.getNode();
      while (n) {
        if ($isListItemNode(n) && n.getTextContent().trim() === '') {
          inEmptyLi = true;
          break;
        }
        n = n.getParent();
      }
    }
    let lis = 0;
    root.getChildren().forEach((b) =>
      b.getChildren().forEach((c) => {
        if ($isListNode(c)) lis += c.getChildrenSize();
      }),
    );
    return { text: root.getTextContent(), lis, inEmptyLi, blocks: root.getChildrenSize() };
  });
  log(`LIST pre: ${JSON.stringify(pre1)}`);

  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(40);

  const listResult = le.getEditorState().read(() => {
    const root = $getRoot();
    let lists = 0;
    let lis = 0;
    let paragraphs = 0;
    root.getChildren().forEach((b) => {
      b.getChildren().forEach((c) => {
        if ($isListNode(c)) {
          lists++;
          lis += c.getChildrenSize();
        }
        if (c.getType() === 'paragraph') paragraphs++;
      });
    });
    return {
      text: root.getTextContent(),
      lists,
      lis,
      paragraphs,
      blocks: root.getChildrenSize(),
    };
  });
  const listOk =
    listResult.lists === 1 &&
    listResult.lis === 2 &&
    listResult.paragraphs >= 1 &&
    listResult.text.includes('one') &&
    listResult.text.includes('two');
  log(`LIST EXIT: ${JSON.stringify(listResult)} ok=${listOk}`);
  allOk = allOk && listOk;

  // ── Test 2: sole empty list item ─────────────────────────────────────
  resetAndBuild(le, () => {
    const root = $getRoot();
    const block = $createBlockWrapperNode();
    const list = $createListNode('number');
    const item = $createListItemNode();
    item.append($createParagraphNode());
    list.append(item);
    block.append(list);
    root.append(block);
    return item;
  });
  await wait(40);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(40);

  const sole = le.getEditorState().read(() => {
    const root = $getRoot();
    let lists = 0;
    let paragraphs = 0;
    root.getChildren().forEach((b) => {
      b.getChildren().forEach((c) => {
        if ($isListNode(c)) lists++;
        if (c.getType() === 'paragraph') paragraphs++;
      });
    });
    return { lists, paragraphs, text: root.getTextContent() };
  });
  const soleOk = sole.lists === 0 && sole.paragraphs >= 1;
  log(`SOLE LIST EXIT: ${JSON.stringify(sole)} ok=${soleOk}`);
  allOk = allOk && soleOk;

  // ── Test 3: empty quote ──────────────────────────────────────────────
  resetAndBuild(le, () => {
    const root = $getRoot();
    const block = $createBlockWrapperNode();
    const quote = $createQuoteNode();
    block.append(quote);
    root.append(block);
    return quote;
  });
  await wait(40);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(40);

  const quoteResult = le.getEditorState().read(() => {
    const root = $getRoot();
    let quotes = 0;
    let paragraphs = 0;
    root.getChildren().forEach((b) => {
      b.getChildren().forEach((c) => {
        if ($isQuoteNode(c)) quotes++;
        if (c.getType() === 'paragraph') paragraphs++;
      });
    });
    return { quotes, paragraphs };
  });
  const quoteOk = quoteResult.quotes === 0 && quoteResult.paragraphs >= 1;
  log(`QUOTE EXIT: ${JSON.stringify(quoteResult)} ok=${quoteOk}`);
  allOk = allOk && quoteOk;

  // ── Test 4: empty heading ────────────────────────────────────────────
  resetAndBuild(le, () => {
    const root = $getRoot();
    const block = $createBlockWrapperNode();
    const h = $createHeadingNode('h1');
    block.append(h);
    root.append(block);
    return h;
  });
  await wait(40);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(40);

  const hResult = le.getEditorState().read(() => {
    const root = $getRoot();
    let headings = 0;
    let paragraphs = 0;
    root.getChildren().forEach((b) => {
      b.getChildren().forEach((c) => {
        if ($isHeadingNode(c)) headings++;
        if (c.getType() === 'paragraph') paragraphs++;
      });
    });
    return { headings, paragraphs };
  });
  const hOk = hResult.headings === 0 && hResult.paragraphs >= 1;
  log(`HEADING EMPTY EXIT: ${JSON.stringify(hResult)} ok=${hOk}`);
  allOk = allOk && hOk;

  // ── Test 5: non-empty heading enter ──────────────────────────────────
  resetAndBuild(le, () => {
    const root = $getRoot();
    const block = $createBlockWrapperNode();
    const h = $createHeadingNode('h1');
    h.append($createTextNode('Title'));
    block.append(h);
    root.append(block);
    $selectElementEnd(h);
    return null; // already selected
  });
  await wait(40);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(40);

  const h2 = le.getEditorState().read(() => {
    const root = $getRoot();
    return {
      blocks: root.getChildrenSize(),
      types: root.getChildren().map((b) => b.getFirstChild()?.getType()),
      text: root.getTextContent(),
    };
  });
  const h2Ok =
    h2.blocks >= 2 && h2.types.includes('heading') && h2.types.includes('paragraph');
  log(`HEADING+ENTER: ${JSON.stringify(h2)} ok=${h2Ok}`);
  allOk = allOk && h2Ok;

  // ── Test 6: non-empty list item keeps list ───────────────────────────
  resetAndBuild(le, () => {
    const root = $getRoot();
    const block = $createBlockWrapperNode();
    const list = $createListNode('number');
    const item = $createListItemNode();
    const p = $createParagraphNode();
    const t = $createTextNode('a');
    p.append(t);
    item.append(p);
    list.append(item);
    block.append(list);
    root.append(block);
    t.selectEnd();
    return null;
  });
  await wait(40);

  const preKeep = le.getEditorState().read(() => ({
    text: $getRoot().getTextContent(),
    hasList: $getRoot()
      .getChildren()
      .some((b) => b.getChildren().some($isListNode)),
  }));
  log(`LIST KEEP pre: ${JSON.stringify(preKeep)}`);

  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(40);

  const listKeep = le.getEditorState().read(() => {
    const root = $getRoot();
    let lis = 0;
    let lists = 0;
    root.getChildren().forEach((b) => {
      b.getChildren().forEach((c) => {
        if ($isListNode(c)) {
          lists++;
          lis += c.getChildrenSize();
        }
      });
    });
    return { lis, lists, text: root.getTextContent() };
  });
  const keepOk =
    listKeep.lists === 1 && listKeep.lis >= 2 && listKeep.text.includes('a');
  log(`LIST KEEP: ${JSON.stringify(listKeep)} ok=${keepOk}`);
  allOk = allOk && keepOk;

  log(`\nALL ok=${allOk}`);
  (window as unknown as { __exitTestOk: boolean }).__exitTestOk = allOk;
}

run().catch((e) => {
  log(`FATAL ${e}`);
  console.error(e);
});
