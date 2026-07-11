import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_SPACE_COMMAND,
  type LexicalEditor,
} from 'lexical';
import {
  $isListItemNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  insertList,
} from '@lexical/list';
import { mergeRegister } from '@lexical/utils';

/**
 * Checklist support missing from base registerList:
 * - INSERT_CHECK_LIST_COMMAND
 * - Click on checkbox (left edge of li) toggles checked
 * - Space toggles when focused on a check list item
 */
export function registerCheckList(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerCommand(
      INSERT_CHECK_LIST_COMMAND,
      () => {
        insertList(editor, 'check');
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),

    editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        if (!(event.target instanceof HTMLElement)) return false;

        const li = event.target.closest('li[role="checkbox"]') as HTMLElement | null;
        if (!li) return false;

        // Only treat clicks on the checkbox gutter (left ~22px) as toggle
        const rect = li.getBoundingClientRect();
        const gutter = 22;
        if (event.clientX > rect.left + gutter) return false;

        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(li);
          if ($isListItemNode(node)) {
            const parent = node.getParent();
            if ($isListNode(parent) && parent.getListType() === 'check') {
              node.toggleChecked();
            }
          }
        });
        event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),

    editor.registerCommand(
      KEY_SPACE_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchor = selection.anchor.getNode();
        let item = $isListItemNode(anchor) ? anchor : null;
        let p = anchor.getParent();
        while (p && !item) {
          if ($isListItemNode(p)) item = p;
          p = p.getParent();
        }
        if (!item) return false;

        const parent = item.getParent();
        if (!$isListNode(parent) || parent.getListType() !== 'check') return false;

        // Only toggle when caret is at the very start of the item
        if (selection.anchor.offset !== 0) return false;
        // And only if we're at the first text/element of the item
        const first = item.getFirstDescendant();
        if (first && !first.is(selection.anchor.getNode()) && selection.anchor.getNode() !== item) {
          // allow if selection is on item itself
          if (!$isElementNode(selection.anchor.getNode())) {
            const anchorParent = selection.anchor.getNode().getParent();
            if (anchorParent !== item && !item.isParentOf(selection.anchor.getNode())) {
              return false;
            }
          }
        }

        // Avoid toggling while typing mid-line — require empty-ish or explicit focus on checkbox
        // Use a looser rule: space at offset 0 of the list item content toggles
        const text = item.getTextContent();
        if (text.length > 0 && selection.anchor.offset === 0) {
          // If there's content, don't steal Space for typing at start… actually Notion
          // toggles only via click. Skip keyboard toggle when there's content.
          return false;
        }

        event?.preventDefault();
        editor.update(() => {
          item!.toggleChecked();
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
}
