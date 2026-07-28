import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const InkShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    inkStrength: { value: 0.28 },
    paperStrength: { value: 0.012 },
    sharpness: { value: 0.12 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform float inkStrength;
    uniform float paperStrength;
    uniform float sharpness;
    varying vec2 vUv;

    float inkLuma(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    float inkNoise(vec2 point) {
      return fract(52.9829189 * fract(dot(point, vec2(0.06711056, 0.00583715))));
    }

    void main() {
      vec2 pixel = 1.0 / resolution;
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      vec3 leftColor = texture2D(tDiffuse, vUv - vec2(pixel.x, 0.0)).rgb;
      vec3 rightColor = texture2D(tDiffuse, vUv + vec2(pixel.x, 0.0)).rgb;
      vec3 upColor = texture2D(tDiffuse, vUv + vec2(0.0, pixel.y)).rgb;
      vec3 downColor = texture2D(tDiffuse, vUv - vec2(0.0, pixel.y)).rgb;
      float left = inkLuma(leftColor);
      float right = inkLuma(rightColor);
      float up = inkLuma(upColor);
      float down = inkLuma(downColor);
      float edge = smoothstep(0.045, 0.24, abs(right - left) + abs(up - down));
      vec3 neighborAverage = (leftColor + rightColor + upColor + downColor) * 0.25;
      color += clamp(color - neighborAverage, vec3(-0.12), vec3(0.12)) * sharpness;
      color = floor(color * 64.0 + 0.5) / 64.0;
      color *= 1.0 - edge * inkStrength;
      float grain = inkNoise(floor(vUv * resolution));
      color += (grain - 0.5) * paperStrength;
      float vignette = 1.0 - smoothstep(0.38, 0.72, distance(vUv, vec2(0.5)));
      color *= mix(0.97, 1.0, vignette);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class InkPostProcessing {
  private composer: EffectComposer;
  private inkPass: ShaderPass;
  private renderer: THREE.WebGLRenderer;
  private failed = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.inkPass = new ShaderPass(InkShader);
    this.composer.addPass(this.inkPass);
    this.composer.addPass(new OutputPass());
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    (this.inkPass.uniforms.resolution.value as THREE.Vector2).set(
      width * pixelRatio,
      height * pixelRatio,
    );
  }

  render(elapsed: number, delta: number) {
    if (this.failed) return false;
    this.inkPass.uniforms.time.value = elapsed;
    const previousShaderError = this.renderer.debug.onShaderError;
    let inkShaderFailed = false;
    this.renderer.debug.onShaderError = (
      gl,
      program,
      vertexShader,
      fragmentShader,
    ) => {
      const source = gl.getShaderSource(fragmentShader) ?? '';
      if (source.includes('paperStrength')) inkShaderFailed = true;
      if (previousShaderError) {
        previousShaderError(gl, program, vertexShader, fragmentShader);
      } else {
        console.error('WebGL shader compilation failed.', {
          program: gl.getProgramInfoLog(program),
          vertex: gl.getShaderInfoLog(vertexShader),
          fragment: gl.getShaderInfoLog(fragmentShader),
        });
      }
    };
    try {
      this.composer.render(delta);
    } finally {
      this.renderer.debug.onShaderError = previousShaderError;
    }
    this.failed = inkShaderFailed;
    return !this.failed;
  }

  dispose() {
    this.composer.dispose();
    this.inkPass.dispose();
  }
}
