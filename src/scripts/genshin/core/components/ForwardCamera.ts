import { Component, TWEEN, Vector2, Vector3 } from '../../libs/xviewer';

export const cameraCenter = new Vector3();

const __delta = new Vector3();
const BASE_PITCH = (5.5 * Math.PI) / 180;
const PARALLAX_POSITION_X = 22;
const PARALLAX_POSITION_Y = 12;
const PARALLAX_YAW = 0.018;
const PARALLAX_PITCH = 0.012;
const PARALLAX_ROLL = 0.004;
const PARALLAX_DAMPING = 6;

export class ForwardCamera extends Component {
  public speed = new Vector3(0, 0, -88);
  private readonly pointerTarget = new Vector2();
  private readonly pointerCurrent = new Vector2();
  private shouldStop = false;
  private _zOffset = 0;
  private reducedMotion = false;

  onLoad(): void {
    cameraCenter.set(0, 0, 0);
    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const inputElement = this.getInputElement();
    inputElement.addEventListener('pointermove', this.onPointerMove);
    inputElement.addEventListener('pointerleave', this.onPointerLeave);
    this.on('showDoor', this.stop, this);
    this.on('openDoor', this.openDoor, this);
  }

  update(dt: number): void {
    if (!this.shouldStop) {
      cameraCenter.add(__delta.copy(this.speed).multiplyScalar(dt));
      const alpha = 1 - Math.exp(-PARALLAX_DAMPING * dt);
      this.pointerCurrent.lerp(this.pointerTarget, alpha);

      const pointerX = this.pointerCurrent.x;
      const pointerY = this.pointerCurrent.y;
      this.viewer.camera.position.set(
        cameraCenter.x + pointerX * PARALLAX_POSITION_X,
        cameraCenter.y - pointerY * PARALLAX_POSITION_Y,
        cameraCenter.z,
      );
      this.viewer.camera.rotation.set(
        BASE_PITCH + pointerY * PARALLAX_PITCH,
        -pointerX * PARALLAX_YAW,
        -pointerX * PARALLAX_ROLL,
      );
    }
  }

  onDestroy(): void {
    const inputElement = this.getInputElement();
    inputElement.removeEventListener('pointermove', this.onPointerMove);
    inputElement.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private stop(zOffset: number) {
    this.shouldStop = true;
    this._zOffset = zOffset;
    this.pointerTarget.set(0, 0);
    this.pointerCurrent.set(0, 0);
    TWEEN.TweenManager.Tween(this.viewer.camera)
      .to({ position: new Vector3(0, 0, zOffset - 165) }, 5)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    TWEEN.TweenManager.Tween(this.viewer.camera.rotation)
      .to({ x: BASE_PITCH, y: 0, z: 0 }, 1.2)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
  }

  private openDoor() {
    const orgPos = this.viewer.camera.position.clone();
    TWEEN.TweenManager.KillTweensOf(this.viewer.camera);
    TWEEN.TweenManager.Tween(this.viewer.camera)
      .to(
        { position: new Vector3(orgPos.x, orgPos.y, this._zOffset - 400) },
        0.6,
      )
      .easing(TWEEN.Easing.Cubic.In)
      .start();
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || this.reducedMotion) return;
    const bounds = this.getInputElement().getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.pointerTarget.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
    );
  };

  private onPointerLeave = (): void => {
    this.pointerTarget.set(0, 0);
  };

  private getInputElement(): HTMLElement {
    const canvas = this.viewer.renderer.domElement;
    return canvas.parentElement ?? canvas;
  }
}
