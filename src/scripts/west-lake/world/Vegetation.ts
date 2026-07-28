import * as THREE from 'three';
import { disposeObject, seededRandom } from '@/scripts/west-lake/core/dispose';
import type { SceneQuality } from '@/scripts/west-lake/types';

export class Vegetation {
  readonly group = new THREE.Group();
  readonly lotusTarget: THREE.InstancedMesh;

  private lotusField = new THREE.Group();
  private lotusMatrices: THREE.Matrix4[] = [];

  constructor(
    scene: THREE.Scene,
    causeway: THREE.CatmullRomCurve3,
    quality: SceneQuality,
  ) {
    this.group.name = 'west-lake-vegetation';
    this.lotusField.name = 'west-lake-lotus-field';
    scene.add(this.group);
    this.group.add(this.lotusField);
    this.createTrees(causeway, quality);
    this.lotusTarget = this.createLotus(quality);
    this.createReeds(quality);
  }

  private createTrees(causeway: THREE.CatmullRomCurve3, quality: SceneQuality) {
    const random = seededRandom(318);
    const count = Math.max(20, Math.round(52 * quality.vegetationScale));
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.055, 0.62, 5),
      new THREE.MeshStandardMaterial({
        color: '#53635b',
        roughness: 1,
      }),
      count,
    );
    const crown = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.28, 0.9, 7),
      new THREE.MeshStandardMaterial({
        color: '#41675c',
        roughness: 1,
        transparent: true,
        opacity: 0.86,
      }),
      count,
    );
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (let index = 0; index < count; index += 1) {
      let x: number;
      let z: number;
      if (index < count * 0.55) {
        const point = causeway.getPoint((index + 0.75) / (count * 0.55 + 1));
        const side = index % 2 === 0 ? -1 : 1;
        x = point.x + side * (0.43 + random() * 0.16);
        z = point.z + (random() - 0.5) * 0.42;
      } else {
        const side = index % 2 === 0 ? -1 : 1;
        x = side * (6.15 + random() * 0.65);
        z = -5.4 + random() * 11.2;
      }
      const scale = 0.68 + random() * 0.64;
      quaternion.setFromEuler(
        new THREE.Euler(0, random() * Math.PI * 2, (random() - 0.5) * 0.06),
      );
      matrix.compose(
        new THREE.Vector3(x, -0.58 + (scale - 1) * 0.12, z),
        quaternion,
        new THREE.Vector3(scale, scale, scale),
      );
      trunk.setMatrixAt(index, matrix);
      matrix.compose(
        new THREE.Vector3(x, -0.02 + scale * 0.08, z),
        quaternion,
        new THREE.Vector3(scale * 0.85, scale * 1.15, scale * 0.85),
      );
      crown.setMatrixAt(index, matrix);
    }
    trunk.instanceMatrix.needsUpdate = true;
    crown.instanceMatrix.needsUpdate = true;
    this.group.add(trunk, crown);
  }

  private createLotus(quality: SceneQuality) {
    const random = seededRandom(726);
    const count = Math.max(22, Math.round(58 * quality.vegetationScale));
    const geometry = new THREE.CylinderGeometry(0.22, 0.22, 0.025, 14);
    const material = new THREE.MeshStandardMaterial({
      color: '#4b7468',
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const lotus = new THREE.InstancedMesh(geometry, material, count);
    lotus.name = 'lotus-courtyard';
    const quaternion = new THREE.Quaternion();
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const x = -0.5 + Math.cos(angle) * radius * 3.15;
      const z = 1.25 + Math.sin(angle) * radius * 2.4;
      const scale = 0.48 + random() * 0.95;
      const y = -0.91 + random() * 0.018;
      quaternion.setFromEuler(
        new THREE.Euler(0, random() * Math.PI, (random() - 0.5) * 0.07),
      );
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        quaternion,
        new THREE.Vector3(scale * 1.35, 1, scale * 0.82),
      );
      this.lotusMatrices.push(matrix);
      lotus.setMatrixAt(index, matrix);
    }
    lotus.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    lotus.instanceMatrix.needsUpdate = true;
    this.lotusField.add(lotus);

    const blossomCount = Math.max(5, Math.round(12 * quality.vegetationScale));
    const blossoms = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 7, 5),
      new THREE.MeshStandardMaterial({
        color: '#c98586',
        roughness: 0.95,
      }),
      blossomCount,
    );
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < blossomCount; index += 1) {
      const sourceIndex = Math.floor((index / blossomCount) * count);
      const source = new THREE.Vector3().setFromMatrixPosition(
        this.lotusMatrices[sourceIndex],
      );
      matrix.makeTranslation(
        source.x,
        source.y + 0.22 + random() * 0.18,
        source.z,
      );
      blossoms.setMatrixAt(index, matrix);
    }
    blossoms.instanceMatrix.needsUpdate = true;
    this.lotusField.add(blossoms);
    return lotus;
  }

  private createReeds(quality: SceneQuality) {
    const random = seededRandom(924);
    const count = Math.max(24, Math.round(72 * quality.vegetationScale));
    const reeds = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.008, 0.013, 0.48, 4),
      new THREE.MeshStandardMaterial({
        color: '#617365',
        roughness: 1,
      }),
      count,
    );
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (5.72 + random() * 0.5);
      const z = -4.8 + random() * 10.3;
      const height = 0.55 + random() * 0.65;
      quaternion.setFromEuler(
        new THREE.Euler(
          (random() - 0.5) * 0.12,
          random() * Math.PI,
          (random() - 0.5) * 0.16,
        ),
      );
      matrix.compose(
        new THREE.Vector3(x, -0.88 + height * 0.22, z),
        quaternion,
        new THREE.Vector3(1, height, 1),
      );
      reeds.setMatrixAt(index, matrix);
    }
    reeds.instanceMatrix.needsUpdate = true;
    this.group.add(reeds);
  }

  update(elapsed: number) {
    this.lotusField.position.y = Math.sin(elapsed * 0.55) * 0.006;
    this.lotusField.rotation.z = Math.sin(elapsed * 0.32) * 0.0025;
  }

  dispose() {
    disposeObject(this.group);
  }
}
