import * as THREE from 'three';
import { disposeObject, seededRandom } from '@/scripts/west-lake/core/dispose';
import type { SceneQuality } from '@/scripts/west-lake/types';

function horizontalShape(
  points: Array<[number, number]>,
  material: THREE.Material,
  y: number,
) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

export class Landscape {
  readonly group = new THREE.Group();
  readonly causewayCurve: THREE.CatmullRomCurve3;
  readonly landmarkTargets = new Map<string, THREE.Object3D[]>();

  constructor(scene: THREE.Scene, quality: SceneQuality) {
    this.group.name = 'west-lake-landscape';
    scene.add(this.group);
    this.createMountains();
    this.createShoreline();
    this.causewayCurve = this.createCauseway();
    this.createBridge();
    this.createPagoda();
    this.createFarShoreBuildings(quality);
  }

  private createMountains() {
    const layers = [
      {
        z: -10,
        y: -0.3,
        height: 2.5,
        color: '#aabbb7',
        opacity: 0.25,
        seed: 2,
      },
      {
        z: -8.2,
        y: -0.55,
        height: 2.15,
        color: '#849d9a',
        opacity: 0.36,
        seed: 7,
      },
      {
        z: -6.4,
        y: -0.7,
        height: 1.55,
        color: '#5e7a79',
        opacity: 0.5,
        seed: 13,
      },
    ];
    layers.forEach((layer) => {
      const shape = new THREE.Shape();
      const width = 19;
      const segments = 24;
      shape.moveTo(-width / 2, -2.4);
      for (let index = 0; index <= segments; index += 1) {
        const x = -width / 2 + (index / segments) * width;
        const wave =
          Math.sin((index + layer.seed) * 0.78) * 0.38 +
          Math.sin((index + layer.seed) * 1.91) * 0.18;
        const peak =
          Math.exp(-Math.pow((index - 15 + (layer.seed % 3)) / 4.2, 2)) *
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
      this.group.add(mountain);
    });

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 48),
      new THREE.MeshBasicMaterial({
        color: '#dfb778',
        transparent: true,
        opacity: 0.58,
      }),
    );
    sun.position.set(3.05, 2.35, -10.45);
    this.group.add(sun);
  }

  private createShoreline() {
    const bankMaterial = new THREE.MeshStandardMaterial({
      color: '#81928a',
      roughness: 1,
      metalness: 0,
    });
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: '#405e5c',
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const leftBank: Array<[number, number]> = [
      [-12, 8],
      [-12, -9],
      [-7.1, -9],
      [-6.3, -6.6],
      [-6.55, -3.6],
      [-5.95, -1.2],
      [-6.4, 1.4],
      [-5.85, 4.1],
      [-6.6, 8],
    ];
    const rightBank: Array<[number, number]> = [
      [12, 8],
      [6.9, 8],
      [6.2, 5.3],
      [6.65, 2.4],
      [5.9, -0.4],
      [6.5, -3.1],
      [6.05, -6.2],
      [7.1, -9],
      [12, -9],
    ];
    const rearBank: Array<[number, number]> = [
      [-7.2, -9],
      [7.25, -9],
      [6.2, -5.9],
      [3.3, -6.25],
      [0.8, -5.85],
      [-2.1, -6.35],
      [-4.8, -5.85],
      [-6.3, -6.65],
    ];
    [leftBank, rightBank, rearBank].forEach((points) => {
      const edge = horizontalShape(points, edgeMaterial, -0.935);
      edge.scale.set(1.015, 1.015, 1.015);
      this.group.add(edge);
      this.group.add(horizontalShape(points, bankMaterial, -0.9));
    });

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.18, 0.14, 18),
      bankMaterial,
    );
    island.position.set(2.55, -0.88, -2.75);
    island.scale.z = 0.62;
    island.rotation.y = -0.35;
    this.group.add(island);

    const islet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.55, 0.1, 14),
      bankMaterial,
    );
    islet.position.set(-1.9, -0.91, -3.8);
    islet.scale.z = 0.6;
    this.group.add(islet);
  }

  private createCauseway() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.35, -0.78, 6.7),
      new THREE.Vector3(-5.55, -0.7, 3.1),
      new THREE.Vector3(-5.25, -0.67, -0.2),
      new THREE.Vector3(-5.45, -0.7, -3.2),
      new THREE.Vector3(-5.1, -0.74, -6.25),
    ]);
    const material = new THREE.MeshStandardMaterial({
      color: '#a7aaa0',
      roughness: 1,
    });
    const road = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 96, 0.24, 8, false),
      material,
    );
    road.name = 'su-causeway';
    this.group.add(road);

    const dark = new THREE.MeshBasicMaterial({
      color: '#536866',
      transparent: true,
      opacity: 0.55,
    });
    [-0.3, 0.3].forEach((offset) => {
      const edgeCurve = new THREE.CatmullRomCurve3(
        curve
          .getPoints(32)
          .map(
            (point) => new THREE.Vector3(point.x + offset, point.y, point.z),
          ),
      );
      this.group.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(edgeCurve, 80, 0.025, 5, false),
          dark,
        ),
      );
    });
    return curve;
  }

  private createBridge() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.72, -0.64, 0.95),
      new THREE.Vector3(-4.8, -0.19, 0.25),
      new THREE.Vector3(-3.6, 0.03, -0.72),
      new THREE.Vector3(-2.35, -0.26, -1.55),
      new THREE.Vector3(-1.32, -0.66, -2.15),
    ]);
    const stone = new THREE.MeshStandardMaterial({
      color: '#aab7b1',
      roughness: 0.95,
      metalness: 0,
    });
    const deck = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 84, 0.2, 8, false),
      stone,
    );
    deck.name = 'broken-bridge';
    this.group.add(deck);

    const targets: THREE.Object3D[] = [deck];
    [-0.25, 0.25].forEach((offset) => {
      const railCurve = new THREE.CatmullRomCurve3(
        curve
          .getPoints(24)
          .map(
            (point) =>
              new THREE.Vector3(point.x, point.y + 0.26, point.z + offset),
          ),
      );
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(railCurve, 64, 0.034, 6, false),
        stone,
      );
      targets.push(rail);
      this.group.add(rail);
    });

    const posts = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.032, 0.04, 0.34, 6),
      stone,
      18,
    );
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (let step = 1; step < 9; step += 1) {
      const point = curve.getPoint(step / 9);
      [-0.25, 0.25].forEach((offset) => {
        matrix.makeTranslation(point.x, point.y + 0.16, point.z + offset);
        posts.setMatrixAt(index, matrix);
        index += 1;
      });
    }
    posts.instanceMatrix.needsUpdate = true;
    targets.push(posts);
    this.group.add(posts);
    this.landmarkTargets.set('broken-bridge', targets);
  }

  private createPagoda() {
    const pagoda = new THREE.Group();
    pagoda.name = 'leifeng-pagoda';
    const dark = new THREE.MeshStandardMaterial({
      color: '#263f42',
      roughness: 0.9,
    });
    const warm = new THREE.MeshBasicMaterial({ color: '#d2a45f' });
    const targets: THREE.Object3D[] = [];
    for (let tier = 0; tier < 5; tier += 1) {
      const y = tier * 0.38;
      const width = 0.7 - tier * 0.07;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.62, 0.34, width * 0.52),
        dark,
      );
      body.position.y = y;
      targets.push(body);
      pagoda.add(body);
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(width, width * 0.76, 0.1, 4),
        dark,
      );
      roof.position.y = y + 0.2;
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.78;
      targets.push(roof);
      pagoda.add(roof);
      if (tier < 4) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.08, 0.025),
          warm,
        );
        light.position.set(0, y + 0.02, width * 0.27);
        pagoda.add(light);
      }
    }
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 8), dark);
    finial.position.y = 2.0;
    targets.push(finial);
    pagoda.add(finial);
    pagoda.position.set(3.9, -0.7, -5.2);
    pagoda.scale.setScalar(1.15);
    this.group.add(pagoda);
    this.landmarkTargets.set('leifeng-pagoda', targets);
  }

  private createFarShoreBuildings(quality: SceneQuality) {
    const random = seededRandom(1208);
    const count = quality.lite ? 16 : 26;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: '#506b69',
      roughness: 1,
      transparent: true,
      opacity: 0.76,
    });
    const buildings = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index += 1) {
      const width = 0.18 + random() * 0.32;
      const height = 0.28 + random() * 0.72;
      const depth = 0.18 + random() * 0.32;
      const x = -5.2 + random() * 10.4;
      const z = -6.1 - random() * 0.65;
      matrix.compose(
        new THREE.Vector3(x, -0.78 + height / 2, z),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, (random() - 0.5) * 0.18, 0),
        ),
        new THREE.Vector3(width, height, depth),
      );
      buildings.setMatrixAt(index, matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;
    this.group.add(buildings);
  }

  dispose() {
    disposeObject(this.group);
  }
}
