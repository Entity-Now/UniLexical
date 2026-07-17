import {
  $applyNodeReplacement,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical';
import {
  CALLOUT_ICON_IDS,
  getCalloutIconSvg,
  normalizeCalloutIcon,
  VARIANT_DEFAULT_ICON,
  type CalloutIconId,
} from '../ui/calloutIcons';

export type ContainerVariant =
  | 'default'
  | 'info'
  | 'warning'
  | 'success'
  | 'error'
  | 'gray';

export type SerializedContainerNode = Spread<
  {
    type: 'container';
    version: 3;
    /** Material-style icon id (e.g. lightbulb, info) — never emoji */
    icon: string;
    variant: ContainerVariant;
  },
  SerializedElementNode
>;

/** Stable icon ids for cycling / pickers */
export const CONTAINER_ICONS = CALLOUT_ICON_IDS;

export const CONTAINER_VARIANTS: Array<{
  id: ContainerVariant;
  label: string;
  color: string;
}> = [
  { id: 'default', label: 'Default', color: '#4f46e5' },
  { id: 'info', label: 'Info', color: '#2563eb' },
  { id: 'warning', label: 'Warning', color: '#d97706' },
  { id: 'success', label: 'Success', color: '#059669' },
  { id: 'error', label: 'Error', color: '#dc2626' },
  { id: 'gray', label: 'Gray', color: '#6b7280' },
];

/** Callout / container block with Material icon + color variant. */
export class ContainerNode extends ElementNode {
  __icon: CalloutIconId;
  __variant: ContainerVariant;

  static getType(): string {
    return 'container';
  }

  static clone(node: ContainerNode): ContainerNode {
    return new ContainerNode(node.__icon, node.__variant, node.__key);
  }

  constructor(
    icon: string = 'lightbulb',
    variant: ContainerVariant = 'default',
    key?: NodeKey,
  ) {
    super(key);
    this.__icon = normalizeCalloutIcon(icon);
    this.__variant = variant;
  }

  getIcon(): CalloutIconId {
    return this.getLatest().__icon;
  }

  getVariant(): ContainerVariant {
    return this.getLatest().__variant;
  }

  setIcon(icon: string): this {
    const w = this.getWritable();
    w.__icon = normalizeCalloutIcon(icon);
    return this;
  }

  setVariant(variant: ContainerVariant): this {
    const w = this.getWritable();
    w.__variant = variant;
    return this;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const theme = config.theme as { container?: string };
    const div = document.createElement('div');
    div.className = theme.container ?? 'uni-container';
    div.setAttribute('data-uni-container', 'true');
    div.setAttribute('data-variant', this.__variant);
    div.setAttribute('data-icon', this.__icon);
    this.paintChrome(div);
    return div;
  }

  updateDOM(prev: ContainerNode, dom: HTMLElement): boolean {
    if (prev.__icon !== this.__icon || prev.__variant !== this.__variant) {
      dom.setAttribute('data-variant', this.__variant);
      dom.setAttribute('data-icon', this.__icon);
      this.paintChrome(dom);
    }
    return false;
  }

  private paintChrome(dom: HTMLElement): void {
    let badge = dom.querySelector(':scope > .uni-container-icon') as HTMLButtonElement | null;
    if (!badge) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'uni-container-icon';
      badge.setAttribute('data-uni-chrome', 'true');
      badge.setAttribute('contenteditable', 'false');
      badge.title = 'Change icon (Shift+click: change style)';
      badge.setAttribute('aria-label', 'Change callout icon');
      dom.insertBefore(badge, dom.firstChild);
    }
    badge.innerHTML = getCalloutIconSvg(this.__icon);
    badge.dataset.icon = this.__icon;
    dom.className = `${(dom.className || '')
      .split(/\s+/)
      .filter((c) => c && !c.startsWith('uni-container--'))
      .join(' ')} uni-container uni-container--${this.__variant}`.trim();
  }

  exportDOM(): DOMExportOutput {
    const div = document.createElement('div');
    div.className = `uni-container uni-container--${this.__variant}`;
    div.setAttribute('data-uni-container', 'true');
    div.setAttribute('data-variant', this.__variant);
    div.setAttribute('data-icon', this.__icon);
    const badge = document.createElement('span');
    badge.className = 'uni-container-icon';
    badge.setAttribute('data-uni-chrome', 'true');
    badge.innerHTML = getCalloutIconSvg(this.__icon);
    div.appendChild(badge);
    return { element: div };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (dom) => {
        if (!dom.hasAttribute('data-uni-container')) return null;
        const icon = normalizeCalloutIcon(dom.getAttribute('data-icon'));
        const variant = (dom.getAttribute('data-variant') ||
          'default') as ContainerVariant;
        return {
          conversion: (): DOMConversionOutput => ({
            node: $createContainerNode({ icon, variant }),
          }),
          priority: 1,
        };
      },
    };
  }

  exportJSON(): SerializedContainerNode {
    return {
      ...super.exportJSON(),
      type: 'container',
      version: 3,
      icon: this.__icon,
      variant: this.__variant,
    };
  }

  static importJSON(json: SerializedContainerNode): ContainerNode {
    return $createContainerNode({
      icon: normalizeCalloutIcon(json.icon),
      variant: (json.variant as ContainerVariant) ?? 'default',
    });
  }

  canBeEmpty(): boolean {
    return false;
  }
}

export interface CreateContainerOptions {
  icon?: string;
  variant?: ContainerVariant;
}

export function $createContainerNode(
  options: CreateContainerOptions = {},
): ContainerNode {
  const variant = options.variant ?? 'default';
  const icon =
    options.icon ??
    VARIANT_DEFAULT_ICON[variant] ??
    'lightbulb';
  return $applyNodeReplacement(new ContainerNode(icon, variant));
}

export function $isContainerNode(
  node: LexicalNode | null | undefined,
): node is ContainerNode {
  return !!node && node.getType() === 'container';
}
