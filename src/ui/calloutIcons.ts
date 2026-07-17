/**
 * Callout / container icons — Material Design style outlined SVGs (currentColor).
 * Icon ids are stable serialization keys (not emoji).
 */

function svg(path: string): string {
  return `<svg fill="currentColor" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">${path}</svg>`;
}

export const CALLOUT_ICONS = {
  lightbulb: svg(
    '<path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>',
  ),
  info: svg(
    '<path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>',
  ),
  warning: svg(
    '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>',
  ),
  check_circle: svg(
    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-5.83-2.59-2.58L6 13l4 4 8-8-1.41-1.42z"/>',
  ),
  error: svg(
    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
  ),
  push_pin: svg(
    '<path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m-2-2H8c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1h-6z"/>',
  ),
  star: svg(
    '<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/>',
  ),
  notes: svg(
    '<path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/>',
  ),
  chat: svg(
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>',
  ),
  notifications: svg(
    '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>',
  ),
  inventory_2: svg(
    '<path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/>',
  ),
  help: svg(
    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm1.07-7.75-.9.92C12.45 9.9 12 10.5 12 12h2c0-.88.36-1.68.95-2.27l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2h2c0-.55.45-1 1-1s1 .45 1 1c0 .28-.11.53-.29.71z"/>',
  ),
  flag: svg(
    '<path d="M14 6v4H6v2h8v4l7-5-7-5zm-4-4H4v18h2v-6h4l1 2h9V4H11l-1 2z"/>',
  ),
  bookmark: svg(
    '<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z"/>',
  ),
  bolt: svg(
    '<path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>',
  ),
  favorite: svg(
    '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>',
  ),
} as const;

export type CalloutIconId = keyof typeof CALLOUT_ICONS;

export const CALLOUT_ICON_IDS = Object.keys(CALLOUT_ICONS) as CalloutIconId[];

export const VARIANT_DEFAULT_ICON: Record<string, CalloutIconId> = {
  default: 'lightbulb',
  info: 'info',
  warning: 'warning',
  success: 'check_circle',
  error: 'error',
  gray: 'push_pin',
};

export function isCalloutIconId(id: string): id is CalloutIconId {
  return id in CALLOUT_ICONS;
}

export function getCalloutIconSvg(id: string): string {
  if (isCalloutIconId(id)) return CALLOUT_ICONS[id];
  // Legacy emoji / unknown → lightbulb
  return CALLOUT_ICONS.lightbulb;
}

/** Map legacy emoji icons to material ids for migration */
export function normalizeCalloutIcon(icon: string | undefined | null): CalloutIconId {
  if (!icon) return 'lightbulb';
  if (isCalloutIconId(icon)) return icon;
  const emojiMap: Record<string, CalloutIconId> = {
    '💡': 'lightbulb',
    'ℹ️': 'info',
    '⚠': 'warning',
    '⚠️': 'warning',
    '✅': 'check_circle',
    '❌': 'error',
    '📌': 'push_pin',
    '⭐': 'star',
    '📝': 'notes',
    '💬': 'chat',
    '🔔': 'notifications',
    '📦': 'inventory_2',
    '❓': 'help',
    '🚀': 'bolt',
    '❤️': 'favorite',
    '🔥': 'bolt',
    '🎯': 'flag',
  };
  return emojiMap[icon] ?? 'lightbulb';
}
