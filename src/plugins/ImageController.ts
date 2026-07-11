import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import type { ImageOptions } from '../core/types';
import { $createImageNode, $isImageNode, type ImageNode } from '../nodes/ImageNode';
import {
  $createBlockWrapperNode,
  $isBlockWrapperNode,
  type BlockWrapperNode,
} from '../nodes/BlockWrapperNode';
import { $getBlockWrapper } from './blockTransform';

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * ImageController – insert images with optional async upload.
 * Default (no upload callback): embed as base64 data URL.
 */
export class ImageController {
  private fileInput: HTMLInputElement | null = null;
  private options: ImageOptions;
  private pendingBlockKey: NodeKey | null = null;

  constructor(
    private editor: LexicalEditor,
    options: ImageOptions = {},
  ) {
    this.options = options;
  }

  setOptions(options: ImageOptions): void {
    this.options = options;
  }

  /**
   * Snapshot the block under the caret so async FileReader/paste still
   * inserts next to the right place after focus shifts.
   */
  captureSelectionForInsert(): void {
    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const block = $getBlockWrapper(selection.anchor.getNode());
        this.pendingBlockKey = block?.getKey() ?? null;
      } else {
        this.pendingBlockKey = null;
      }
    });
  }

  requestUpload(): void {
    this.captureSelectionForInsert();

    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.accept = this.options.accept ?? 'image/*';
      this.fileInput.style.display = 'none';
      document.body.appendChild(this.fileInput);
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput?.files?.[0];
        if (file) void this.insertFile(file).catch((err) => {
          console.error('[UniLexical] image insert failed', err);
        });
        if (this.fileInput) this.fileInput.value = '';
      });
    }
    this.fileInput.accept = this.options.accept ?? 'image/*';
    this.fileInput.click();
  }

  async insertFile(file: File): Promise<void> {
    if (this.options.maxSize && file.size > this.options.maxSize) {
      throw new Error(
        `Image exceeds max size of ${this.options.maxSize} bytes (got ${file.size})`,
      );
    }

    // Prefer base64 immediately when no custom upload — no blob revoke race
    let src: string;
    let status: 'loading' | 'ready' = 'ready';

    if (this.options.upload) {
      // Show blob preview while uploading
      src = URL.createObjectURL(file);
      status = 'loading';
    } else {
      src = await readFileAsDataURL(file);
      status = 'ready';
    }

    const targetBlockKey = this.pendingBlockKey;
    this.pendingBlockKey = null;
    let nodeKey: string | null = null;

    try {
      // discrete: true — FileReader resolves outside Lexical's update batch;
      // without discrete, nested/async updates can be dropped after heavy edits.
      this.editor.update(
        () => {
          // Clear selection BEFORE structural surgery so Lexical doesn't throw
          // "selection has been lost because the previously selected nodes have been removed"
          $setSelection(null);
          const imageNode = $createImageNode({
            src,
            alt: file.name || 'image',
            status,
          });
          nodeKey = imageNode.getKey();
          this.insertImageNode(imageNode, targetBlockKey);
        },
        { tag: 'uni-image-insert', discrete: true },
      );
    } catch (err) {
      console.error('[UniLexical] image insert update failed', err);
      throw err;
    }

    // Focus editor after insert so the new image is visible / caret is after it
    queueMicrotask(() => {
      try {
        this.editor.focus();
      } catch {
        /* ignore */
      }
    });

    if (this.options.upload) {
      try {
        const finalSrc = await this.options.upload(file);
        this.editor.update(() => {
          if (!nodeKey) return;
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            // Revoke blob only after DOM has the final URL
            const prev = node.getSrc();
            node.setSrc(finalSrc);
            node.setStatus('ready');
            if (prev.startsWith('blob:')) {
              try {
                URL.revokeObjectURL(prev);
              } catch {
                /* ignore */
              }
            }
          }
        });
      } catch (err) {
        this.editor.update(() => {
          if (!nodeKey) return;
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            node.setStatus('error');
          }
        });
        throw err;
      }
    }
  }

  insertFromUrl(src: string, alt = ''): void {
    // Capture block key BEFORE clearing selection
    let blockKey: NodeKey | null = null;
    this.editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        try {
          blockKey = $getBlockWrapper(selection.anchor.getNode())?.getKey() ?? null;
        } catch {
          blockKey = null;
        }
      }
    });

    this.editor.update(
      () => {
        $setSelection(null);
        const imageNode = $createImageNode({ src, alt, status: 'ready' });
        this.insertImageNode(imageNode, blockKey);
      },
      { tag: 'uni-image-insert', discrete: true },
    );
  }

  private insertImageNode(imageNode: ImageNode, preferredBlockKey: NodeKey | null): void {
    const root = $getRoot();

    let block: BlockWrapperNode | null = null;
    if (preferredBlockKey) {
      const n = $getNodeByKey(preferredBlockKey);
      if ($isBlockWrapperNode(n) && n.isAttached()) {
        block = n;
      } else if (n?.isAttached()) {
        block = $getBlockWrapper(n);
      }
    }

    // Selection was cleared by caller; still try last-known selection fallback
    if (!block) {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        try {
          const n = selection.anchor.getNode();
          if (n.isAttached()) block = $getBlockWrapper(n);
        } catch {
          block = null;
        }
      }
    }

    if (!block) {
      const children = root.getChildren();
      for (let i = children.length - 1; i >= 0; i--) {
        const c = children[i];
        if ($isBlockWrapperNode(c) && c.isAttached()) {
          block = c;
          break;
        }
      }
    }

    // Trailing paragraph so the user can keep typing after the image
    const after = $createBlockWrapperNode();
    const p = $createParagraphNode();
    const t = $createTextNode('');
    p.append(t);
    after.append(p);

    const imageWrap = $createBlockWrapperNode();
    imageWrap.append(imageNode);

    if (block && block.isAttached()) {
      const text = block
        .getTextContent()
        .replace(/[\u200B\u00A0]/g, '')
        .trim();
      const onlySlash = /^\/[^\n]*$/.test(text);

      if (!text || onlySlash) {
        // Empty (or leftover slash query) block → put image in this block
        // Replace the whole block content atomically (avoid remove-all selection bugs)
        const existing = block.getChildren();
        if (existing.length === 1) {
          existing[0].replace(imageNode);
        } else if (existing.length === 0) {
          block.append(imageNode);
        } else {
          const first = existing[0];
          first.replace(imageNode);
          for (let i = 1; i < existing.length; i++) {
            if (existing[i].isAttached()) existing[i].remove();
          }
        }
        if (block.getParent()) {
          block.insertAfter(after);
        } else {
          root.append(after);
        }
      } else {
        // Non-empty → image on a new block after the current one
        if (block.getParent()) {
          block.insertAfter(imageWrap);
          imageWrap.insertAfter(after);
        } else {
          root.append(imageWrap);
          root.append(after);
        }
      }
    } else {
      root.append(imageWrap);
      root.append(after);
    }

    t.select(0, 0);
  }

  destroy(): void {
    this.fileInput?.remove();
    this.fileInput = null;
  }
}
