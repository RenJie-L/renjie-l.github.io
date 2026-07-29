import { StateHandler } from './StateHandler';

export const StateResolve = Promise.resolve();

export class StateMachine<T extends object = object> {
  private state = '';
  private handlers: Record<string, StateHandler<T>> = {};
  private transition: Promise<boolean> = Promise.resolve(true);

  constructor(public target: T) {}

  reset(): void {
    this.state = '';
    this.handlers = {};
    this.transition = Promise.resolve(true);
  }

  getState(): string {
    return this.state;
  }

  setState(newState: string): Promise<boolean> {
    this.transition = this.transition.then(async () => {
      if (this.state === newState) return false;

      const current = this.handlers[this.state];
      if (current?.canTransfer && !current.canTransfer(newState)) return false;

      if (current) {
        await current.onLeave?.();
        current.active = false;
      }

      const next = this.handlers[newState];
      if (!next)
        throw new Error(`Genshin state is not registered: ${newState}`);

      this.state = newState;
      await next.onEnter?.();
      next.active = true;
      return true;
    });
    return this.transition;
  }

  registerState(Handler: new () => StateHandler<T>): void {
    const handler = new Handler();
    const state = handler.name || handler.constructor.name;
    handler.SM = this;
    handler.target = this.target;
    this.handlers[state] = handler;
  }

  /** Compatibility with the spelling used by the upstream demo. */
  registState(Handler: new () => StateHandler<T>): void {
    this.registerState(Handler);
  }

  updateState(dt: number): void {
    for (const handler of Object.values(this.handlers)) {
      if (handler.active) handler.onUpdate?.(dt);
    }
  }
}
