import type { EventHandler, UniEditorEvents } from './types';

type HandlerMap = {
  [K in keyof UniEditorEvents]?: Set<EventHandler<UniEditorEvents[K]>>;
};

/**
 * Lightweight typed event bus used as the Reactivity Bridge between
 * UniEditor core and framework wrappers.
 */
export class EventEmitter {
  private handlers: HandlerMap = {};

  on<K extends keyof UniEditorEvents>(
    event: K,
    handler: EventHandler<UniEditorEvents[K]>,
  ): () => void {
    if (!this.handlers[event]) {
      this.handlers[event] = new Set() as HandlerMap[K];
    }
    (this.handlers[event] as Set<EventHandler<UniEditorEvents[K]>>).add(handler);
    return () => this.off(event, handler);
  }

  once<K extends keyof UniEditorEvents>(
    event: K,
    handler: EventHandler<UniEditorEvents[K]>,
  ): () => void {
    const wrapped = ((payload: UniEditorEvents[K]) => {
      this.off(event, wrapped as EventHandler<UniEditorEvents[K]>);
      (handler as (p: UniEditorEvents[K]) => void)(payload);
    }) as EventHandler<UniEditorEvents[K]>;
    return this.on(event, wrapped);
  }

  off<K extends keyof UniEditorEvents>(
    event: K,
    handler: EventHandler<UniEditorEvents[K]>,
  ): void {
    this.handlers[event]?.delete(handler as never);
  }

  emit<K extends keyof UniEditorEvents>(
    event: K,
    ...args: UniEditorEvents[K] extends void ? [] : [UniEditorEvents[K]]
  ): void {
    const set = this.handlers[event];
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as (...a: unknown[]) => void)(...args);
      } catch (err) {
        console.error(`[UniLexical] listener error on "${String(event)}":`, err);
      }
    }
  }

  removeAllListeners(event?: keyof UniEditorEvents): void {
    if (event) {
      delete this.handlers[event];
    } else {
      this.handlers = {};
    }
  }
}
