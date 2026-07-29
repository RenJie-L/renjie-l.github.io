import { StateMachine } from './StateMachine';

export class StateHandler<T extends object = object> {
  public name = '';
  public active = false;
  public canTransfer?(state: string): boolean;
  public onEnter?(...args: unknown[]): void | Promise<void>;
  public onLeave?(): void | Promise<void>;
  public onUpdate?(dt: number): void;
  public target!: T;
  public SM!: StateMachine<T>;
}
