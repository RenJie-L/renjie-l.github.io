import * as THREE from 'three';
import { disposeObject, seededRandom } from '@/scripts/west-lake/core/dispose';
import type { SceneQuality } from '@/scripts/west-lake/types';

export class Atmosphere {
  readonly group = new THREE.Group();

  private mist: THREE.Points;
  private birds = new THREE.Group();
  private mistTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, quality: SceneQuality) {
    this.group.name = 'west-lake-atmosphere';
    scene.add(this.group);
    const { mist, texture } = this.createMist(quality);
    this.mist = mist;
    this.mistTexture = texture;
    this.group.add(mist);
    this.createBirds(quality);
  }

  private createMist(quality: SceneQuality) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create mist texture.');
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(245,248,242,0.72)');
    gradient.addColorStop(0.45, 'rgba(235,242,238,0.28)');
    gradient.addColorStop(1, 'rgba(235,242,238,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
    const texture = new THREE.CanvasTexture(canvas);
    const count = quality.lite ? 22 : 42;
    const positions = new Float32Array(count * 3);
    const random = seededRandom(602);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = -9 + random() * 18;
      positions[index * 3 + 1] = -0.5 + random() * 2.2;
      positions[index * 3 + 2] = -8 + random() * 11;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mist = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: texture,
        color: '#edf4ef',
        size: quality.lite ? 1.05 : 1.25,
        transparent: true,
        opacity: 0.085,
        depthWrite: false,
      }),
    );
    return { mist, texture };
  }

  private createBirds(quality: SceneQuality) {
    const positions = quality.lite
      ? [
          [-1.5, 2.25, -7.2],
          [-0.85, 2.48, -7.1],
          [-0.25, 2.22, -7.4],
        ]
      : [
          [-1.5, 2.25, -7.2],
          [-0.85, 2.48, -7.1],
          [-0.25, 2.22, -7.4],
          [0.25, 2.6, -7.25],
          [0.82, 2.42, -7.5],
        ];
    positions.forEach(([x, y, z], index) => {
      const bird = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.12, 0, 0),
          new THREE.Vector3(0, 0.07 + index * 0.006, 0),
          new THREE.Vector3(0.12, 0, 0),
        ]),
        new THREE.LineBasicMaterial({
          color: '#40595b',
          transparent: true,
          opacity: 0.62,
        }),
      );
      bird.position.set(x, y, z);
      this.birds.add(bird);
    });
    this.group.add(this.birds);
  }

  update(elapsed: number) {
    this.mist.position.x = Math.sin(elapsed * 0.07) * 0.24;
    this.mist.rotation.y = Math.sin(elapsed * 0.035) * 0.006;
    this.birds.position.x = Math.sin(elapsed * 0.1) * 0.3;
    this.birds.position.y = Math.sin(elapsed * 0.22) * 0.08;
  }

  dispose() {
    disposeObject(this.group);
    this.mistTexture.dispose();
  }
}
