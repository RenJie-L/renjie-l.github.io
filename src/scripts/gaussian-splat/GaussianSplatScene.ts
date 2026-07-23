import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const SPLAT_URL =
  'https://qhrenderstorage-oss.kujiale.com//worldmodel/prod_test/2026/06/24/5470b666-1552-4bfe-ab6e-d42821118b41.spz';

type ProgressCallback = (progress: number, status: string) => void;

// 面板可调节的参数集合；与 GaussianSplatPanel 的 DEFAULTS 保持一致。
export interface GaussianParams {
  // SplatMesh 实例属性
  opacity: number; // 0..1
  recolor: string; // 十六进制颜色，内部转 THREE.Color
  maxSh: 0 | 1 | 2 | 3; // 球谐阶数，改后需 updateGenerator()
  // SparkRenderer 外观
  maxStdDev: number; // 2.0..3.0
  focalAdjustment: number; // 0.5..3.0
  falloff: number; // 0..1
  minAlpha: number; // 0..0.05
  minPixelRadius: number;
  maxPixelRadius: number;
  preBlurAmount: number; // 0..1
  sortRadial: boolean;
  enable2DGS: boolean;
  // LoD
  lodSplatScale: number; // 0.25..4.0
  lodRenderScale: number; // 1..5
  // 景深
  focalDistance: number;
  apertureAngle: number;
  // 注视点
  coneFov0: number;
  coneFov: number;
  coneFoveate: number;
  behindFoveate: number;
}

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);

