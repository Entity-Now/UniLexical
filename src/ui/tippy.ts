import tippy, { type Instance, type Props, type Content } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';

const BASE: Partial<Props> = {
  theme: 'unilexical',
  animation: 'shift-away',
  duration: [160, 120],
  arrow: true,
  appendTo: () => document.body,
  zIndex: 10050,
};

/**
 * Simple tooltip for toolbar buttons / icon chrome.
 */
export function attachTooltip(
  el: Element,
  content: string,
  opts: Partial<Props> = {},
): Instance {
  return tippy(el, {
    ...BASE,
    content,
    delay: [280, 60],
    placement: 'bottom',
    touch: ['hold', 400],
    ...opts,
  });
}

/**
 * Interactive popover (dropdown, color panel, emoji, table picker).
 */
export function attachPopover(
  el: Element,
  content: Content,
  opts: Partial<Props> = {},
): Instance {
  return tippy(el, {
    ...BASE,
    content,
    interactive: true,
    trigger: 'click',
    placement: 'bottom-start',
    maxWidth: 'none',
    offset: [0, 6],
    hideOnClick: true,
    onShow(instance) {
      // Close other UniLexical tippies
      document.querySelectorAll('[data-tippy-root]').forEach((root) => {
        const inst = (root as unknown as { _tippy?: Instance })._tippy;
        if (inst && inst !== instance && inst.props.interactive) {
          inst.hide();
        }
      });
    },
    ...opts,
  });
}

/** Floating panel at arbitrary coords (slash-triggered table picker, etc.) */
export function showFloatingContent(
  content: HTMLElement,
  rect: DOMRect,
  opts: Partial<Props> = {},
): Instance {
  const ghost = document.createElement('span');
  ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom}px;width:1px;height:1px;pointer-events:none;`;
  document.body.appendChild(ghost);

  const instance = tippy(ghost, {
    ...BASE,
    content,
    interactive: true,
    trigger: 'manual',
    showOnCreate: true,
    placement: 'bottom-start',
    maxWidth: 'none',
    hideOnClick: true,
    onHidden(inst) {
      inst.destroy();
      ghost.remove();
    },
    ...opts,
  });

  return instance;
}

export function destroyTippy(el: Element | null | undefined): void {
  if (!el) return;
  const inst = (el as unknown as { _tippy?: Instance })._tippy;
  inst?.destroy();
}

export type { Instance as TippyInstance };
export { tippy };
