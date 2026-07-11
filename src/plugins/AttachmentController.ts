import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import type { AttachmentOptions } from '../core/types';
import { $createAttachmentNode } from '../nodes/AttachmentNode';
import { $createBlockWrapperNode } from '../nodes/BlockWrapperNode';
import { $getBlockWrapper } from './blockTransform';

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export class AttachmentController {
  private fileInput: HTMLInputElement | null = null;
  private options: AttachmentOptions;

  constructor(
    private editor: LexicalEditor,
    options: AttachmentOptions = {},
  ) {
    this.options = options;
  }

  setOptions(options: AttachmentOptions): void {
    this.options = options;
  }

  requestUpload(): void {
    if (!this.fileInput) {
      this.fileInput = document.createElement('input');
      this.fileInput.type = 'file';
      this.fileInput.style.display = 'none';
      document.body.appendChild(this.fileInput);
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput?.files?.[0];
        if (file) void this.insertFile(file);
        if (this.fileInput) this.fileInput.value = '';
      });
    }
    this.fileInput.accept = this.options.accept ?? '*/*';
    this.fileInput.click();
  }

  async insertFile(file: File): Promise<void> {
    if (this.options.maxSize && file.size > this.options.maxSize) {
      throw new Error(`File exceeds max size of ${this.options.maxSize} bytes`);
    }

    let src: string;
    let name = file.name;
    if (this.options.upload) {
      const res = await this.options.upload(file);
      src = res.url;
      name = res.name ?? file.name;
    } else {
      src = await readFileAsDataURL(file);
    }

    this.editor.update(() => {
      const node = $createAttachmentNode({ src, name, size: file.size });
      const wrap = $createBlockWrapperNode();
      wrap.append(node);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const block = $getBlockWrapper(selection.anchor.getNode());
        if (block) {
          block.insertAfter(wrap);
          const after = $createBlockWrapperNode();
          after.append($createParagraphNode());
          wrap.insertAfter(after);
          after.selectStart();
          return;
        }
      }
      $getRoot().append(wrap);
    });
  }

  destroy(): void {
    this.fileInput?.remove();
    this.fileInput = null;
  }
}
