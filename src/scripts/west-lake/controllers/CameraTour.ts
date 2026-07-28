import gsap from 'gsap';
import * as THREE from 'three';
import { WEST_LAKE_CHAPTERS } from '@/scripts/west-lake/config/chapters';
import type { ChapterId, SceneChapter } from '@/scripts/west-lake/types';

export class CameraTour {
  private camera: THREE.PerspectiveCamera;
  private positionCurve: THREE.CatmullRomCurve3;
  private lookCurve: THREE.CatmullRomCurve3;
  private state = { progress: 0, intro: 0 };
  private introPosition = new THREE.Vector3(-4.65, 2.35, 11.7);
  private pointer = new THREE.Vector2();
  private pointerTarget = new THREE.Vector2();
  private activeTween?: gsap.core.Tween;
  private introTween?: gsap.core.Tween;
  private currentChapter: SceneChapter = WEST_LAKE_CHAPTERS[0];

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.positionCurve = new THREE.CatmullRomCurve3(
      WEST_LAKE_CHAPTERS.map((chapter) => new THREE.Vector3(...chapter.camera)),
      false,
      'centripetal',
    );
    this.lookCurve = new THREE.CatmullRomCurve3(
      WEST_LAKE_CHAPTERS.map((chapter) => new THREE.Vector3(...chapter.lookAt)),
      false,
      'centripetal',
    );
    this.camera.position.copy(this.introPosition);
    this.camera.lookAt(new THREE.Vector3(...WEST_LAKE_CHAPTERS[0].lookAt));
  }

  start(onComplete?: () => void) {
    this.introTween?.kill();
    this.state.progress = 0;
    this.introTween = gsap.fromTo(
      this.state,
      { intro: 0 },
      {
        intro: 1,
        duration: 3.4,
        ease: 'power2.inOut',
        onComplete,
      },
    );
  }

  skipIntro() {
    this.introTween?.progress(1);
  }

  goTo(id: ChapterId, onChange?: (chapter: SceneChapter) => void) {
    const chapter = WEST_LAKE_CHAPTERS.find((item) => item.id === id);
    if (!chapter) return;
    this.currentChapter = chapter;
    this.activeTween?.kill();
    this.introTween?.kill();
    this.state.intro = 1;
    this.activeTween = gsap.to(this.state, {
      progress: chapter.progress,
      duration: 2.35,
      ease: 'power3.inOut',
      onStart: () => onChange?.(chapter),
    });
  }

  setPointer(x: number, y: number) {
    this.pointerTarget.set(x, y);
  }

  resetPointer() {
    this.pointerTarget.set(0, 0);
  }

  update() {
    this.pointer.lerp(this.pointerTarget, 0.035);
    const progress = THREE.MathUtils.clamp(this.state.progress, 0, 1);
    const position = this.positionCurve.getPoint(progress);
    const lookAt = this.lookCurve.getPoint(progress);
    position.lerp(this.introPosition, 1 - this.state.intro);
    this.camera.position.set(
      position.x + this.pointer.x * 0.24,
      position.y + this.pointer.y * 0.09,
      position.z,
    );
    this.camera.lookAt(
      lookAt.x + this.pointer.x * 0.1,
      lookAt.y + this.pointer.y * 0.05,
      lookAt.z,
    );
  }

  current() {
    return this.currentChapter;
  }

  destroy() {
    this.activeTween?.kill();
    this.introTween?.kill();
  }
}
