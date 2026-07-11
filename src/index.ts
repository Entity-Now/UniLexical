// Core
export { UniEditor, createUniEditor } from './core/UniEditor';
export { EventEmitter } from './core/EventEmitter';
export { defaultTheme } from './core/theme';
export type {
  UniEditorConfig,
  UniEditorTheme,
  UniEditorEvents,
  ToolbarItemId,
  ToolbarState,
  ContentFormat,
  ImageOptions,
  ImageUploadHandler,
  AttachmentOptions,
  AttachmentUploadHandler,
  SlashMenuItem,
  SlashAction,
  SlashTriggerPayload,
  BlockHoverPayload,
  PastePayload,
  EventHandler,
  SerializeOptions,
} from './core/types';
export { DEFAULT_TOOLBAR_ITEMS, normalizeToolbarItemId } from './core/types';

// Nodes
export {
  BlockWrapperNode,
  $createBlockWrapperNode,
  $isBlockWrapperNode,
} from './nodes/BlockWrapperNode';
export {
  ImageNode,
  $createImageNode,
  $isImageNode,
} from './nodes/ImageNode';
export type { SerializedImageNode, ImageStatus, CreateImageNodeOptions } from './nodes/ImageNode';
export type { SerializedBlockWrapperNode } from './nodes/BlockWrapperNode';
export {
  HorizontalRuleNode,
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from './nodes/HorizontalRuleNode';
export {
  AttachmentNode,
  $createAttachmentNode,
  $isAttachmentNode,
} from './nodes/AttachmentNode';
export {
  ContainerNode,
  $createContainerNode,
  $isContainerNode,
} from './nodes/ContainerNode';

// Controllers
export { MarkdownShortcutsManager } from './plugins/MarkdownShortcutsManager';
export { SlashCommandController, DEFAULT_SLASH_ITEMS } from './plugins/SlashCommandController';
export { ToolbarController } from './plugins/ToolbarController';
export { BlockOverlayController } from './plugins/BlockOverlayController';
export type { BlockContentKind, BlockInfo } from './plugins/BlockOverlayController';
export { BlockMenuUI } from './ui/BlockMenuUI';
export { SerializationRegistry } from './plugins/SerializationRegistry';
export { ImageController } from './plugins/ImageController';
export { AttachmentController } from './plugins/AttachmentController';
export { registerEmptyBlockExit, $isEffectivelyEmpty } from './plugins/EmptyBlockExit';
export {
  registerPasteSupport,
  collectClipboardImageFiles,
} from './plugins/PasteController';

// UI helpers
export { TableGridPicker } from './ui/TableGridPicker';
export { attachTooltip, attachPopover, showFloatingContent } from './ui/tippy';
export { animateIn, animateOut, animateToolbarButtons } from './ui/motion';
export {
  MATERIAL_ICONS,
  TOOLBAR_ICON_MAP,
  getToolbarIconSvg,
  createToolbarIconEl,
} from './ui/icons';
export type { MaterialIconName } from './ui/icons';
export { LowlightTokenizer, registerLowlightCodeHighlighting } from './plugins/codeHighlight';

// Preview (read-only content renderer)
export { UniPreview, mountPreview } from './preview/UniPreview';
export type { UniPreviewOptions } from './preview/UniPreview';

// Vanilla wrapper
export { createEditor, mountEditor } from './wrappers/vanilla';
export type { VanillaEditorHandle, VanillaMountOptions } from './wrappers/vanilla';
