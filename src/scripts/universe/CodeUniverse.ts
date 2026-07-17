import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { universeConfig, universeProjects } from '@/data/universe';

type ProgressDetail = { progress: number; status: string };

export class CodeUniverse {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  private renderer?: THREE.WebGLRenderer;
  private lastTime = 0;
  private elapsed = 0;
  private frame = 0;
  private running = false;
  private destroyed = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private liteMode =
    innerWidth < 680 ||
    (navigator.hardwareConcurrency !== undefined &&
      navigator.hardwareConcurrency <= 4);
  private pointer = new THREE.Vector2(8, 8);
  private pointerTarget = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private planetMeshes: THREE.Mesh[] = [];
  private animatedObjects: THREE.Object3D[] = [];
  private hovered?: THREE.Mesh;
  private scrollTrigger?: ScrollTrigger;
  private observer?: IntersectionObserver;

  constructor(host: HTMLElement) {
    this.host = host;
    const canvas = host.querySelector<HTMLCanvasElement>(
      '[data-universe-canvas]',
    );
    if (!canvas) throw new Error('Universe canvas is missing.');
    this.canvas = canvas;
  }

  init() {
    if (this.reducedMotion) {
      this.host.dataset.mode = 'static';
      this.emitProgress(100, 'Reduced motion mode');
      return false;
    }

    try {
      this.emitProgress(12, 'Initializing renderer…');
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: !this.liteMode,
        powerPreference: this.liteMode ? 'low-power' : 'high-performance',
      });
      this.renderer.setPixelRatio(
        Math.min(
          devicePixelRatio,
          this.liteMode
            ? universeConfig.renderer.maxPixelRatioMobile
            : universeConfig.renderer.maxPixelRatioDesktop,
        ),
      );
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.camera = new THREE.PerspectiveCamera(
        universeConfig.camera.fov,
        1,
        universeConfig.camera.near,
        universeConfig.camera.far,
      );
      this.camera.position.set(0, 0, 9);

