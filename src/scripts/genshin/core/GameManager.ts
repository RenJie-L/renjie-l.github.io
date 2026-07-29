import { EventEmitter, MathUtils } from '../libs/xviewer';

interface TaskOptions {
  name?: string;
  weight?: number;
}

class TaskManager {
  private taskWeight = 0;
  private finishedWeight = 0;
  private currentProgress = 0;

  get progress(): number {
    return this.currentProgress;
  }

  async task<T>(
    handle: Promise<T> | (() => Promise<T>),
    { name = '', weight = 1 }: TaskOptions = {},
  ): Promise<T> {
    this.taskWeight += weight;
    try {
      const result = await (typeof handle === 'function' ? handle() : handle);
      this.finish(weight, name);
      return result;
    } catch (error) {
      this.finish(weight, name);
      throw error;
    }
  }

  reset(): void {
    this.taskWeight = 0;
    this.finishedWeight = 0;
    this.currentProgress = 0;
  }

  private finish(weight: number, name: string): void {
    this.finishedWeight += weight;
    this.currentProgress = MathUtils.clamp01(
      Math.max(
        this.currentProgress,
        this.finishedWeight / Math.max(1, this.taskWeight),
      ),
    );
    gameManager.emit('progress', this.currentProgress, name);
  }
}

class GameManager extends EventEmitter {
  taskManager = new TaskManager();

  get progress(): number {
    return this.taskManager.progress;
  }

  task<T>(
    handle: Promise<T> | (() => Promise<T>),
    options?: TaskOptions,
  ): Promise<T> {
    return this.taskManager.task(handle, options);
  }

  reset(): void {
    this.clear();
    this.taskManager.reset();
  }
}

/**
 * The original scene components communicate through one xviewer EventEmitter.
 * The controller resets it before every mount, keeping the singleton scoped to
 * the one active immersive scene.
 */
export const gameManager = new GameManager();
