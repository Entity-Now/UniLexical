import { createEditor } from '../../src/index';
import '../../src/ui/styles.css';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  $createTextNode,
  INSERT_PARAGRAPH_COMMAND,
  KEY_SPACE_COMMAND,
} from 'lexical';
import { $isListNode, $isListItemNode } from '@lexical/list';
import { $createBlockWrapperNode } from '../../src/nodes/BlockWrapperNode';
import { $createSelectableParagraph, $safeSelectEnd } from '../../src/utils/selection';

const logEl = document.getElementById('log')!;
const logs: string[] = [];
function log(msg: string) {
  logs.push(msg);
  logEl.textContent = logs.join('\n');
  console.log(msg);
}

const editor = createEditor({ builtinUI: false, placeholder: 't' });
editor.mount(document.getElementById('editor')!);
const le = editor.getLexicalEditor();

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function resetWithText(text: string) {
  le.update(() => {
    $setSelection(null);
    const root = $getRoot();
    for (const c of root.getChildren()) c.remove();
    const block = $createBlockWrapperNode();
    const p = $createSelectableParagraph(text);
    block.append(p);
    root.append(block);
    $safeSelectEnd(p);
  });
}

function countLists() {
  return le.getEditorState().read(() => {
    const root = $getRoot();
    let lists = 0, lis = 0;
    root.getChildren().forEach((b) => {
      b.getChildren().forEach((c) => {
        if ($isListNode(c)) {
          lists++;
          lis += c.getChildrenSize();
        }
      });
    });
    const sel = $getSelection();
    let inLi = false;
    if ($isRangeSelection(sel)) {
      let n = sel.anchor.getNode();
      while (n) {
        if ($isListItemNode(n)) { inLi = true; break; }
        n = n.getParent()!;
      }
    }
    return { lists, lis, text: root.getTextContent(), inLi, blocks: root.getChildrenSize() };
  });
}

async function run() {
  let all = true;

  // Test A: type "-" then Enter (no list conversion)
  resetWithText('-');
  await wait(20);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(20);
  const a = countLists();
  const aOk = a.blocks >= 2 && a.text.includes('-');
  log(`A dash+Enter: ${JSON.stringify(a)} ok=${aOk}`);
  all = all && aOk;

  // Test B: "-" + Space → list, then type "x", Enter → 2 items
  resetWithText('-');
  await wait(20);
  // Simulate space shortcut: dispatch KEY_SPACE which our handler converts
  le.update(() => {
    // Ensure caret at end of "-"
    const root = $getRoot();
    const p = root.getFirstChild()?.getFirstChild();
    if (p) $safeSelectEnd(p as never);
  });
  await wait(20);
  const spaceHandled = le.dispatchCommand(KEY_SPACE_COMMAND, new KeyboardEvent('keydown', { key: ' ' }));
  await wait(30);
  const b1 = countLists();
  log(`B after space convert: ${JSON.stringify(b1)} handled=${spaceHandled}`);

  // Type into list
  le.update(() => {
    const sel = $getSelection();
    if ($isRangeSelection(sel)) sel.insertText('x');
  });
  await wait(20);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(20);
  const b2 = countLists();
  const bOk = b1.lists === 1 && b2.lis >= 2;
  log(`B list continue: ${JSON.stringify(b2)} ok=${bOk}`);
  all = all && bOk;

  // Test C: empty list item Enter → exit
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(20);
  const c = countLists();
  const cOk = c.lis >= 1 && c.lists >= 1 && !c.inLi;
  log(`C empty exit: ${JSON.stringify(c)} ok=${cOk}`);
  all = all && cOk;

  // Test D: "1." + Space → numbered list + Enter
  resetWithText('1.');
  await wait(20);
  le.update(() => {
    const root = $getRoot();
    const p = root.getFirstChild()?.getFirstChild();
    if (p) $safeSelectEnd(p as never);
  });
  await wait(20);
  le.dispatchCommand(KEY_SPACE_COMMAND, new KeyboardEvent('keydown', { key: ' ' }));
  await wait(30);
  le.update(() => {
    const sel = $getSelection();
    if ($isRangeSelection(sel)) sel.insertText('one');
  });
  await wait(20);
  le.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
  await wait(20);
  const d = countLists();
  const dOk = d.lis >= 2;
  log(`D numbered continue: ${JSON.stringify(d)} ok=${dOk}`);
  all = all && dOk;

  log(`\nALL ok=${all}`);
  (window as unknown as { __ok: boolean }).__ok = all;
}

run().catch((e) => {
  log(`FATAL ${e}`);
  console.error(e);
});
