import * as THREE from 'three';
import { disposeObject } from '@/scripts/west-lake/core/dispose';
import type { SceneQuality } from '@/scripts/west-lake/types';

interface BoatRecord {
  group: THREE.Group;
  baseX: number;
  baseY: number;
  phase: number;
}

export class Boats {
  readonly group = new THREE.Group();

  private boats: BoatRecord[] = [];

  constructor(scene: THREE.Scene, quality: SceneQuality) {
    this.group.name = 'west-lake-boats';
    scene.add(this.group);
    const placements = quality.lite
      ? [
          [1.7, -0.84, 2.35, -0.38],
          [-1.75, -0.86, -0.25, 0.62],
        ]
      : [
          [1.7, -0.84, 2.35, -0.38],
          [-1.75, -0.86, -0.25, 0.62],
          [3.65, -0.86, -1.05, -0.72],
        ];
    placements.forEach(([x, y, z, rotation], index) => {
      const boat = this.createBoat(index);
      boat.position.set(x, y, z);
      boat.rotation.y = rotation;
      this.group.add(boat);
      this.boats.push({
        group: boat,
        baseX: x,
        baseY: y,
        phase: index * 1.7,
      });
    });
  }

  private createBoat(index: number) {
    const boat = new THREE.Group();
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: index === 1 ? '#6d5948' : '#435653',
      roughness: 0.92,
    });
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.13, 0.32),
      hullMaterial,
    );
    hull.scale.set(1, 1, 0.72);
    boat.add(hull);
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.38, 5),
      hullMaterial,
    );
    bow.rotation.z = -Math.PI / 2;
    bow.position.x = 0.68;
    boat.add(bow);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.24, 0.3),
      new THREE.MeshStandardMaterial({
        color: '#b8aa8c',
        roughness: 1,
      }),
    );
    canopy.position.set(-0.12, 0.17, 0);
    boat.add(canopy);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.72, 5),
      new THREE.MeshStandardMaterial({ color: '#344846', roughness: 1 }),
    );
    pole.position.set(-0.42, 0.31, 0);
    pole.rotation.z = -0.24;
    boat.add(pole);

    const wakeMaterial = new THREE.LineBasicMaterial({
      color: '#d7dfd5',
      transparent: true,
      opacity: 0.3,
    });
    [-0.12, 0.12].forEach((offset) => {
      const wake = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.55, -0.045, offset),
          new THREE.Vector3(-1.05, -0.048, offset * 1.5),
          new THREE.Vector3(-1.65, -0.05, offset * 2.4),
        ]),
        wakeMaterial,
      );
      boat.add(wake);
    });
    return boat;
  }

  update(elapsed: number) {
    this.boats.forEach((boat, index) => {
      boat.group.position.y =
        boat.baseY + Math.sin(elapsed * 0.72 + boat.phase) * 0.018;
      boat.group.rotation.z = Math.sin(elapsed * 0.48 + boat.phase) * 0.012;
      boat.group.position.x =
        boat.baseX + Math.sin(elapsed * 0.08 + index) * 0.015;
    });
  }

  dispose() {
    disposeObject(this.group);
  }
}
