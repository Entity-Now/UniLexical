import { getCalloutIconSvg, normalizeCalloutIcon } from '../ui/calloutIcons';

/**
 * Normalize exported HTML so preview.css can style custom blocks reliably.
 * Safe to run on already-enhanced HTML (idempotent).
 */
export function enhanceHtmlForPreview(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<!DOCTYPE html><html><body>${html}</body></html>`,
      'text/html',
    );

    // ── Toggle ──────────────────────────────────────────────────────────
    doc.querySelectorAll('[data-uni-toggle]').forEach((el) => {
      el.classList.add('uni-toggle');
      if (!el.hasAttribute('data-open')) {
        el.setAttribute('data-open', 'true');
      }
    });

    // ── Callout / container ──────────────────────────────────────────────
    doc.querySelectorAll('[data-uni-container]').forEach((el) => {
      el.classList.add('uni-container');
      const variant = el.getAttribute('data-variant') || 'default';
      // clear previous variant classes then re-add
      [...el.classList]
        .filter((c) => c.startsWith('uni-container--'))
        .forEach((c) => el.classList.remove(c));
      el.classList.add(`uni-container--${variant}`);

      const iconId = normalizeCalloutIcon(el.getAttribute('data-icon'));
      el.setAttribute('data-icon', iconId);

      let badge = el.querySelector(':scope > .uni-container-icon') as HTMLElement | null;
      if (!badge) {
        badge = doc.createElement('span');
        badge.className = 'uni-container-icon';
        badge.setAttribute('data-uni-chrome', 'true');
        el.insertBefore(badge, el.firstChild);
      }
      badge.innerHTML = getCalloutIconSvg(iconId);
    });

    // ── DateTime ────────────────────────────────────────────────────────
    doc.querySelectorAll('[data-uni-datetime]').forEach((el) => {
      el.classList.add('uni-datetime');
    });

    // ── Images: wrap bare imgs that carry align/display, strip editor chrome ──
    doc
      .querySelectorAll(
        '.uni-image-resize-handle, .uni-image-spinner, .uni-image-loading .uni-image-spinner',
      )
      .forEach((el) => el.remove());

    doc.querySelectorAll('.uni-image-frame').forEach((frame) => {
      const img = frame.querySelector('img');
      const parent = frame.parentElement;
      if (img && parent) {
        parent.insertBefore(img, frame);
        frame.remove();
      }
    });

    // Promote wrap classes; ensure structure
    doc.querySelectorAll('[data-uni-image], .uni-image-wrap, .uni-image').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.tagName === 'IMG') return;
      el.classList.add('uni-image-wrap', 'uni-image');
      const align = el.getAttribute('data-align') || guessAlignFromClass(el) || 'left';
      const display = el.getAttribute('data-display') || guessDisplayFromClass(el) || 'block';
      el.setAttribute('data-align', align);
      el.setAttribute('data-display', display);
      el.classList.remove(
        'uni-image-align-left',
        'uni-image-align-center',
        'uni-image-align-right',
        'uni-image-display-block',
        'uni-image-display-inline',
      );
      el.classList.add(`uni-image-align-${align}`, `uni-image-display-${display}`);
      const img = el.querySelector('img');
      img?.classList.add('uni-image-el');
    });

    // Bare <img data-align> from older exports
    doc.querySelectorAll('img[data-align], img[data-display], img[data-uni-image]').forEach((node) => {
      const img = node as HTMLImageElement;
      if (img.closest('.uni-image-wrap, [data-uni-image]:not(img)')) {
        img.classList.add('uni-image-el');
        return;
      }
      const align = img.getAttribute('data-align') || 'left';
      const display = img.getAttribute('data-display') || 'block';
      const wrap = doc.createElement('div');
      wrap.className = `uni-image-wrap uni-image uni-image-align-${align} uni-image-display-${display}`;
      wrap.setAttribute('data-uni-image', 'true');
      wrap.setAttribute('data-align', align);
      wrap.setAttribute('data-display', display);
      if (img.hasAttribute('width')) {
        wrap.setAttribute('data-width', img.getAttribute('width') || '');
      }
      img.classList.add('uni-image-el');
      img.parentNode?.insertBefore(wrap, img);
      wrap.appendChild(img);
    });

    // Width from attribute
    doc.querySelectorAll('.uni-image-wrap img[width], [data-uni-image] img[width]').forEach((node) => {
      const img = node as HTMLImageElement;
      const w = img.getAttribute('width');
      if (w && !img.style.width) {
        img.style.width = `${w}px`;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      }
    });

    // ── HR ──────────────────────────────────────────────────────────────
    doc.querySelectorAll('hr').forEach((hr) => {
      hr.classList.add('uni-hr');
    });

    // ── Attachment ──────────────────────────────────────────────────────
    doc.querySelectorAll('a[download][data-uni-attachment], a.uni-attachment').forEach((a) => {
      a.classList.add('uni-attachment');
    });
    // bare download links without class
    doc.querySelectorAll('a[download]').forEach((a) => {
      if (!a.classList.contains('uni-attachment') && a.hasAttribute('download')) {
        a.classList.add('uni-attachment');
        a.setAttribute('data-uni-attachment', 'true');
      }
    });

    // ── Tables ──────────────────────────────────────────────────────────
    doc.querySelectorAll('table').forEach((table) => {
      table.classList.add('uni-table');
    });

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

function guessAlignFromClass(el: HTMLElement): string | null {
  if (el.classList.contains('uni-image-align-center')) return 'center';
  if (el.classList.contains('uni-image-align-right')) return 'right';
  if (el.classList.contains('uni-image-align-left')) return 'left';
  return null;
}

function guessDisplayFromClass(el: HTMLElement): string | null {
  if (el.classList.contains('uni-image-display-inline')) return 'inline';
  if (el.classList.contains('uni-image-display-block')) return 'block';
  return null;
}
