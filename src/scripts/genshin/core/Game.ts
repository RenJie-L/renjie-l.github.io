import {
  $r,
  AssetManager,
  BloomPlugin,
  Fog,
  FXAAPlugin,
  LinearEncoding,
  NoToneMapping,
  ToneMappingMode,
  ToneMappingPlugin,
  Viewer,
} from '../libs/xviewer';
import { GENSHIN_ASSETS, type GenshinModelName } from '../AssetManifest';
import { AmbientLightComponent } from './components/AmbientLightComponent';
import { BigCloud } from './components/BigCloud';
import { BloomTransitionEffectPlugin } from './components/BloomTransition';
import { Cloud } from './components/Cloud';
import { Column } from './components/Column';
import { DirectionalLightComponent } from './components/DirectionalLightComponent';
import { ForwardCamera } from './components/ForwardCamera';
import { gradientBackgroundPlugin } from './components/gradientBackground';
import { HashFog } from './components/HashFog';
import { materialTextureTasks } from './components/Materials';
import { PolarLight } from './components/PolarLight';
import { Road } from './components/Road';
import { gameManager } from './GameManager';
import { StateHandler } from './states/StateHandler';
import { StateMachine } from './states/StateMachine';
import { User } from './User';

class StatePreload extends StateHandler<Game> {
  name = 'StatePreload';

  async onEnter(): Promise<void> {
    await this.target.preload();
  }
}

class StateGame extends StateHandler<Game> {
  name = 'StateGame';

  onEnter(): void {
    this.target.createScene();
  }
}

export class Game {
  readonly viewer: Viewer;
  readonly stateMachine: StateMachine<Game> = new StateMachine<Game>(this);

  private road?: Road;
  private forwardCamera?: ForwardCamera;
  private bloomTransition?: BloomTransitionEffectPlugin;
  private bgm?: HTMLAudioElement;
  private effect?: HTMLAudioElement;
  private whiteoutTimer?: number;
  private completionTimer?: number;
  private destroyed = false;
  private started = false;
  private portalReady = false;
  private entering = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.viewer = new Viewer({
      canvas,
      camera: {
        fov: 45,
        near: 50,
        far: 100000,
        rotation: $r((5.5 * Math.PI) / 180, 0, 0),
      },
      user: new User(),
      linear: false,
      toneMapping: NoToneMapping,
      outputEncoding: LinearEncoding,
    });
    this.stateMachine.registerState(StatePreload);
    this.stateMachine.registerState(StateGame);
  }

  async init(): Promise<void> {
    await this.stateMachine.setState('StatePreload');
    if (this.destroyed) return;
    await this.stateMachine.setState('StateGame');
  }

  start(): boolean {
    if (this.destroyed || this.started || !this.road) return false;
    this.started = true;
    this.playAudio(this.bgm, true);
    this.playAudio(this.effect, false, GENSHIN_ASSETS.audio.start);
    this.road.emit('start');
    gameManager.emit('started');
    return true;
  }

  enterPortal(): boolean {
    if (this.destroyed || !this.portalReady || this.entering) return false;
    this.entering = true;
    gameManager.emit('entering');
    gameManager.emit('openDoor');
    this.forwardCamera?.emit('openDoor');
    this.bloomTransition?.playTransition();
    this.playAudio(this.effect, false, GENSHIN_ASSETS.audio.doorThrough, 150);

    window.setTimeout(() => this.road?.openDoor(), 100);
    this.whiteoutTimer = window.setTimeout(() => {
      if (!this.destroyed) gameManager.emit('whiteout');
    }, 750);
    this.completionTimer = window.setTimeout(() => {
      if (!this.destroyed) gameManager.emit('complete');
    }, 2100);
    return true;
  }

  setMuted(muted: boolean): void {
    if (this.bgm) this.bgm.muted = muted;
    if (this.effect) this.effect.muted = muted;
  }

  resize(): void {
    if (this.destroyed) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.viewer.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.whiteoutTimer !== undefined)
      window.clearTimeout(this.whiteoutTimer);
    if (this.completionTimer !== undefined)
      window.clearTimeout(this.completionTimer);
    this.stopAudio(this.bgm);
    this.stopAudio(this.effect);
    this.stateMachine.reset();
    this.viewer.stop();
    this.viewer.destroy();
  }

  async preload(): Promise<void> {
    const resources = this.viewer.user.resources as Record<string, unknown>;
    const entries = Object.entries(GENSHIN_ASSETS.models) as [
      GenshinModelName,
      string,
    ][];

    await Promise.all([
      ...entries.map(([name, url]) =>
        gameManager.task(
          AssetManager.Load({ url }).then((value) => {
            resources[name] = value;
          }),
          { name },
        ),
      ),
      ...materialTextureTasks.map(({ name, ready }) =>
        gameManager.task(ready, { name }),
      ),
    ]);
  }

  createScene(): void {
    const viewer = this.viewer;
    viewer.scene.fog = new Fog(0x389af2, 5000, 10000);

    viewer.addNode(AmbientLightComponent);
    viewer.addNode(DirectionalLightComponent);
    viewer.addNode(PolarLight);
    viewer.addNode(Cloud);
    viewer.addNode(HashFog);
    viewer.addNode(Column);
    viewer.addNode(BigCloud);

    this.forwardCamera = viewer.addNode(ForwardCamera);
    this.road = viewer.addNode(Road);

    viewer.addPlugin(gradientBackgroundPlugin);
    viewer.addPlugin(FXAAPlugin);
    viewer.addPlugin(BloomPlugin, {
      mipmapBlur: true,
      luminanceThreshold: 2,
      intensity: 0.6,
    });
    this.bloomTransition = viewer.addPlugin(BloomTransitionEffectPlugin);
    viewer.addPlugin(ToneMappingPlugin, { mode: ToneMappingMode.ACES_FILMIC });

    this.prepareAudio();
    gameManager.on('showDoor', this.onShowDoor, this, true);
    gameManager.on('doorCreateBegin', this.onDoorCreateBegin, this, true);
    gameManager.on('doorCreate', this.onDoorCreate, this, true);
    this.resize();
  }

  private onShowDoor(zOffset: number): void {
    gameManager.emit('portal-forming');
    this.forwardCamera?.emit('showDoor', zOffset);
  }

  private onDoorCreateBegin(): void {
    this.playAudio(this.effect, false, GENSHIN_ASSETS.audio.doorCreate, 150);
  }

  private onDoorCreate(): void {
    this.portalReady = true;
    gameManager.emit('portal-ready');
  }

  private prepareAudio(): void {
    this.bgm = new Audio(GENSHIN_ASSETS.audio.bgm);
    this.bgm.preload = 'auto';
    this.bgm.loop = true;
    this.effect = new Audio();
    this.effect.preload = 'auto';
  }

  private playAudio(
    audio: HTMLAudioElement | undefined,
    loop: boolean,
    src?: string,
    delay = 0,
  ): void {
    if (!audio) return;
    const run = () => {
      if (this.destroyed) return;
      if (src) audio.src = src;
      audio.loop = loop;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Audio is decorative; browser autoplay policies must not block WebGL.
      });
    };
    if (delay > 0) window.setTimeout(run, delay);
    else run();
  }

  private stopAudio(audio: HTMLAudioElement | undefined): void {
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}
