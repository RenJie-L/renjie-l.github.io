import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const SPLAT_URL =
  'https://qhrenderstorage-oss.kujiale.com//worldmodel/prod_test/2026/06/24/5470b666-1552-4bfe-ab6e-d42821118b41.spz';

type ProgressCallback = (progress: number, status: string) => void;

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
  private defaultCameraPosition = new THREE.Vector3(0, 0, 5);
  private defaultTarget = new THREE.Vector3();

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
    this.controls.screenSpacePanning = true;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.55;

    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);

    onProgress(8, 'Downloading 7.6 MB SPZ scene…');
    this.splat = new SplatMesh({
      url: SPLAT_URL,
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
    const render = () => {
      if (this.disposed || !this.renderer) return;
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(render);
    };
    render();
  }

  resetView() {
    if (!this.controls) return;
    this.camera.position.copy(this.defaultCameraPosition);
    this.controls.target.copy(this.defaultTarget);
    this.controls.update();
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.controls) this.controls.autoRotate = this.autoRotate;
    return this.autoRotate;
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.splat?.dispose();
    this.spark?.dispose();
    this.renderer?.dispose();
    this.scene.clear();
  }
}