      this.emitProgress(34, 'Mapping star field…');
      this.createStarField();
      this.emitProgress(58, 'Compiling code core…');
      this.createCore();
      this.emitProgress(78, 'Connecting project nodes…');
      this.createPlanets();
      this.createLights();
      this.bindEvents();
      this.resize();
      this.host.dataset.mode = this.liteMode ? 'lite' : 'full';
      this.emitProgress(
        100,
        this.liteMode ? 'Lite mode ready' : 'Universe ready',
      );
      return true;
    } catch (error) {
      console.warn('Code Universe switched to static mode.', error);
      this.host.dataset.mode = 'static';
      this.emitProgress(100, 'Static mode ready');
      this.destroy();
      return false;
    }
  }

  start() {
    if (!this.renderer || this.running || this.destroyed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.setupScroll();
    this.animate();
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

  resize = () => {
    if (!this.renderer) return;
    const { width, height } = this.host.getBoundingClientRect();
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    this.scrollTrigger?.kill();
    this.observer?.disconnect();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line
      ) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material?.dispose());
      }
    });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined;
  }

  private emitProgress(progress: number, status: string) {
    this.host.dispatchEvent(
      new CustomEvent<ProgressDetail>('universe:progress', {
        detail: { progress, status },
      }),
    );
  }

  private createStarField() {
    const count = this.liteMode
      ? innerWidth < 680
        ? universeConfig.particles.mobile
        : universeConfig.particles.tablet
      : universeConfig.particles.desktop;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const cool = new THREE.Color('#72cfff');
    const white = new THREE.Color('#f4f7ff');
    for (let index = 0; index < count; index += 1) {
      const radius = 7 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[index * 3 + 2] = radius * Math.cos(phi) - 6;
      const color = Math.random() > 0.78 ? cool : white;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: this.liteMode ? 0.025 : 0.032,
        transparent: true,
        opacity: 0.7,
        vertexColors: true,
        sizeAttenuation: true,
      }),
    );
    points.name = 'star-field';
    this.scene.add(points);
    this.animatedObjects.push(points);
  }

  private createCore() {
    const group = new THREE.Group();
    group.name = 'code-core';
    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.92, 2),
      new THREE.MeshStandardMaterial({
        color: '#07152d',
        emissive: '#164f8f',
        emissiveIntensity: 0.7,
        roughness: 0.5,
        metalness: 0.5,
        transparent: true,
        opacity: 0.84,
      }),
    );
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.08, 2)),
      new THREE.LineBasicMaterial({
        color: '#7fdcff',
        transparent: true,
        opacity: 0.58,
      }),
    );
    group.add(inner, wire);
    [1.55, 1.95].forEach((radius, index) => {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.42);
      const geometry = new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(96),
      );
      const orbit = new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({
          color: index === 0 ? '#6ed8ff' : '#7a72ef',
          transparent: true,
          opacity: 0.24,
        }),
      );
      orbit.rotation.set(Math.PI / 2.25 + index * 0.28, index * 0.35, 0);
      group.add(orbit);
    });
    this.scene.add(group);
    this.animatedObjects.push(group);
  }

  private createPlanets() {
    universeProjects.forEach((project) => {
      const geometry = new THREE.IcosahedronGeometry(
        project.planetSize,
        this.liteMode ? 1 : 2,
      );
      const material = new THREE.MeshStandardMaterial({
        color: project.accent,
        emissive: project.accent,
        emissiveIntensity: 0.22,
        roughness: 0.72,
        metalness: 0.22,
        flatShading: true,
      });
      const planet = new THREE.Mesh(geometry, material);
      planet.position.set(...project.position);
      planet.userData = {
        slug: project.slug,
        baseScale: 1,
        speed: project.orbitSpeed,
      };
      this.scene.add(planet);
      this.planetMeshes.push(planet);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(
          project.planetSize * 1.42,
          project.planetSize * 1.46,
          64,
        ),
        new THREE.MeshBasicMaterial({
          color: project.accent,
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.copy(planet.position);
      ring.rotation.set(Math.PI / 2.7, 0.3, 0.1);
      this.scene.add(ring);
    });
  }

  private createLights() {
    this.scene.add(new THREE.AmbientLight('#b8c8ff', 0.72));
    const key = new THREE.PointLight('#7fdcff', 18, 18);
    key.position.set(1.5, 2.5, 4);
    this.scene.add(key);
    const warm = new THREE.PointLight('#f0ad5f', 8, 12);
    warm.position.set(3, -2, 2);
    this.scene.add(warm);
  }

  private bindEvents() {
    addEventListener('resize', this.resize, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.addEventListener('pointermove', this.onPointerMove, {
      passive: true,
    });
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('click', this.onClick);
    this.observer = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? this.resume() : this.pause()),
      { threshold: 0.02 },
    );
    this.observer.observe(this.host);
  }

  private setupScroll() {
    gsap.registerPlugin(ScrollTrigger);
    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.host,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.8,
      onUpdate: ({ progress }) => {
        this.camera.position.z = 9 - progress * 1.6;
        this.scene.rotation.z = progress * 0.055;
        this.canvas.style.opacity = String(1 - progress * 0.72);
      },
    });
  }

  private animate = (now = performance.now()) => {
    if (!this.running || !this.renderer) return;
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += delta;
    this.pointer.x +=
      (this.pointerTarget.x - this.pointer.x) *
      universeConfig.motion.cameraLerp;
    this.pointer.y +=
      (this.pointerTarget.y - this.pointer.y) *
      universeConfig.motion.cameraLerp;
    this.camera.position.x = this.pointer.x * 0.34;
    this.camera.position.y = this.pointer.y * 0.22;
    this.camera.lookAt(0, 0, 0);
    this.animatedObjects.forEach((object, index) => {
      object.rotation.y += delta * (index === 0 ? 0.012 : 0.08);
      if (object.name === 'code-core') {
        const scale = 1 + Math.sin(this.elapsed * 1.3) * 0.018;
        object.scale.setScalar(scale);
      }
    });
    this.planetMeshes.forEach((planet) => {
      planet.rotation.y += delta * (planet.userData.speed as number);
      planet.rotation.x += delta * 0.04;
    });
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointerTarget, this.camera);
    const hit = this.raycaster.intersectObjects(this.planetMeshes, false)[0]
      ?.object as THREE.Mesh | undefined;
    if (hit === this.hovered) return;
    if (this.hovered)
      gsap.to(this.hovered.scale, { x: 1, y: 1, z: 1, duration: 0.25 });
    this.hovered = hit;
    this.canvas.style.cursor = hit ? 'pointer' : 'default';
    if (hit) {
      gsap.to(hit.scale, { x: 1.18, y: 1.18, z: 1.18, duration: 0.25 });
      this.host.dispatchEvent(
        new CustomEvent('universe:hover', {
          detail: { slug: hit.userData.slug },
        }),
      );
    } else {
      this.host.dispatchEvent(
        new CustomEvent('universe:hover', { detail: { slug: null } }),
      );
    }
  };

  private onPointerLeave = () => {
    this.pointerTarget.set(0, 0);
    if (this.hovered)
      gsap.to(this.hovered.scale, { x: 1, y: 1, z: 1, duration: 0.25 });
    this.hovered = undefined;
    this.canvas.style.cursor = 'default';
  };

  private onClick = () => {
    if (!this.hovered) return;
    const slug = this.hovered.userData.slug as string;
    const { x, y, z } = this.hovered.position;
    gsap.to(this.camera.position, {
      x: x * 0.2,
      y: y * 0.2,
      z: Math.max(5.8, z + 7),
      duration: 0.7,
      ease: 'power2.out',
      onComplete: () => {
        this.host.dispatchEvent(
          new CustomEvent('universe:select', {
            detail: { slug },
          }),
        );
      },
    });
  };

  private onVisibilityChange = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
}
