import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  DecoratorNode,
} from 'lexical';

export type SerializedDateTimeNode = Spread<
  {
    datetime: string;
    includeTime: boolean;
    type: 'datetime';
    version: 1;
  },
  SerializedLexicalNode
>;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format ISO datetime for display chip */
export function formatDateTimeLabel(iso: string, includeTime: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || 'Invalid date';
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  if (!includeTime) return `${y}-${m}-${day}`;
  return `${y}-${m}-${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '00:00';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Inline date / datetime chip (Notion-style).
 * Vanilla DecoratorNode — UI owned by createDOM/updateDOM.
 */
export class DateTimeNode extends DecoratorNode<null> {
  __datetime: string;
  __includeTime: boolean;

  static getType(): string {
    return 'datetime';
  }

  static clone(node: DateTimeNode): DateTimeNode {
    return new DateTimeNode(node.__datetime, node.__includeTime, node.__key);
  }

  constructor(datetime: string, includeTime = false, key?: NodeKey) {
    super(key);
    this.__datetime = datetime;
    this.__includeTime = includeTime;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const theme = config.theme as { datetime?: string };
    const span = document.createElement('span');
    span.className = theme.datetime ?? 'uni-datetime';
    span.contentEditable = 'false';
    span.setAttribute('data-uni-datetime', 'true');
    span.setAttribute('data-lexical-decorator', 'true');
    span.setAttribute('data-include-time', this.__includeTime ? 'true' : 'false');
    span.setAttribute('data-datetime', this.__datetime);
    span.tabIndex = 0;
    span.setAttribute('role', 'button');
    span.title = 'Click to edit date';
    this.paint(span);
    return span;
  }

  updateDOM(prev: DateTimeNode, dom: HTMLElement): boolean {
    if (
      prev.__datetime !== this.__datetime ||
      prev.__includeTime !== this.__includeTime
    ) {
      dom.setAttribute('data-datetime', this.__datetime);
      dom.setAttribute('data-include-time', this.__includeTime ? 'true' : 'false');
      this.paint(dom);
    }
    return false;
  }

  private paint(el: HTMLElement): void {
    el.textContent = formatDateTimeLabel(this.__datetime, this.__includeTime);
  }

  exportDOM(): DOMExportOutput {
    const time = document.createElement('time');
    time.className = 'uni-datetime';
    time.setAttribute('datetime', this.__datetime);
    time.setAttribute('data-uni-datetime', 'true');
    time.setAttribute('data-datetime', this.__datetime);
    if (this.__includeTime) time.setAttribute('data-include-time', 'true');
    time.textContent = formatDateTimeLabel(this.__datetime, this.__includeTime);
    return { element: time };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      time: () => ({
        conversion: (dom): DOMConversionOutput | null => {
          if (!(dom instanceof HTMLElement)) return null;
          if (!dom.hasAttribute('data-uni-datetime') && !dom.hasAttribute('datetime')) {
            return null;
          }
          const iso =
            dom.getAttribute('datetime') ||
            dom.getAttribute('data-datetime') ||
            new Date().toISOString();
          const includeTime =
            dom.getAttribute('data-include-time') === 'true' ||
            (iso.includes('T') && !/T00:00(:00)?/.test(iso));
          return { node: $createDateTimeNode(iso, includeTime) };
        },
        priority: 2,
      }),
      span: () => ({
        conversion: (dom): DOMConversionOutput | null => {
          if (!(dom instanceof HTMLElement) || !dom.hasAttribute('data-uni-datetime')) {
            return null;
          }
          const iso =
            dom.getAttribute('data-datetime') ||
            dom.getAttribute('datetime') ||
            new Date().toISOString();
          const includeTime = dom.getAttribute('data-include-time') === 'true';
          return { node: $createDateTimeNode(iso, includeTime) };
        },
        priority: 2,
      }),
    };
  }

  exportJSON(): SerializedDateTimeNode {
    return {
      datetime: this.__datetime,
      includeTime: this.__includeTime,
      type: 'datetime',
      version: 1,
    };
  }

  static importJSON(json: SerializedDateTimeNode): DateTimeNode {
    return $createDateTimeNode(json.datetime, !!json.includeTime);
  }

  getDateTime(): string {
    return this.getLatest().__datetime;
  }

  getIncludeTime(): boolean {
    return this.getLatest().__includeTime;
  }

  setDateTime(iso: string): this {
    const w = this.getWritable();
    w.__datetime = iso;
    return this;
  }

  setIncludeTime(includeTime: boolean): this {
    const w = this.getWritable();
    w.__includeTime = includeTime;
    return this;
  }

  getTextContent(): string {
    return formatDateTimeLabel(this.__datetime, this.__includeTime);
  }

  decorate(): null {
    return null;
  }

  isInline(): true {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }
}

export function $createDateTimeNode(
  datetime?: string,
  includeTime = false,
): DateTimeNode {
  const iso = datetime ?? new Date().toISOString();
  return $applyNodeReplacement(new DateTimeNode(iso, includeTime));
}

export function $isDateTimeNode(
  node: LexicalNode | null | undefined,
): node is DateTimeNode {
  return !!node && node.getType() === 'datetime';
}

/** Build ISO from date (+ optional time) local inputs */
export function buildIsoFromParts(
  dateStr: string,
  timeStr: string | null,
  includeTime: boolean,
): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  if (!includeTime || !timeStr) {
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  }
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).toISOString();
}
