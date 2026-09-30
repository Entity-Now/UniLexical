import { getCalloutIconSvg, normalizeCalloutIcon } from '../ui/calloutIcons';
import { splitTableRow, isTableDividerRow } from './markdownTransformers';

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

    // ── Tables: fault-tolerant markdown table recovery & responsive wrapping ──
    recoverMarkdownTablesInHtml(doc);
    doc.querySelectorAll('table').forEach((table) => {
      table.classList.add('uni-table');
      table.querySelectorAll('th').forEach((th) => th.classList.add('uni-table-cell-header'));
      table.querySelectorAll('td').forEach((td) => td.classList.add('uni-table-cell'));

      const parent = table.parentElement;
      if (!parent?.classList.contains('uni-table-wrapper')) {
        const wrapper = doc.createElement('div');
        wrapper.className = 'uni-table-wrapper';
        parent?.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });

    // ── Code tabs initialization ─────────────────────────────────────
    doc.querySelectorAll('.code-tabs-wrapper').forEach((wrapper) => {
      const activeBtn = wrapper.querySelector('.code-tab-btn.active');
      if (!activeBtn) {
        const firstBtn = wrapper.querySelector('.code-tab-btn');
        firstBtn?.classList.add('active');
        const firstPanel = wrapper.querySelector('.code-tab-panel');
        firstPanel?.classList.add('active');
      }
    });

    // ── Mermaid Diagram Blocks ─────────────────────────────────────────
    doc
      .querySelectorAll(
        'pre[data-highlight-language="mermaid"], pre[data-language="mermaid"], pre.language-mermaid, pre.uni-code-block[data-highlight-language="mermaid"]',
      )
      .forEach((target) => {
        const pre = (target.tagName === 'PRE' ? target : target.closest('pre')) as HTMLElement | null;
        if (!pre || pre.closest('.mermaid-diagram-block')) return;

        const wrap = doc.createElement('div');
        wrap.className = 'mermaid-diagram-block';
        const header = doc.createElement('div');
        header.className = 'mermaid-header';
        header.innerHTML =
          '<span class="mermaid-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> Mermaid Diagram</span>';

        const newPre = doc.createElement('pre');
        newPre.className = 'mermaid';
        newPre.textContent = pre.textContent?.trim() || '';

        wrap.appendChild(header);
        wrap.appendChild(newPre);
        pre.parentNode?.replaceChild(wrap, pre);
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

/**
 * Fault-tolerant markdown table recovery:
 * Detects damaged/unrendered markdown table paragraphs (e.g. from previously saved documents
 * where tables degraded into paragraphs) and reconstructs them into semantic HTML <table>.
 */
function recoverMarkdownTablesInHtml(doc: Document): void {
  // 1. Recover single <p> elements containing multiple rows separated by <br>
  doc.querySelectorAll('p').forEach((p) => {
    const rawHtml = p.innerHTML;
    if (rawHtml.includes('<br') && rawHtml.includes('|')) {
      const lines = rawHtml
        .split(/<br\s*\/?>/i)
        .map((l) => l.replace(/<\/?[^>]+(>|$)/g, '').trim())
        .filter(Boolean);
      if (lines.length >= 2 && lines[0].includes('|') && isTableDividerRow(lines[1])) {
        const table = buildTableFromMarkdownRows(doc, lines);
        p.parentNode?.replaceChild(table, p);
      }
    }
  });

  // 2. Recover multiple consecutive <p> elements that each represent a table row
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  let i = 0;
  while (i < paragraphs.length) {
    const p = paragraphs[i];
    const text = (p.textContent || '').trim();
    if (text.includes('|') && i + 1 < paragraphs.length) {
      const nextText = (paragraphs[i + 1].textContent || '').trim();
      if (isTableDividerRow(nextText)) {
        const tablePs = [p, paragraphs[i + 1]];
        let j = i + 2;
        while (j < paragraphs.length) {
          const rowText = (paragraphs[j].textContent || '').trim();
          if (!rowText || !rowText.includes('|')) break;
          tablePs.push(paragraphs[j]);
          j++;
        }
        const rowStrings = tablePs.map((el) => (el.textContent || '').trim());
        const table = buildTableFromMarkdownRows(doc, rowStrings);
        p.parentNode?.insertBefore(table, p);
        tablePs.forEach((el) => el.remove());
        i = j;
        continue;
      }
    }
    i++;
  }
}

function renderInlineMarkdownToHtml(text: string): string {
  return text
    .replace(/\\\|/g, '&#124;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/&#124;/g, '|');
}

function buildTableFromMarkdownRows(doc: Document, rows: string[]): HTMLTableElement {
  const table = doc.createElement('table');
  table.className = 'uni-table';
  const thead = doc.createElement('thead');
  const tbody = doc.createElement('tbody');

  const headerCells = splitTableRow(rows[0]);
  const dividerCells = splitTableRow(rows[1]);
  const alignments = dividerCells.map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });

  const trHead = doc.createElement('tr');
  headerCells.forEach((c, idx) => {
    const th = doc.createElement('th');
    th.className = 'uni-table-cell-header';
    th.innerHTML = renderInlineMarkdownToHtml(c);
    if (alignments[idx] && alignments[idx] !== 'left') {
      th.style.textAlign = alignments[idx];
    }
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  for (let r = 2; r < rows.length; r++) {
    const tr = doc.createElement('tr');
    const cells = splitTableRow(rows[r]);
    for (let c = 0; c < headerCells.length; c++) {
      const td = doc.createElement('td');
      td.className = 'uni-table-cell';
      td.innerHTML = renderInlineMarkdownToHtml(cells[c] || '');
      if (alignments[c] && alignments[c] !== 'left') {
        td.style.textAlign = alignments[c];
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}
