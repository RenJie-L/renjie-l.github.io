import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GaussianFlyController } from './GaussianFlyController';
import {
  DEFAULT_PARAMS,
  PERFORMANCE_PROFILE,
  QUALITY_PROFILE,
  type CameraMode,
  type GaussianParams,
  type PerformanceMode,
} from './GaussianSplatSettings';
import {
  DEFAULT_SCENE_ID,
  findSceneConfig,
  type SplatSceneConfig,
} from './scenes';

type ProgressCallback = (progress: number, status: string) => void;

// 取景默认比例，与原 frameSplat() 保持一致；config.framing 可覆盖。
const DEFAULT_FRAMING = {
  eyeHeightRatio: -0.4,
  eyeOffsetXRatio: -0.12,
  lookRadiusRatio: 0.025,
  maxDistanceRatio: 0.22,
} as const;

export class GaussianSplatScene {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.01, 2000);
  private renderer?: THREE.WebGLRenderer;
  private spark?: SparkRenderer;
  private splat?: SplatMesh;
  private pendingSplat?: SplatMesh;
  private currentConfig?: SplatSceneConfig;
  private currentSceneId: string = DEFAULT_SCENE_ID;
  private controls?: OrbitControls;
  private flyControls?: GaussianFlyController;
  private resizeObserver?: ResizeObserver;
  private frameId = 0;
  private sceneLoadVersion = 0;
  private disposed = false;
  private autoRotate = true;
  private cameraMode: CameraMode = 'orbit';
  private performanceMode: PerformanceMode = 'quality';
  private inputEnabled = true;
  private movementSpeed = 1;
  private readonly forwardDirection = new THREE.Vector3();
  private orbitDistance = 1;
  private readonly userParams: GaussianParams = { ...DEFAULT_PARAMS };
  private defaultCameraPosition = new THREE.Vector3(0, 0, 5);
  private defaultTarget = new THREE.Vector3();

  private readonly stopAutoRotate = () => {
    this.setAutoRotate(false);
  };

  constructor(root: HTMLElement) {
    this.root = root;
    const canvas = root.querySelector<HTMLCanvasElement>('[data-splat-canvas]');
    if (!canvas) throw new Error('Gaussian splat canvas is missing.');
    this.canvas = canvas;
  }

  async init(
    onProgress: ProgressCallback,
    initialSceneId: string = DEFAULT_SCENE_ID,
  ) {
    try {
      await this.initialize(onProgress, initialSceneId);
    } catch (error) {
      // init() 可能在 renderer、controls 或 splat 任一阶段失败；统一回收已经创建的资源。
      this.destroy();
      throw error;
    }
  }

  private async initialize(
    onProgress: ProgressCallback,
    initialSceneId: string,
  ) {
    onProgress(4, 'Initializing WebGL renderer…');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.applyPixelRatio();
    this.renderer.setClearColor(0x090b0f, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera.position.set(0, 0, 5);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = -1;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.55;
    this.flyControls = new GaussianFlyController(this.camera, this.canvas);

    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);

    this.setupResize();
    this.setupInput();
    this.resize();

    await this.loadScene(initialSceneId, onProgress);
  }

  /**
   * 切换场景。新 splat 完整初始化后才替换旧场景，失败时保留当前画面以便重试。
   * renderer / camera / controls / spark 复用，避免视角与上下文丢失。
   */
  async loadScene(
    sceneId: string,
    onProgress: ProgressCallback,
  ): Promise<void> {
    const config = findSceneConfig(sceneId);
    if (!config) throw new Error(`Unknown splat scene: ${sceneId}`);
    if (this.disposed) return;
    if (this.currentSceneId === sceneId && this.splat) return;

    // 新请求会取代仍在下载的候选项，但不会影响当前正在显示的 splat。
    const loadVersion = ++this.sceneLoadVersion;
    this.pendingSplat?.dispose();
    this.pendingSplat = undefined;

    const sizeHint = config.sizeBytes ?? 8_000_000;
    const sizeMB = (sizeHint / 1024 / 1024).toFixed(1);
    onProgress(8, `Downloading ${sizeMB} MB SPZ scene…`);

    const splat = new SplatMesh({
      url: config.url,
      // 构建 LoD 数据，否则面板中的细节层次与注视点参数没有作用。
      lod: true,
      // 同时保留原始 splat，供包围盒取景与关闭 LoD 时使用。
      nonLod: true,
      onProgress: (event) => {
        if (this.disposed || loadVersion !== this.sceneLoadVersion) return;
        const ratio = event.lengthComputable
          ? event.loaded / event.total
          : Math.min(event.loaded / sizeHint, 1);
        onProgress(
          Math.round(8 + ratio * 76),
          `Downloading scene… ${(event.loaded / 1024 / 1024).toFixed(1)} MB`,
        );
      },
    });
    this.pendingSplat = splat;

    try {
      // 应用 transform：scale → quaternion（先于加入场景，避免一帧闪烁）。
      // position 留到 frameSplat() 里居中后再叠加。
      const { scale, quaternion } = config.transform;
      if (scale !== undefined) splat.scale.setScalar(scale);
      if (quaternion) splat.quaternion.set(...quaternion);
      await splat.initialized;
    } catch (error) {
      if (this.pendingSplat === splat) this.pendingSplat = undefined;
      splat.dispose();
      // 销毁或被后续请求替代时，不把取消的旧请求当作加载错误。
      if (this.disposed || loadVersion !== this.sceneLoadVersion) return;
      throw error;
    }

    if (this.pendingSplat === splat) this.pendingSplat = undefined;
    if (this.disposed || loadVersion !== this.sceneLoadVersion) {
      splat.dispose();
      return;
    }

    const previousSplat = this.splat;
    const previousConfig = this.currentConfig;
    const previousSceneId = this.currentSceneId;

    try {
      // 保留旧 splat 直到新场景已完成取景，保证切换过程是原子的。
      this.scene.add(splat);
      this.splat = splat;
      this.currentConfig = config;
      this.currentSceneId = sceneId;
      onProgress(90, 'Entering the capture point…');
      this.frameSplat();
      this.applyEffectiveParams(this.userParams);
    } catch (error) {
      this.scene.remove(splat);
      this.splat = previousSplat;
      this.currentConfig = previousConfig;
      this.currentSceneId = previousSceneId;
      splat.dispose();
      if (previousSplat && previousConfig) this.frameSplat();
      throw error;
    }

    if (previousSplat) {
      this.scene.remove(previousSplat);
      previousSplat.dispose();
    }
    onProgress(100, 'Scene ready');
  }

  getSceneId(): string {
    return this.currentSceneId;
  }

  private frameSplat() {
    if (!this.splat || !this.controls || !this.currentConfig) return;
    const box = this.splat.getBoundingBox();
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const rotatedCenter = center.clone().applyQuaternion(this.splat.quaternion);
    // 居中：把包围盒中心（旋转后）搬到原点
    this.splat.position.copy(rotatedCenter).multiplyScalar(-1);
    // 叠加 config.transform.position（在居中之后的额外偏移）
    const pos = this.currentConfig.transform.position;
    if (pos) this.splat.position.add(new THREE.Vector3(pos[0], pos[1], pos[2]));

    // 取景：优先用 config.camera 硬编码值，否则用 framing 比例算
    const sceneScale = Math.max(size.x, size.y, size.z, 0.5);
    const worldScale = sceneScale * (this.splat.scale.x || 1);
    this.camera.near = Math.max(worldScale / 10_000, 0.001);
    this.camera.far = Math.max(worldScale * 12, 100);
    this.movementSpeed = worldScale * 0.04;
    this.flyControls?.setMovementSpeed(this.movementSpeed);
    this.camera.updateProjectionMatrix();

    const cam = this.currentConfig.camera;
    if (cam) {
      this.defaultCameraPosition.set(
        cam.position[0],
        cam.position[1],
        cam.position[2],
      );
      this.defaultTarget.set(cam.target[0], cam.target[1], cam.target[2]);
    } else {
      const f = { ...DEFAULT_FRAMING, ...this.currentConfig.framing };
      const lookRadius = sceneScale * f.lookRadiusRatio;
      const eyeHeight = size.y * f.eyeHeightRatio;
      const eyeOffsetX = size.x * f.eyeOffsetXRatio;
      this.defaultTarget.set(eyeOffsetX, eyeHeight, -lookRadius);
      this.defaultCameraPosition.set(eyeOffsetX, eyeHeight, 0);
    }
    this.camera.position.copy(this.defaultCameraPosition);
    this.controls.target.copy(this.defaultTarget);
    this.controls.enablePan = false;
    // minDistance/maxDistance 用 worldScale 估算，保证可缩放范围合理
    const dist = this.defaultCameraPosition.distanceTo(this.defaultTarget);
    this.orbitDistance = Math.max(dist, 0.01);
    this.controls.minDistance = dist * 0.1;
    this.controls.maxDistance = worldScale * 0.5;
    this.controls.update();
  }

  private setupInput() {
    this.controls?.addEventListener('start', this.stopAutoRotate);
  }

  private setupResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
  }

  private resize() {
    if (!this.renderer) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.applyPixelRatio();
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  start() {
    let previousTime = performance.now();
    const render = (time: number) => {
      if (this.disposed || !this.renderer) return;
      const deltaTime = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      this.flyControls?.update(deltaTime);
      if (this.cameraMode === 'orbit') this.controls?.update();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(render);
    };
    render(previousTime);
  }

  resetView() {
    if (!this.controls) return;
    this.camera.position.copy(this.defaultCameraPosition);
    this.controls.target.copy(this.defaultTarget);
    this.controls.update();
    if (this.cameraMode === 'fly') this.camera.lookAt(this.defaultTarget);
  }

  toggleAutoRotate() {
    if (this.cameraMode === 'fly') return false;
    this.setAutoRotate(!this.autoRotate);
    return this.autoRotate;
  }

  getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  setCameraMode(mode: CameraMode): void {
    if (!this.controls || this.cameraMode === mode) return;

    if (mode === 'fly') {
      this.orbitDistance = Math.max(
        this.camera.position.distanceTo(this.controls.target),
        0.01,
      );
      this.setAutoRotate(false);
      this.controls.enabled = false;
      this.flyControls?.setEnabled(true);
    } else {
      this.flyControls?.setEnabled(false);
      this.camera.getWorldDirection(this.forwardDirection).normalize();
      this.controls.target
        .copy(this.camera.position)
        .addScaledVector(this.forwardDirection, this.orbitDistance);
      this.controls.enabled = this.inputEnabled;
      this.controls.update();
    }

    this.cameraMode = mode;
    this.root.dispatchEvent(
      new CustomEvent<CameraMode>('splat-camera-mode-change', {
        detail: mode,
      }),
    );
  }

  getPerformanceMode(): PerformanceMode {
    return this.performanceMode;
  }

  setPerformanceMode(mode: PerformanceMode): void {
    if (this.performanceMode === mode) return;
    this.performanceMode = mode;
    this.applyPixelRatio();
    this.resize();
    this.applyEffectiveParams({
      lodSplatScale: this.userParams.lodSplatScale,
      lodRenderScale: this.userParams.lodRenderScale,
    });
    if (this.spark) {
      this.spark.minSortIntervalMs =
        mode === 'performance'
          ? PERFORMANCE_PROFILE.minSortIntervalMs
          : QUALITY_PROFILE.minSortIntervalMs;
      this.spark.sortDirty = true;
      this.spark.setDirty();
    }
    this.root.dispatchEvent(
      new CustomEvent<PerformanceMode>('splat-performance-mode-change', {
        detail: mode,
      }),
    );
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (this.controls) {
      this.controls.enabled = enabled && this.cameraMode === 'orbit';
    }
    this.flyControls?.setInputEnabled(enabled);
  }

  // 应用面板下发的参数。所有副作用集中在此处，UI 层不直接读写渲染器字段。
  applyParams(params: Partial<GaussianParams>): void {
    Object.assign(this.userParams, params);
    this.applyEffectiveParams(params);
  }

  private applyEffectiveParams(params: Partial<GaussianParams>): void {
    if (!this.spark || !this.splat) return;
    const effectiveParams = { ...params };
    if (params.lodSplatScale !== undefined) {
      effectiveParams.lodSplatScale =
        this.performanceMode === 'performance'
          ? Math.max(
              0.25,
              params.lodSplatScale *
                PERFORMANCE_PROFILE.lodSplatScaleMultiplier,
            )
          : params.lodSplatScale;
    }
    if (params.lodRenderScale !== undefined) {
      effectiveParams.lodRenderScale =
        this.performanceMode === 'performance'
          ? Math.max(
              params.lodRenderScale,
              PERFORMANCE_PROFILE.minLodRenderScale,
            )
          : params.lodRenderScale;
    }
    const splat = this.splat as SplatMesh & {
      opacity: number;
      recolor: THREE.Color;
      maxSh: number;
      updateGenerator: () => void;
    };
    const spark = this.spark;

    if (effectiveParams.opacity !== undefined) {
      splat.opacity = effectiveParams.opacity;
    }
    if (effectiveParams.recolor !== undefined) {
      try {
        splat.recolor.set(effectiveParams.recolor);
      } catch {
        /* 非法颜色字符串则忽略 */
      }
    }
    if (
      effectiveParams.maxSh !== undefined &&
      splat.maxSh !== effectiveParams.maxSh
    ) {
      splat.maxSh = effectiveParams.maxSh;
      splat.updateGenerator();
    }

    const scalarKeys = [
      'maxStdDev',
      'focalAdjustment',
      'falloff',
      'minAlpha',
      'minPixelRadius',
      'maxPixelRadius',
      'preBlurAmount',
      'lodSplatScale',
      'lodRenderScale',
      'focalDistance',
      'apertureAngle',
      'coneFov0',
      'coneFov',
      'coneFoveate',
      'behindFoveate',
    ] as const;
    for (const key of scalarKeys) {
      const value = effectiveParams[key];
      if (value !== undefined) spark[key] = value;
    }
    if (effectiveParams.sortRadial !== undefined) {
      spark.sortRadial = effectiveParams.sortRadial;
    }
    if (effectiveParams.enable2DGS !== undefined) {
      spark.enable2DGS = effectiveParams.enable2DGS;
    }

    // LoD 参数需要显式标记遍历结果失效；排序模式也需要触发重排。
    if (
      effectiveParams.lodSplatScale !== undefined ||
      effectiveParams.lodRenderScale !== undefined ||
      effectiveParams.coneFov0 !== undefined ||
      effectiveParams.coneFov !== undefined ||
      effectiveParams.coneFoveate !== undefined ||
      effectiveParams.behindFoveate !== undefined
    ) {
      spark.lodDirty = true;
    }
    if (effectiveParams.sortRadial !== undefined) spark.sortDirty = true;
    spark.setDirty();
  }

  private applyPixelRatio(): void {
    if (!this.renderer) return;
    const isMobile = this.root.clientWidth < 768;
    const cap =
      this.performanceMode === 'performance'
        ? isMobile
          ? PERFORMANCE_PROFILE.mobilePixelRatioCap
          : PERFORMANCE_PROFILE.desktopPixelRatioCap
        : isMobile
          ? QUALITY_PROFILE.mobilePixelRatioCap
          : QUALITY_PROFILE.desktopPixelRatioCap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
  }

  private setAutoRotate(enabled: boolean) {
    if (enabled && this.cameraMode === 'fly') return;
    if (this.autoRotate === enabled) return;
    this.autoRotate = enabled;
    if (this.controls) this.controls.autoRotate = enabled;
    this.root.dispatchEvent(
      new CustomEvent<boolean>('splat-auto-rotate-change', {
        detail: enabled,
      }),
    );
  }

  destroy() {
    this.disposed = true;
    this.sceneLoadVersion += 1;
    cancelAnimationFrame(this.frameId);
    this.controls?.removeEventListener('start', this.stopAutoRotate);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.flyControls?.dispose();
    this.pendingSplat?.dispose();
    this.pendingSplat = undefined;
    this.splat?.dispose();
    this.splat = undefined;
    this.spark?.dispose();
    this.renderer?.dispose();
    this.scene.clear();
  }
}
