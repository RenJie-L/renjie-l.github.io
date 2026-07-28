import gsap from 'gsap';
import * as THREE from 'three';
import { WEST_LAKE_CHAPTERS } from '@/scripts/west-lake/config/chapters';
import { CameraTour } from '@/scripts/west-lake/controllers/CameraTour';
import { LandmarkController } from '@/scripts/west-lake/controllers/LandmarkController';
import { resolveSceneQuality } from '@/scripts/west-lake/core/QualityManager';
import { InkPostProcessing } from '@/scripts/west-lake/postprocessing/InkPostProcessing';
import type {
  ChapterId,
  ProgressHandler,
  SceneQuality,
} from '@/scripts/west-lake/types';
import { Atmosphere } from '@/scripts/west-lake/world/Atmosphere';
import { Boats } from '@/scripts/west-lake/world/Boats';
import { Landscape } from '@/scripts/west-lake/world/Landscape';
import { Vegetation } from '@/scripts/west-lake/world/Vegetation';
import { Water } from '@/scripts/west-lake/world/Water';

export class WestLakeScene {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  private renderer?: THREE.WebGLRenderer;
  private quality: SceneQuality;
  private frame = 0;
  private running = false;
  private destroyed = false;
  private lastTime = 0;
  private elapsed = 0;
  private observer?: IntersectionObserver;
  private raycaster = new THREE.Raycaster();
  private water?: Water;
  private landscape?: Landscape;
  private vegetation?: Vegetation;
  private boats?: Boats;
  private atmosphere?: Atmosphere;
  private cameraTour?: CameraTour;
  private landmarks?: LandmarkController;
  private postProcessing?: InkPostProcessing;

  constructor(root: HTMLElement) {
    this.root = root;
    this.quality = resolveSceneQuality();
    const canvas = root.querySelector<HTMLCanvasElement>(
      '[data-west-lake-canvas]',
    );
    if (!canvas) throw new Error('West Lake canvas is missing.');
    this.canvas = canvas;
  }