export class GaussianSplatScene {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.01, 2000);
  private renderer?: THREE.WebGLRenderer;
  private spark?: SparkRenderer;
  private splat?: SplatMesh;
  private controls?: OrbitControls;
  private resizeObserver?: ResizeObserver;
  private frameId = 0;
  private disposed = false;
  private autoRotate = true;
  private movementSpeed = 1;
  private readonly pressedKeys = new Set<string>();
  private readonly moveDirection = new THREE.Vector3();
  private readonly forwardDirection = new THREE.Vector3();
  private readonly rightDirection = new THREE.Vector3();
  private defaultCameraPosition = new THREE.Vector3(0, 0, 5);
  private defaultTarget = new THREE.Vector3();

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!MOVEMENT_KEYS.has(event.code)) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.matches('input, textarea, select') ||
      target?.isContentEditable
    ) {
      return;
    }
    event.preventDefault();
    this.stopAutoRotate();
    this.pressedKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly clearPressedKeys = () => {
    this.pressedKeys.clear();
  };

  private readonly stopAutoRotate = () => {
    this.setAutoRotate(false);
  };

  constructor(root: HTMLElement) {
    this.root = root;
    const canvas = root.querySelector<HTMLCanvasElement>('[data-splat-canvas]');
    if (!canvas) throw new Error('Gaussian splat canvas is missing.');
    this.canvas = canvas;
  }

  async init(onProgress: ProgressCallback) {
    onProgress(4, 'Initializing WebGL renderer…');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, innerWidth < 768 ? 1.25 : 1.75),
    );
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

    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);

    onProgress(8, 'Downloading 7.6 MB SPZ scene…');
    this.splat = new SplatMesh({
      url: SPLAT_URL,
      // 构建 LoD 数据，否则面板中的细节层次与注视点参数没有作用。
      lod: true,
      // 同时保留原始 splat，供包围盒取景与关闭 LoD 时使用。
      nonLod: true,
      onProgress: (event) => {
        const ratio = event.lengthComputable
          ? event.loaded / event.total
          : Math.min(event.loaded / 7_973_645, 1);
        onProgress(
          Math.round(8 + ratio * 76),
          `Downloading scene… ${(event.loaded / 1024 / 1024).toFixed(1)} MB`,
        );
      },
    });
    this.splat.quaternion.set(1, 0, 0, 0);
    this.scene.add(this.splat);

    await this.splat.initialized;
    if (this.disposed) return;
    onProgress(90, 'Entering the capture point…');
    this.frameSplat();
    this.setupResize();
    this.setupInput();
    this.resize();
    onProgress(100, 'Scene ready');
  }

  private frameSplat() {
    if (!this.splat || !this.controls) return;
    const box = this.splat.getBoundingBox();
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const rotatedCenter = center.clone().applyQuaternion(this.splat.quaternion);
    this.splat.position.copy(rotatedCenter).multiplyScalar(-1);

    // Keep the camera close to the capture origin instead of fitting the whole
    // bounding box, so OrbitControls behaves like an interior look-around view.
    const sceneScale = Math.max(size.x, size.y, size.z, 0.5);
    const lookRadius = sceneScale * 0.025;
    const eyeHeight = -size.y * 0.4;
    const eyeOffsetX = size.x * -0.12;
    this.camera.near = Math.max(sceneScale / 10_000, 0.001);
    this.camera.far = Math.max(sceneScale * 12, 100);
    this.movementSpeed = sceneScale * 0.04;
    this.camera.updateProjectionMatrix();

    this.defaultTarget.set(eyeOffsetX, eyeHeight, -lookRadius);
    this.defaultCameraPosition.set(eyeOffsetX, eyeHeight, 0);
    this.camera.position.copy(this.defaultCameraPosition);
    this.controls.target.copy(this.defaultTarget);
    this.controls.enablePan = false;
    this.controls.minDistance = lookRadius * 0.35;
    this.controls.maxDistance = sceneScale * 0.22;
    this.controls.update();
  }

  private setupInput() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearPressedKeys);
    this.controls?.addEventListener('start', this.stopAutoRotate);
  }

  private updateKeyboardMovement(deltaTime: number) {
    if (!this.controls || this.pressedKeys.size === 0) return;

    this.camera.getWorldDirection(this.forwardDirection);
    this.forwardDirection.y = 0;
    if (this.forwardDirection.lengthSq() < 0.0001) {
      this.forwardDirection.set(0, 0, -1);
    } else {
      this.forwardDirection.normalize();
    }

    this.rightDirection.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.rightDirection.y = 0;
    this.rightDirection.normalize();

    this.moveDirection.set(0, 0, 0);
    if (this.pressedKeys.has('KeyW')) {
      this.moveDirection.add(this.forwardDirection);
    }
    if (this.pressedKeys.has('KeyS')) {
      this.moveDirection.sub(this.forwardDirection);
    }
    if (this.pressedKeys.has('KeyD')) {
      this.moveDirection.add(this.rightDirection);
    }
    if (this.pressedKeys.has('KeyA')) {
      this.moveDirection.sub(this.rightDirection);
    }
    if (this.pressedKeys.has('KeyQ')) this.moveDirection.y += 1;
    if (this.pressedKeys.has('KeyE')) this.moveDirection.y -= 1;
    if (this.moveDirection.lengthSq() === 0) return;

    this.stopAutoRotate();
    this.moveDirection
      .normalize()
      .multiplyScalar(this.movementSpeed * deltaTime);
    this.camera.position.add(this.moveDirection);
    this.controls.target.add(this.moveDirection);
  }

  private setupResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
  }

  private resize() {
    if (!this.renderer) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
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
      this.updateKeyboardMovement(deltaTime);
      this.controls?.update();
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
  }

  toggleAutoRotate() {
    this.setAutoRotate(!this.autoRotate);
    return this.autoRotate;
  }

  // 应用面板下发的参数。所有副作用集中在此处，UI 层不直接读写渲染器字段。
  applyParams(params: Partial<GaussianParams>): void {
    if (!this.spark || !this.splat) return;
    const splat = this.splat as SplatMesh & {
      opacity: number;
      recolor: THREE.Color;
      maxSh: number;
      updateGenerator: () => void;
    };
    const spark = this.spark;

    if (params.opacity !== undefined) splat.opacity = params.opacity;
    if (params.recolor !== undefined) {
      try {
        splat.recolor.set(params.recolor);
      } catch {
        /* 非法颜色字符串则忽略 */
      }
    }
    if (params.maxSh !== undefined && splat.maxSh !== params.maxSh) {
      splat.maxSh = params.maxSh;
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
      const value = params[key];
      if (value !== undefined) spark[key] = value;
    }
    if (params.sortRadial !== undefined) spark.sortRadial = params.sortRadial;
    if (params.enable2DGS !== undefined) spark.enable2DGS = params.enable2DGS;

    // LoD 参数需要显式标记遍历结果失效；排序模式也需要触发重排。
    if (
      params.lodSplatScale !== undefined ||
      params.lodRenderScale !== undefined ||
      params.coneFov0 !== undefined ||
      params.coneFov !== undefined ||
      params.coneFoveate !== undefined ||
      params.behindFoveate !== undefined
    ) {
      spark.lodDirty = true;
    }
    if (params.sortRadial !== undefined) spark.sortDirty = true;
    spark.setDirty();
  }

  private setAutoRotate(enabled: boolean) {
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
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearPressedKeys);
    this.controls?.removeEventListener('start', this.stopAutoRotate);
    this.clearPressedKeys();
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.splat?.dispose();
    this.spark?.dispose();
    this.renderer?.dispose();
    this.scene.clear();
  }
}
