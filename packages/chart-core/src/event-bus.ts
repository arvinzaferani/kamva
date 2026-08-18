/**
 * Minimal typed event bus.
 *
 * Handlers are stored per event name. Emission iterates over a snapshot so
 * handlers may subscribe/unsubscribe during dispatch without skipping others.
 */

export type EventHandler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<never>>>();

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<never>);
    return () => this.off(event, handler);
  }

  /** Unsubscribe a previously registered handler. */
  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<never>);
  }

  /** Emit an event to all current subscribers. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) {
      (handler as EventHandler<Events[K]>)(payload);
    }
  }

  /** Remove all subscriptions. */
  clear(): void {
    this.handlers.clear();
  }
}
