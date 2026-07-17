import gsap from 'gsap';
import * as THREE from 'three';

type ProgressHandler = (progress: number, status: string) => void;

export class WestLakeScene {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  private renderer?: THREE.WebGLRenderer;
  private frame = 0;
  private running = false;
  private destroyed = false;
  private lastTime = 0;
  private elapsed = 0;
  private pointer = new THREE.Vector2();
  private pointerTarget = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private water?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private mist?: THREE.Points;
  private mistTexture?: THREE.CanvasTexture;
  private intro?: gsap.core.Timeline;
  private observer?: IntersectionObserver;
  private liteMode =
    innerWidth < 760 ||
    (navigator.hardwareConcurrency !== undefined &&
      navigator.hardwareConcurrency <= 4);

  constructor(root: HTMLElement) {
    this.root = root;
    const canvas = root.querySelector<HTMLCanvasElement>(
      '[data-west-lake-canvas]',
    );
    if (!canvas) throw new Error('West Lake canvas is missing.');
    this.canvas = canvas;
  }

  init(onProgress: ProgressHandler) {
    onProgress(10, 'Preparing renderer…');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.liteMode,
      powerPreference: this.liteMode ? 'low-power' : 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.liteMode ? 1.15 : 1.55),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.setClearColor('#dfe5df', 1);

    this.camera.position.set(0, 2.25, 12.5);
    this.camera.lookAt(0, -0.25, -3.4);
    this.scene.fog = new THREE.FogExp2('#dce4df', 0.055);

