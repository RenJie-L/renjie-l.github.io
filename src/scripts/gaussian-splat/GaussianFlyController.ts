import * as THREE from 'three';

const FLY_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
]);

const MAX_PITCH = Math.PI / 2 - 0.01;

/** Desktop fly controls with drag-to-look and keyboard movement. */
export class GaussianFlyController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly pressedKeys = new Set<string>();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly direction = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private activePointerId?: number;
  private pointerX = 0;
  private pointerY = 0;
  private enabled = false;
  private inputEnabled = true;
  private movementSpeed = 1;
  private readonly lookSpeed = 0.003;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearInput);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerEnd);
    canvas.addEventListener('pointercancel', this.handlePointerEnd);
    canvas.addEventListener(
      'lostpointercapture',
      this.handleLostPointerCapture,
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearInput();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) this.clearInput();
  }

  setMovementSpeed(speed: number): void {
    this.movementSpeed = speed;
  }

  update(deltaTime: number): void {
    if (!this.enabled || !this.inputEnabled || this.pressedKeys.size === 0) {
      return;
    }

    this.camera.getWorldDirection(this.forward).normalize();
    this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    this.direction.set(0, 0, 0);

    if (this.pressedKeys.has('KeyW')) this.direction.add(this.forward);
    if (this.pressedKeys.has('KeyS')) this.direction.sub(this.forward);
    if (this.pressedKeys.has('KeyD')) this.direction.add(this.right);
    if (this.pressedKeys.has('KeyA')) this.direction.sub(this.right);
    if (this.pressedKeys.has('KeyQ')) this.direction.y += 1;
    if (this.pressedKeys.has('KeyE')) this.direction.y -= 1;
    if (this.direction.lengthSq() === 0) return;

    const boost =
      this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight')
        ? 3
        : 1;
    this.direction
      .normalize()
      .multiplyScalar(this.movementSpeed * boost * deltaTime);
    this.camera.position.add(this.direction);
  }

  dispose(): void {
    this.clearInput();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearInput);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerEnd);
    this.canvas.removeEventListener('pointercancel', this.handlePointerEnd);
    this.canvas.removeEventListener(
      'lostpointercapture',
      this.handleLostPointerCapture,
    );
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled || !this.inputEnabled || !FLY_KEYS.has(event.code)) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target?.matches('input, textarea, select, button') ||
      target?.isContentEditable
    ) {
      return;
    }
    event.preventDefault();
    this.pressedKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (
      !this.enabled ||
      !this.inputEnabled ||
      event.button !== 0 ||
      this.activePointerId !== undefined
    ) {
      return;
    }
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.dataset.flyLooking = 'true';
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (
      !this.enabled ||
      !this.inputEnabled ||
      event.pointerId !== this.activePointerId
    ) {
      return;
    }
    const deltaX = event.clientX - this.pointerX;
    const deltaY = event.clientY - this.pointerY;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;

    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.euler.y -= deltaX * this.lookSpeed;
    this.euler.x = THREE.MathUtils.clamp(
      this.euler.x - deltaY * this.lookSpeed,
      -MAX_PITCH,
      MAX_PITCH,
    );
    this.euler.z = 0;
    this.camera.quaternion.setFromEuler(this.euler);
  };

  private readonly handlePointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.endPointerLook();
  };

  private readonly handleLostPointerCapture = (event: PointerEvent) => {
    if (event.pointerId === this.activePointerId) this.endPointerLook();
  };

  private readonly clearInput = () => {
    this.pressedKeys.clear();
    if (
      this.activePointerId !== undefined &&
      this.canvas.hasPointerCapture(this.activePointerId)
    ) {
      this.canvas.releasePointerCapture(this.activePointerId);
    }
    this.endPointerLook();
  };

  private endPointerLook(): void {
    this.activePointerId = undefined;
    delete this.canvas.dataset.flyLooking;
  }
}
