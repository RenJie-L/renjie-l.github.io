import * as THREE from 'three';
import {
  WEST_LAKE_LANDMARKS,
  getLandmark,
} from '@/scripts/west-lake/config/chapters';

export class LandmarkController {
  private root: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private targets = new Map<string, THREE.Object3D[]>();
  private labels = new Map<string, HTMLElement>();
  private projected = new THREE.Vector3();
  private hovered?: string;

  constructor(
    root: HTMLElement,
    camera: THREE.PerspectiveCamera,
    targets: Map<string, THREE.Object3D[]>,
  ) {
    this.root = root;
    this.camera = camera;
    this.targets = targets;
    root
      .querySelectorAll<HTMLElement>('[data-landmark-label]')
      .forEach((label) => {
        const id = label.dataset.landmarkLabel;
        if (id) this.labels.set(id, label);
      });
  }

  pick(event: PointerEvent) {
    const rect = this.root.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const [id, targets] of this.targets) {
      if (this.raycaster.intersectObjects(targets, true).length > 0) return id;
    }
    return undefined;
  }

  setHoverFromPointer(event: PointerEvent) {
    const next = this.pick(event);
    if (next === this.hovered) return;
    this.hovered = next;
    this.root.dataset.landmarkHover = next ?? '';
    this.root.style.cursor = next ? 'pointer' : '';
  }

  update() {
    WEST_LAKE_LANDMARKS.forEach((landmark) => {
      const label = this.labels.get(landmark.id);
      if (!label) return;
      this.projected.set(...landmark.position).project(this.camera);
      const visible =
        this.projected.z > -1 &&
        this.projected.z < 1 &&
        Math.abs(this.projected.x) < 1.08 &&
        Math.abs(this.projected.y) < 1.08;
      label.toggleAttribute('data-visible', visible);
      if (!visible) return;
      label.style.setProperty(
        '--label-x',
        `${(this.projected.x * 0.5 + 0.5) * 100}%`,
      );
      label.style.setProperty(
        '--label-y',
        `${(-this.projected.y * 0.5 + 0.5) * 100}%`,
      );
    });
  }

  select(id: string) {
    const landmark = getLandmark(id);
    if (!landmark) return;
    this.root.dispatchEvent(
      new CustomEvent('westlake:landmark', {
        detail: { id: landmark.id, chapterId: landmark.chapterId },
      }),
    );
  }

  resetCursor() {
    this.hovered = undefined;
    this.root.dataset.landmarkHover = '';
    this.root.style.cursor = '';
  }

  destroy() {
    this.resetCursor();
  }
}
