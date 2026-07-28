import * as THREE from 'three';
import type { SceneChapter, SceneQuality } from '@/scripts/west-lake/types';

export class Water {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private nearTarget = new THREE.Color('#365f68');
  private farTarget = new THREE.Color('#a8bfbd');
  private sunsetTarget = 0;

  constructor(scene: THREE.Scene, quality: SceneQuality) {
    const geometry = new THREE.PlaneGeometry(
      24,
      20,
      quality.waterSegments,
      quality.waterSegments,
    );
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRippleCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uRippleStarted: { value: -10 },
        uNearColor: { value: this.nearTarget.clone() },
        uFarColor: { value: this.farTarget.clone() },
        uSunset: { value: 0 },
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
          float waveC = sin((position.x + position.y) * 4.1 + uTime * 0.2) * 0.008;
          transformed.z += waveA + waveB + waveC;
          vWave = waveA + waveB + waveC;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float uTime;
        uniform vec2 uRippleCenter;
        uniform float uRippleStarted;
        uniform vec3 uNearColor;
        uniform vec3 uFarColor;
        uniform float uSunset;

        float waterNoise(vec2 point) {
          return fract(52.9829189 * fract(dot(point, vec2(0.06711056, 0.00583715))));
        }

        void main() {
          float grain = (waterNoise(floor(vUv * 900.0)) - 0.5) * 0.008;
          float inkLine = sin(vUv.y * 145.0 + vWave * 48.0 + uTime * 0.5) * 0.018;
          float age = uTime - uRippleStarted;
          float radius = distance(vUv, uRippleCenter);
          float ripple = sin(radius * 125.0 - age * 9.0) * exp(-radius * 9.0);
          ripple *= smoothstep(3.2, 0.0, age) * step(0.0, age) * 0.08;
          float shoreFade = smoothstep(0.0, 0.08, vUv.x) *
            smoothstep(1.0, 0.92, vUv.x);
          vec3 color = mix(uNearColor, uFarColor, smoothstep(0.02, 0.9, vUv.y));
          float sunsetColumn = exp(-pow((vUv.x - 0.625) * 7.0, 2.0));
          float sunsetDistance = smoothstep(0.38, 0.96, vUv.y);
          float sunsetRipple = 0.72 + sin(vUv.y * 210.0 + uTime * 0.35) * 0.28;
          float sunsetReflection =
            sunsetColumn * sunsetDistance * sunsetRipple * uSunset;
          color = mix(color, vec3(0.88, 0.64, 0.34), sunsetReflection * 0.28);
          color += inkLine + ripple + grain;
          color *= mix(0.94, 1.0, shoreFade);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'west-lake-water';
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, -1.02, -1.5);
    scene.add(this.mesh);
  }

  update(elapsed: number) {
    this.mesh.material.uniforms.uTime.value = elapsed;
    const near = this.mesh.material.uniforms.uNearColor.value as THREE.Color;
    const far = this.mesh.material.uniforms.uFarColor.value as THREE.Color;
    near.lerp(this.nearTarget, 0.025);
    far.lerp(this.farTarget, 0.025);
    const sunset = this.mesh.material.uniforms.uSunset;
    sunset.value += (this.sunsetTarget - sunset.value) * 0.025;
  }

  setChapter(chapter: SceneChapter) {
    this.nearTarget.set(chapter.waterNear);
    this.farTarget.set(chapter.waterFar);
    this.sunsetTarget = chapter.id === 'leifeng-sunset' ? 1 : 0;
  }

  ripple(uv: THREE.Vector2, elapsed: number) {
    this.mesh.material.uniforms.uRippleCenter.value.copy(uv);
    this.mesh.material.uniforms.uRippleStarted.value = elapsed;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
