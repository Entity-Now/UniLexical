import {
  buildIsoFromParts,
  toDateInputValue,
  toTimeInputValue,
} from '../nodes/DateTimeNode';

export interface DateTimePickerResult {
  datetime: string;
  includeTime: boolean;
}

/**
 * Lightweight popover for editing an inline date / datetime chip.
 */
export class DateTimePickerUI {
  private root: HTMLElement;
  private dateInput: HTMLInputElement;
  private timeInput: HTMLInputElement;
  private timeRow: HTMLElement;
  private includeTimeChk: HTMLInputElement;
  private onApply: ((result: DateTimePickerResult) => void) | null = null;
  private onDoc: ((e: PointerEvent) => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'uni-datetime-picker';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'uni-datetime-picker-title';
    title.textContent = 'Date & time';
    this.root.appendChild(title);

    const dateLabel = document.createElement('label');
    dateLabel.className = 'uni-datetime-picker-label';
    dateLabel.textContent = 'Date';
    this.dateInput = document.createElement('input');
    this.dateInput.type = 'date';
    this.dateInput.className = 'uni-datetime-picker-input';
    dateLabel.appendChild(this.dateInput);
    this.root.appendChild(dateLabel);

    this.timeRow = document.createElement('label');
    this.timeRow.className = 'uni-datetime-picker-label';
    this.timeRow.textContent = 'Time';
    this.timeInput = document.createElement('input');
    this.timeInput.type = 'time';
    this.timeInput.className = 'uni-datetime-picker-input';
    this.timeRow.appendChild(this.timeInput);
    this.root.appendChild(this.timeRow);

    const chkLabel = document.createElement('label');
    chkLabel.className = 'uni-datetime-picker-check';
    this.includeTimeChk = document.createElement('input');
    this.includeTimeChk.type = 'checkbox';
    chkLabel.appendChild(this.includeTimeChk);
    chkLabel.appendChild(document.createTextNode(' Include time'));
    this.root.appendChild(chkLabel);

    this.includeTimeChk.addEventListener('change', () => {
      this.timeRow.style.display = this.includeTimeChk.checked ? 'flex' : 'none';
    });

    const actions = document.createElement('div');
    actions.className = 'uni-datetime-picker-actions';

    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'uni-datetime-picker-btn';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      this.dateInput.value = toDateInputValue(now.toISOString());
      this.timeInput.value = toTimeInputValue(now.toISOString());
    });

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'uni-datetime-picker-btn uni-datetime-picker-btn-primary';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => this.apply());

    actions.appendChild(todayBtn);
    actions.appendChild(applyBtn);
    this.root.appendChild(actions);

    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(this.root);
  }

  open(
    anchor: DOMRect,
    current: { datetime: string; includeTime: boolean },
    onApply: (result: DateTimePickerResult) => void,
  ): void {
    this.onApply = onApply;
    this.dateInput.value = toDateInputValue(current.datetime);
    this.timeInput.value = toTimeInputValue(current.datetime);
    this.includeTimeChk.checked = current.includeTime;
    this.timeRow.style.display = current.includeTime ? 'flex' : 'none';

    this.root.style.display = 'block';
    const w = 260;
    let left = anchor.left;
    let top = anchor.bottom + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    if (top + 220 > window.innerHeight) {
      top = Math.max(8, anchor.top - 220);
    }
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;

    this.detachDoc();
    this.onDoc = (e: PointerEvent) => {
      if (this.root.contains(e.target as Node)) return;
      this.hide();
    };
    setTimeout(() => {
      if (this.onDoc) document.addEventListener('pointerdown', this.onDoc);
    }, 0);
  }

  private apply(): void {
    const includeTime = this.includeTimeChk.checked;
    const iso = buildIsoFromParts(
      this.dateInput.value,
      this.timeInput.value,
      includeTime,
    );
    this.onApply?.({ datetime: iso, includeTime });
    this.hide();
  }

  hide(): void {
    this.root.style.display = 'none';
    this.onApply = null;
    this.detachDoc();
  }

  private detachDoc(): void {
    if (this.onDoc) {
      document.removeEventListener('pointerdown', this.onDoc);
      this.onDoc = null;
    }
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }
}
