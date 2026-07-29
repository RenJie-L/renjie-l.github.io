import { Game } from './core/Game';
import { gameManager } from './core/GameManager';
import type {
  GenshinErrorDetail,
  GenshinProgressCallback,
  GenshinProgressDetail,
  GenshinState,
} from './types';

export class GenshinController {
  private game?: Game;
  private resizeObserver?: ResizeObserver;
  private stateValue: GenshinState = 'idle';
  private destroyed = false;
  private progressCallback?: GenshinProgressCallback;

  constructor(private readonly root: HTMLElement) {}

  get state(): GenshinState {
    return this.stateValue;
  }

  async init(onProgress?: GenshinProgressCallback): Promise<void> {
    if (this.game) return;

    this.destroyed = false;
    this.progressCallback = onProgress;
    this.setState('loading');
    gameManager.reset();
    gameManager.on('progress', this.onProgress, this);
    gameManager.on('portal-forming', this.onPortalForming, this);
    gameManager.on('portal-ready', this.onPortalReady, this);
    gameManager.on('entering', this.onEntering, this);
    gameManager.on('whiteout', this.onWhiteout, this);
    gameManager.on('complete', this.onComplete, this);

    try {
      const canvas = this.getCanvas();
      this.emitProgress(0, 'loading-scene');
      this.game = new Game(canvas);
      this.observeSize(canvas);
      await this.game.init();
      if (this.destroyed) return;
      this.emitProgress(1, 'ready');
      this.setState('ready');
      this.emit('genshin:ready', { controller: this });
    } catch (error) {
      if (this.destroyed) return;
      this.setState('error');
      const detail: GenshinErrorDetail = {
        error,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to initialize Genshin scene',
      };
      this.emit('genshin:error', detail);
      throw error;
    }
  }

  start(): void {
    if (this.stateValue !== 'ready' || !this.game) return;
    const started = this.game.start();
    if (started) this.setState('flying');
  }

  enterPortal(): void {
    if (this.stateValue !== 'portal-ready' || !this.game) return;
    this.game.enterPortal();
  }

  setMuted(muted: boolean): void {
    this.game?.setMuted(muted);
  }

  async retry(onProgress = this.progressCallback): Promise<void> {
    this.disposeGame();
    this.stateValue = 'idle';
    await this.init(onProgress);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.disposeGame();
    this.progressCallback = undefined;
    this.setState('destroyed');
  }

  private getCanvas(): HTMLCanvasElement {
    const canvas =
      this.root instanceof HTMLCanvasElement
        ? this.root
        : this.root.querySelector<HTMLCanvasElement>(
            'canvas[data-genshin-canvas], canvas.genshin-canvas, canvas',
          );
    if (!canvas)
      throw new Error(
        'Genshin scene requires a canvas inside the root element',
      );
    return canvas;
  }

  private observeSize(canvas: HTMLCanvasElement): void {
    const target = canvas.parentElement ?? this.root;
    this.resizeObserver = new ResizeObserver(() => this.game?.resize());
    this.resizeObserver.observe(target);
    this.game?.resize();
  }

  private disposeGame(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.game?.destroy();
    this.game = undefined;
    gameManager.targetOff(this);
    gameManager.reset();
  }

  private onProgress(progress: number, status: string): void {
    this.emitProgress(progress, status || 'loading-assets');
  }

  private onPortalForming(): void {
    this.setState('portal-forming');
  }

  private onPortalReady(): void {
    this.setState('portal-ready');
    this.emit('genshin:portal-ready', {});
  }

  private onEntering(): void {
    this.setState('entering');
    this.emit('genshin:entering', {});
  }

  private onWhiteout(): void {
    this.emit('genshin:whiteout', {});
  }

  private onComplete(): void {
    this.setState('complete');
    this.emit('genshin:complete', {});
  }

  private emitProgress(progress: number, status: string): void {
    const safeProgress = Math.max(0, Math.min(1, progress));
    this.progressCallback?.(safeProgress, status);
    const detail: GenshinProgressDetail = { progress: safeProgress, status };
    this.emit('genshin:progress', detail);
  }

  private setState(state: GenshinState): void {
    this.stateValue = state;
    this.root.dataset.genshinState = state;
  }

  private emit<T>(name: string, detail: T): void {
    this.root.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

export default GenshinController;