    onProgress(28, 'Painting distant mountains…');
    this.createMountains();
    onProgress(46, 'Shaping the lake surface…');
    this.createWater();
    onProgress(62, 'Building bridge and pagoda…');
    this.createBridge();
    this.createPagoda();
    onProgress(76, 'Placing lotus leaves…');
    this.createLotus();
    onProgress(88, 'Releasing mist and birds…');
    this.createMist();
    this.createBirds();
    this.createLights();
    this.bindEvents();
    this.resize();
    this.root.dataset.quality = this.liteMode ? 'lite' : 'full';
    onProgress(100, this.liteMode ? 'Lite scene ready' : 'West Lake ready');
  }

  start() {
    if (!this.renderer || this.running || this.destroyed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.intro = gsap.timeline();
    this.intro
      .to(this.camera.position, {
        z: 9.8,
        y: 1.85,
        duration: 3.6,
        ease: 'power2.inOut',
      })
      .to(
        this.scene.fog as THREE.FogExp2,
        { density: 0.042, duration: 3, ease: 'sine.out' },
        0.4,
      );
    this.animate();
  }

  skipIntro() {
    this.intro?.progress(1);
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
    this.intro?.kill();
    this.observer?.disconnect();
    removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerleave', this.onPointerLeave);
    this.root.removeEventListener('pointerdown', this.onPointerDown);
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
    this.mistTexture?.dispose();
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
  };

  private createMountains() {
    const layers = [
      {
        z: -10,
        y: -0.3,
        height: 2.5,
        color: '#aabbb7',
        opacity: 0.35,
        seed: 2,
      },
      {
        z: -8.2,
        y: -0.55,
        height: 2.15,
        color: '#849d9a',
        opacity: 0.46,
        seed: 7,
      },
      {
        z: -6.4,
        y: -0.7,
        height: 1.55,
        color: '#5e7a79',
        opacity: 0.58,
        seed: 13,
      },
    ];
    layers.forEach((layer) => {
      const shape = new THREE.Shape();
      const width = 18;
      const segments = 16;
      shape.moveTo(-width / 2, -2.4);
      for (let index = 0; index <= segments; index += 1) {
        const x = -width / 2 + (index / segments) * width;
        const wave =
          Math.sin((index + layer.seed) * 0.78) * 0.38 +
          Math.sin((index + layer.seed) * 1.91) * 0.18;
        const peak =
          Math.exp(-Math.pow((index - 10 + (layer.seed % 3)) / 3.8, 2)) *
          layer.height;
        shape.lineTo(x, wave + peak);
      }
      shape.lineTo(width / 2, -2.4);
      shape.closePath();
      const mountain = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false,
        }),
      );
      mountain.position.set(0, layer.y, layer.z);
      this.scene.add(mountain);
    });

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 48),
      new THREE.MeshBasicMaterial({
        color: '#e9c38b',
        transparent: true,
        opacity: 0.55,
      }),
    );
    sun.position.set(-2.3, 2.2, -10.4);
    this.scene.add(sun);
  }

  private createWater() {
    const geometry = new THREE.PlaneGeometry(
      24,
      20,
      this.liteMode ? 48 : 96,
      this.liteMode ? 48 : 96,
    );
    const material = new THREE.ShaderMaterial({
      transparent: false,
      uniforms: {
        uTime: { value: 0 },
        uRippleCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uRippleStarted: { value: -10 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float uTime;

        void main() {
          vUv = uv;
          vec3 transformed = position;
          float waveA = sin(position.x * 1.7 + uTime * 0.38) * 0.026;
          float waveB = cos(position.y * 2.2 - uTime * 0.3) * 0.018;
          transformed.z += waveA + waveB;
          vWave = waveA + waveB;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float uTime;
        uniform vec2 uRippleCenter;
        uniform float uRippleStarted;

        float random(vec2 point) {
          return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec3 nearColor = vec3(0.22, 0.43, 0.48);
          vec3 farColor = vec3(0.66, 0.77, 0.76);
          float grain = random(floor(vUv * 520.0)) * 0.035;
          float inkLine = sin(vUv.y * 145.0 + vWave * 48.0 + uTime * 0.5) * 0.025;
          float age = uTime - uRippleStarted;
          float radius = distance(vUv, uRippleCenter);
          float ripple = sin(radius * 125.0 - age * 9.0) * exp(-radius * 9.0);
          ripple *= smoothstep(3.2, 0.0, age) * step(0.0, age) * 0.08;
          vec3 color = mix(nearColor, farColor, smoothstep(0.02, 0.9, vUv.y));
          color += inkLine + ripple + grain;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.water = new THREE.Mesh(geometry, material);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, -1.02, -1.5);
    this.scene.add(this.water);
  }

  private createBridge() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.5, -0.72, 1.1),
      new THREE.Vector3(-4.8, -0.28, 0.3),
      new THREE.Vector3(-3.15, 0.02, -0.9),
      new THREE.Vector3(-1.6, -0.35, -2.15),
      new THREE.Vector3(-0.3, -0.67, -3.05),
    ]);
    const stone = new THREE.MeshStandardMaterial({
      color: '#a8b9b3',
      roughness: 0.95,
      metalness: 0,
    });
    const deck = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.18, 8, false),
      stone,
    );
    this.scene.add(deck);
    [-0.24, 0.24].forEach((offset) => {
      const railCurve = new THREE.CatmullRomCurve3(
        curve
          .getPoints(22)
          .map(
            (point) =>
              new THREE.Vector3(point.x, point.y + 0.26, point.z + offset),
          ),
      );
      this.scene.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(railCurve, 64, 0.035, 6, false),
          stone,
        ),
      );
    });
  }

  private createPagoda() {
    const pagoda = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({
      color: '#263f42',
      roughness: 0.9,
    });
    const warm = new THREE.MeshBasicMaterial({ color: '#d2a45f' });
    for (let tier = 0; tier < 5; tier += 1) {
      const y = tier * 0.38;
      const width = 0.66 - tier * 0.07;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.62, 0.34, width * 0.52),
        dark,
      );
      body.position.y = y;
      pagoda.add(body);
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(width, width * 0.76, 0.1, 4),
        dark,
      );
      roof.position.y = y + 0.2;
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.78;
      pagoda.add(roof);
      if (tier < 3) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.08, 0.02),
          warm,
        );
        light.position.set(0, y + 0.02, width * 0.27);
        pagoda.add(light);
      }
    }
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 8), dark);
    finial.position.y = 2.0;
    pagoda.add(finial);
    pagoda.position.set(3.9, -0.7, -5.2);
    pagoda.scale.setScalar(1.15);
    this.scene.add(pagoda);
  }

  private createLotus() {
    const count = this.liteMode ? 12 : 24;
    const geometry = new THREE.CylinderGeometry(0.22, 0.22, 0.025, 18);
    const material = new THREE.MeshStandardMaterial({
      color: '#4b7468',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const lotus = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index += 1) {
      const x = -4.5 + Math.random() * 8;
      const z = 0.2 + Math.random() * 5.8;
      const scale = 0.55 + Math.random() * 0.9;
      matrix.compose(
        new THREE.Vector3(x, -0.91, z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, Math.random() * Math.PI, 0),
        ),
        new THREE.Vector3(scale * 1.35, 1, scale * 0.82),
      );
      lotus.setMatrixAt(index, matrix);
    }
    lotus.instanceMatrix.needsUpdate = true;
    this.scene.add(lotus);
  }

  private createMist() {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return;
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(245,248,242,0.72)');
    gradient.addColorStop(0.45, 'rgba(235,242,238,0.28)');
    gradient.addColorStop(1, 'rgba(235,242,238,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
    this.mistTexture = new THREE.CanvasTexture(canvas);

    const count = this.liteMode ? 34 : 72;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = -9 + Math.random() * 18;
      positions[index * 3 + 1] = -0.5 + Math.random() * 2.2;
      positions[index * 3 + 2] = -8 + Math.random() * 11;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mist = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: this.mistTexture,
        color: '#edf4ef',
        size: this.liteMode ? 1.4 : 1.8,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    this.scene.add(this.mist);
  }

  private createBirds() {
    const group = new THREE.Group();
    const positions = [
      [-1.5, 2.25, -7.2],
      [-0.95, 2.48, -7.1],
      [-0.45, 2.22, -7.4],
    ];
    positions.forEach(([x, y, z], index) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.12, 0, 0),
        new THREE.Vector3(0, 0.07 + index * 0.01, 0),
        new THREE.Vector3(0.12, 0, 0),
      ]);
      const bird = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: '#40595b',
          transparent: true,
          opacity: 0.6,
        }),
      );
      bird.position.set(x, y, z);
      group.add(bird);
    });
    this.scene.add(group);
  }

  private createLights() {
    this.scene.add(new THREE.HemisphereLight('#eff5ef', '#4b6666', 2.4));
    const sun = new THREE.DirectionalLight('#f4d7ad', 2.1);
    sun.position.set(-4, 7, 4);
    this.scene.add(sun);
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
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * 0.035;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * 0.035;
    this.camera.position.x = this.pointer.x * 0.32;
    this.camera.lookAt(
      this.pointer.x * 0.14,
      -0.25 + this.pointer.y * 0.08,
      -3.4,
    );
    if (this.water) this.water.material.uniforms.uTime.value = this.elapsed;
    if (this.mist) {
      this.mist.position.x = Math.sin(this.elapsed * 0.07) * 0.24;
      this.mist.rotation.y = Math.sin(this.elapsed * 0.035) * 0.006;
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.root.getBoundingClientRect();
    this.pointerTarget.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
  };

  private onPointerLeave = () => {
    this.pointerTarget.set(0, 0);
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.water) return;
    if (event.target instanceof Element && event.target.closest('a, button'))
      return;
    const rect = this.root.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.water, false)[0];
    if (!hit?.uv) return;
    this.water.material.uniforms.uRippleCenter.value.copy(hit.uv);
    this.water.material.uniforms.uRippleStarted.value = this.elapsed;
  };

  private onVisibilityChange = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
}
