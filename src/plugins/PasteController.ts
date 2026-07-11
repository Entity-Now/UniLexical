import {
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { DRAG_DROP_PASTE, eventFiles } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import type { EventEmitter } from '../core/EventEmitter';
import type { PastePayload } from '../core/types';
import type { ImageController } from './ImageController';
import type { AttachmentController } from './AttachmentController';

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name);
}

/**
 * Collect image files from a ClipboardEvent / DataTransfer.
 * Covers:
 * - OS file paste (clipboardData.files)
 * - Screenshot / web image paste (clipboardData.items kind=file)
 */
export function collectClipboardImageFiles(
  dataTransfer: DataTransfer | null | undefined,
): File[] {
  if (!dataTransfer) return [];

  const out: File[] = [];
  const seen = new Set<string>();

  const push = (file: File | null) => {
    if (!file || !isImageFile(file)) return;
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  // items first (screenshots often only appear here)
  if (dataTransfer.items) {
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        push(item.getAsFile());
      }
    }
  }

  if (dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      push(dataTransfer.files[i]);
    }
  }

  return out;
}

function htmlLooksLikeImageOnly(html: string): boolean {
  if (!html || !/<img[\s>]/i.test(html)) return false;
  const stripped = html
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<\/?meta[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return stripped.length === 0;
}

/**
 * Paste / drop media support:
 * - Ctrl/Cmd+V image files & screenshots → ImageController
 * - Drag-drop files (DRAG_DROP_PASTE from @lexical/rich-text)
 * - Emits `paste` on the event bus for external monitors
 */
export function registerPasteSupport(
  editor: LexicalEditor,
  emitter: EventEmitter,
  images: ImageController,
  attachments?: AttachmentController,
): () => void {
  const handleImageFiles = (files: File[]): boolean => {
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) return false;

    // Capture selection once, then insert sequentially (avoids races)
    images.captureSelectionForInsert();

    void (async () => {
      for (const file of imageFiles) {
        try {
          // Each insert snapshots the trailing empty block for the next one
          images.captureSelectionForInsert();
          await images.insertFile(file);
        } catch (err) {
          console.error('[UniLexical] paste image failed', err);
        }
      }
    })();

    emitter.emit('paste', {
      kind: 'image',
      files: imageFiles.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })),
      count: imageFiles.length,
    } satisfies PastePayload);

    return true;
  };

  const handleOtherFiles = (files: File[]): boolean => {
    if (!attachments || files.length === 0) return false;
    const nonImages = files.filter((f) => !isImageFile(f));
    if (nonImages.length === 0) return false;

    void (async () => {
      for (const file of nonImages) {
        try {
          await attachments.insertFile(file);
        } catch (err) {
          console.error('[UniLexical] paste attachment failed', err);
        }
      }
    })();

    emitter.emit('paste', {
      kind: 'file',
      files: nonImages.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })),
      count: nonImages.length,
    } satisfies PastePayload);

    return true;
  };

  return mergeRegister(
    // Rich-text paste/drop of pure file lists dispatches this
    editor.registerCommand(
      DRAG_DROP_PASTE,
      (files: Array<File>) => {
        if (handleImageFiles(files)) return true;
        if (handleOtherFiles(files)) return true;
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),

    // Ctrl/Cmd+V — intercept image clipboard items (screenshots, copied images)
    editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        // Lexical may pass ClipboardEvent, or null for some keyboard paths
        const dt =
          event &&
          typeof event === 'object' &&
          'clipboardData' in event &&
          (event as ClipboardEvent).clipboardData
            ? (event as ClipboardEvent).clipboardData
            : null;

        if (!dt) return false;

        const imageFiles = collectClipboardImageFiles(dt);
        // eventFiles only works for real ClipboardEvent/DragEvent instances
        let rawFiles: File[] = [];
        let hasTextContent = false;
        try {
          if (event instanceof ClipboardEvent || event instanceof DragEvent) {
            const parsed = eventFiles(event);
            rawFiles = parsed[1];
            hasTextContent = parsed[2];
          } else {
            rawFiles = Array.from(dt.files ?? []);
            hasTextContent =
              dt.types.includes('text/html') || dt.types.includes('text/plain');
          }
        } catch {
          rawFiles = Array.from(dt.files ?? []);
        }

        let plain = '';
        let html = '';
        try {
          plain = (dt.getData('text/plain') ?? '').trim();
          html = dt.getData('text/html') ?? '';
        } catch {
          /* some synthetic DataTransfers throw on getData */
        }

        // 1) Clipboard image bytes (screenshot / copy image) with no real text
        if (imageFiles.length > 0) {
          const textIsTrivial = !plain || plain.length < 2;
          const imageOnlyHtml = htmlLooksLikeImageOnly(html);
          // Prefer images when clipboard is media-centric
          if (textIsTrivial || imageOnlyHtml || !hasTextContent) {
            if (event && typeof (event as Event).preventDefault === 'function') {
              (event as Event).preventDefault();
            }
            handleImageFiles(imageFiles);
            return true;
          }
        }

        // 2) File list paste without text (Finder/Explorer copy file)
        if (rawFiles.length > 0 && !hasTextContent) {
          if (event && typeof (event as Event).preventDefault === 'function') {
            (event as Event).preventDefault();
          }
          if (handleImageFiles(rawFiles)) return true;
          if (handleOtherFiles(rawFiles)) return true;
        }

        // 3) Regular text/html paste — let @lexical/rich-text handle;
        //    ImageNode.importDOM will pick up <img> tags in HTML.
        if (plain || html) {
          emitter.emit('paste', {
            kind: 'text',
            files: [],
            count: 0,
            hasHtml: !!html,
            textLength: plain.length,
          } satisfies PastePayload);
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
  );
}