  init(onProgress: ProgressHandler) {
    onProgress(8, 'Preparing renderer…');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: this.quality.lite ? 'low-power' : 'high-performance',
    });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor('#dfe5df', 1);
    this.scene.fog = new THREE.FogExp2('#dce4df', 0.022);

    onProgress(22, 'Shaping shoreline and causeway…');
    this.landscape = new Landscape(this.scene, this.quality);
    onProgress(38, 'Painting the lake surface…');
    this.water = new Water(this.scene, this.quality);
    onProgress(54, 'Planting willows and lotus…');
    this.vegetation = new Vegetation(
      this.scene,
      this.landscape.causewayCurve,
      this.quality,
    );
    this.landscape.landmarkTargets.set('lotus-courtyard', [
      this.vegetation.lotusTarget,
    ]);
    onProgress(66, 'Launching boats and birds…');
    this.boats = new Boats(this.scene, this.quality);
    this.atmosphere = new Atmosphere(this.scene, this.quality);
    onProgress(78, 'Laying camera route…');
    this.cameraTour = new CameraTour(this.camera);
    this.landmarks = new LandmarkController(
      this.root,
      this.camera,
      this.landscape.landmarkTargets,
    );
    this.createLights();
    onProgress(90, 'Brushing ink texture…');
    if (this.quality.postProcessing) {
      this.postProcessing = new InkPostProcessing(
        this.renderer,
        this.scene,
        this.camera,
      );
    }
    this.bindEvents();
    this.resize();
    this.applyChapter(WEST_LAKE_CHAPTERS[0]);
    this.root.dataset.quality = this.quality.label;
    onProgress(100, this.quality.lite ? 'Lite scene ready' : 'West Lake ready');
  }

  start() {
    if (!this.renderer || this.running || this.destroyed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.cameraTour?.start(() => {
      this.root.dispatchEvent(new CustomEvent('westlake:introcomplete'));
    });
    this.animate();
  }

  goToChapter(id: ChapterId) {
    this.cameraTour?.goTo(id, (chapter) => {
      this.applyChapter(chapter);
      this.root.dispatchEvent(
        new CustomEvent('westlake:chapterchange', {
          detail: { id: chapter.id },
        }),
      );
    });
  }

  focusLandmark(id: string) {
    const landmark = this.root.querySelector<HTMLElement>(
      `[data-landmark-label="${CSS.escape(id)}"]`,
    );
    const chapterId = landmark?.dataset.chapterId as ChapterId | undefined;
    if (chapterId) this.goToChapter(chapterId);
    this.landmarks?.select(id);
  }

  skipIntro() {
    this.cameraTour?.skipIntro();
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  resume() {
    if (!this.renderer || this.running || this.destroyed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.animate();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    this.cameraTour?.destroy();
    this.landmarks?.destroy();
    this.observer?.disconnect();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerleave', this.onPointerLeave);
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.landscape?.dispose();
    this.water?.dispose();
    this.vegetation?.dispose();
    this.boats?.dispose();
    this.atmosphere?.dispose();
    this.postProcessing?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined;
  }

  resize = () => {
    if (!this.renderer) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.postProcessing?.resize(width, height, this.quality.pixelRatio);
  };

  private createLights() {
    this.scene.add(new THREE.HemisphereLight('#eff5ef', '#4b6666', 2.4));
    const sun = new THREE.DirectionalLight('#f4d7ad', 2.1);
    sun.position.set(-4, 7, 4);
    this.scene.add(sun);
  }

  private applyChapter(chapter: (typeof WEST_LAKE_CHAPTERS)[number]) {
    this.water?.setChapter(chapter);
    const fog = this.scene.fog as THREE.FogExp2;
    gsap.to(fog, {
      density: chapter.fogDensity,
      duration: 2.2,
      ease: 'sine.inOut',
    });
    const warm = chapter.id === 'leifeng-sunset';
    gsap.to(this.renderer ?? {}, {
      toneMappingExposure: warm ? 1.04 : 1,
      duration: 2.2,
      ease: 'sine.inOut',
    });
  }

  private bindEvents() {
    addEventListener('resize', this.resize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.root.addEventListener('pointermove', this.onPointerMove, {
      passive: true,
    });
    this.root.addEventListener('pointerleave', this.onPointerLeave);
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.observer = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? this.resume() : this.pause()),
      { threshold: 0.05 },
    );
    this.observer.observe(this.root);
  }

  private animate = (now = performance.now()) => {
    if (!this.renderer || !this.running) return;
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += delta;
    this.cameraTour?.update();
    this.water?.update(this.elapsed);
    this.vegetation?.update(this.elapsed);
    this.boats?.update(this.elapsed);
    this.atmosphere?.update(this.elapsed);
    this.landmarks?.update();
    if (this.postProcessing) {
      let rendered = false;
      try {
        rendered = this.postProcessing.render(this.elapsed, delta);
      } catch (error) {
        console.warn(
          'Ink post-processing failed; rendering the base scene.',
          error,
        );
      }
      if (!rendered) {
        this.postProcessing.dispose();
        this.postProcessing = undefined;
        this.root.dataset.postProcessing = 'fallback';
        this.renderer.render(this.scene, this.camera);
      }
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.frame = requestAnimationFrame(this.animate);
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.root.getBoundingClientRect();
    this.cameraTour?.setPointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    if (
      !(event.target instanceof Element) ||
      !event.target.closest('a, button')
    ) {
      this.landmarks?.setHoverFromPointer(event);
    }
  };

  private onPointerLeave = () => {
    this.cameraTour?.resetPointer();
    this.landmarks?.resetCursor();
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.water) return;
    if (event.target instanceof Element && event.target.closest('a, button'))
      return;
    const landmarkId = this.landmarks?.pick(event);
    if (landmarkId) {
      this.focusLandmark(landmarkId);
      return;
    }
    const rect = this.root.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.water.mesh, false)[0];
    if (hit?.uv) this.water.ripple(hit.uv, this.elapsed);
  };

  private onVisibilityChange = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
}
