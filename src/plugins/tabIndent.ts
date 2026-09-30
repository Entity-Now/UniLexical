import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  INDENT_CONTENT_COMMAND,
  INSERT_TAB_COMMAND,
  KEY_TAB_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { $isCodeNode } from '@lexical/code';
import { $isListItemNode, type ListItemNode } from '@lexical/list';
import { $isTableCellNode, $isTableNode } from '@lexical/table';

/**
 * Tab / Shift+Tab:
 * - list item → nest / un-nest (subset list)
 * - code block → insert a tab character
 * - elsewhere → indent / outdent the block
 *
 * Always consume Tab so the browser does not move focus to toolbar,
 * drag handles, callout buttons, or other chrome.
 *
 * Registered at NORMAL so @lexical/table (HIGH) still owns cell navigation.
 */
export function registerTabIndent(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    KEY_TAB_COMMAND,
    (event) => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      const anchor = selection.anchor.getNode();
      if ($isInsideTable(anchor)) return false;

      event.preventDefault();

      if ($isInsideCode(anchor)) {
        editor.dispatchCommand(INSERT_TAB_COMMAND, undefined);
        return true;
      }

      const listItem = $findListItem(anchor);
      if (listItem) {
        editor.dispatchCommand(
          event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
          undefined,
        );
        return true;
      }

      editor.dispatchCommand(
        event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
        undefined,
      );
      return true;
    },
    COMMAND_PRIORITY_NORMAL,
  );
}

function $findListItem(node: LexicalNode | null): ListItemNode | null {
  let current = node;
  while (current) {
    if ($isListItemNode(current)) return current;
    current = current.getParent();
  }
  return null;
}

function $isInsideTable(node: LexicalNode | null): boolean {
  let current = node;
  while (current) {
    if ($isTableCellNode(current) || $isTableNode(current)) return true;
    current = current.getParent();
  }
  return false;
}

function $isInsideCode(node: LexicalNode | null): boolean {
  let current = node;
  while (current) {
    if ($isCodeNode(current)) return true;
    current = current.getParent();
  }
  return false;
}
