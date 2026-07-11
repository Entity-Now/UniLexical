import { animate as motionAnimate, stagger } from 'motion';

/** Gentle ease used across UniLexical chrome */
const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

// motion's overload resolution is picky with Element vs HTMLElement;
// narrow via HTMLElement and a loose options bag.
function animate(
  target: Element | Element[] | NodeListOf<Element>,
  keyframes: Record<string, string | number | Array<string | number>>,
  options: Record<string, unknown> = {},
) {
  return motionAnimate(target as HTMLElement, keyframes as never, options as never);
}

export function animateIn(
  el: Element,
  opts: {
    y?: number;
    x?: number;
    scale?: number;
    duration?: number;
    delay?: number;
  } = {},
): void {
  const { y = 6, x = 0, scale = 0.96, duration = 0.22, delay = 0 } = opts;
  animate(
    el,
    {
      opacity: [0, 1],
      transform: [`translate(${x}px, ${y}px) scale(${scale})`, 'translate(0px, 0px) scale(1)'],
    },
    { duration, delay, easing: EASE_OUT },
  );
}

export function animateOut(
  el: Element,
  opts: { duration?: number } = {},
): Promise<void> {
  const { duration = 0.14 } = opts;
  return Promise.resolve(
    animate(
      el,
      { opacity: 0, transform: 'translateY(4px) scale(0.98)' },
      { duration, easing: 'ease-in' },
    ),
  ).then(() => undefined);
}

export function animateToolbarButtons(container: Element): void {
  const buttons = container.querySelectorAll(
    '.uni-toolbar-btn, .uni-toolbar-divider, .uni-toolbar-group',
  );
  if (!buttons.length) return;
  animate(
    buttons,
    { opacity: [0, 1], transform: ['translateY(-4px)', 'translateY(0px)'] },
    { delay: stagger(0.012, { startDelay: 0.02 }), duration: 0.28, easing: EASE_OUT },
  );
}

export function pulseActive(el: Element): void {
  animate(
    el,
    { transform: ['scale(1)', 'scale(0.92)', 'scale(1)'] },
    { duration: 0.22, easing: EASE_OUT },
  );
}

export function animateTableCells(cells: Element[]): void {
  if (!cells.length) return;
  animate(
    cells,
    { transform: ['scale(0.85)', 'scale(1)'], opacity: [0.5, 1] },
    { delay: stagger(0.008), duration: 0.12, easing: EASE_OUT },
  );
}

export function shake(el: Element): void {
  animate(
    el,
    { transform: ['translateX(0px)', 'translateX(-3px)', 'translateX(3px)', 'translateX(0px)'] },
    { duration: 0.28 },
  );
}

export { stagger };
