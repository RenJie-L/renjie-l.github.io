import {
  Color,
  Component,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from '../../libs/xviewer';
import { MashList } from '../datas/ColumnList';
import { zLength } from '../datas/Config';
import { gameManager } from '../GameManager';

import { cameraCenter } from './ForwardCamera';
import { toonMaterials } from './Materials';

//一种柱子的instance，有多种柱子
interface ColumeInstance {
  //储存index相对应的信息
  indexList: {
    Object: string;
    Location: number[];
    Rotation: number[];
    Scale: number[];
  }[];
  instance: InstancedMesh[];
}

interface ColumnHighlight {
  group: ColumeInstance;
  index: number;
  strength: number;
  target: number;
}

const __matrix = new Matrix4();
const __position = new Vector3();
const __quaternion = new Quaternion();
const __scale = new Vector3();
const __euler = new Euler();
const __highlightColor = new Color();
const BASE_INSTANCE_COLOR = new Color(1, 1, 1);
const PICK_DISTANCE = 3500;
const HIGHLIGHT_DAMPING = 10;

export class Column extends Component {
  private columeInstanceMap: Map<string, ColumeInstance> = new Map();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2(2, 2);
  private readonly pickMeshes: InstancedMesh[] = [];
  private readonly meshGroups = new WeakMap<InstancedMesh, ColumeInstance>();
  private readonly highlights = new Set<ColumnHighlight>();
  private hovered?: ColumnHighlight;
  private pointerInside = false;
  private interactionEnabled = true;
  private pickFrame = 0;

  onLoad(): void {
    //先将数据全部加载并处理
    const meshList = this.cloneList(MashList);
    for (const i of meshList) {
      if (!this.columeInstanceMap.has(i.Object)) {
        this.columeInstanceMap.set(i.Object, { indexList: [], instance: [] });
      }
      this.columeInstanceMap.get(i.Object)!.indexList.push(i);
    }
    //根据所得的名称加载glb
    for (const i of this.columeInstanceMap.keys()) {
      const v = this.viewer.user.resources[i] as Object3D | undefined;
      const columeInstance = this.columeInstanceMap.get(i);
      if (!v || !columeInstance) continue;
      this.viewer.scene.add(v);
      //将mesh创建出实例组
      v.traverse((node: Object3D) => {
        const mesh = node as Mesh;
        if (mesh instanceof Mesh) {
          const m = toonMaterials.getToonMaterial_Column(
            mesh.material as MeshPhysicalMaterial,
          );
          const instancedMesh = new InstancedMesh(
            mesh.geometry,
            m,
            columeInstance.indexList.length,
          );
          instancedMesh.castShadow = true;
          // 实例的位置、旋转和缩放
          for (let j = 0; j < columeInstance.indexList.length; j++) {
            const info = columeInstance.indexList[j];
            __position.set(
              info.Location[0] * 0.1,
              info.Location[2] * 0.1,
              -info.Location[1] * 0.1,
            );
            __quaternion.setFromEuler(
              __euler.set(info.Rotation[0], info.Rotation[2], info.Rotation[1]),
            );
            __scale.set(
              info.Scale[0] * 0.1,
              info.Scale[2] * 0.1,
              info.Scale[1] * 0.1,
            );
            __matrix.compose(__position, __quaternion, __scale);
            instancedMesh.setMatrixAt(j, __matrix);
            instancedMesh.setColorAt(j, BASE_INSTANCE_COLOR);
          }
          if (instancedMesh.instanceColor)
            instancedMesh.instanceColor.needsUpdate = true;
          this.viewer.scene.add(instancedMesh);
          columeInstance.instance.push(instancedMesh);
          this.pickMeshes.push(instancedMesh);
          this.meshGroups.set(instancedMesh, columeInstance);
        }
      });
      this.viewer.scene.remove(v);
    }

    this.raycaster.near = 50;
    this.raycaster.far = PICK_DISTANCE;
    const inputElement = this.getInputElement();
    inputElement.addEventListener('pointermove', this.onPointerMove);
    inputElement.addEventListener('pointerleave', this.onPointerLeave);
    gameManager.on('portal-ready', this.disableInteraction, this, true);
  }

  update(dt: number): void {
    for (const i of this.columeInstanceMap.values()) {
      for (let j = 0; j < i.indexList.length; j++) {
        if (-i.indexList[j].Location[1] * 0.1 > cameraCenter.z + 2000) {
          i.indexList[j].Location[1] += zLength;
          __position.set(
            i.indexList[j].Location[0] * 0.1,
            i.indexList[j].Location[2] * 0.1,
            -i.indexList[j].Location[1] * 0.1,
          );
          __quaternion.setFromEuler(
            __euler.set(
              i.indexList[j].Rotation[0],
              i.indexList[j].Rotation[2],
              i.indexList[j].Rotation[1],
            ),
          );
          __scale.set(
            i.indexList[j].Scale[0] * 0.1,
            i.indexList[j].Scale[2] * 0.1,
            i.indexList[j].Scale[1] * 0.1,
          );
          __matrix.compose(__position, __quaternion, __scale);
          for (const inst of i.instance) {
            inst.setMatrixAt(j, __matrix);
            inst.instanceMatrix.needsUpdate = true;
          }
        }
      }
    }

    if (this.pickFrame++ % 2 === 0) this.updatePicking();
    this.updateHighlights(dt);
  }

  onDestroy(): void {
    const inputElement = this.getInputElement();
    inputElement.removeEventListener('pointermove', this.onPointerMove);
    inputElement.removeEventListener('pointerleave', this.onPointerLeave);
    inputElement.style.cursor = '';
    gameManager.targetOff(this);
  }

  private updatePicking(): void {
    if (!this.interactionEnabled || !this.pointerInside) return;

    this.raycaster.setFromCamera(this.pointer, this.viewer.camera);
    const hit = this.raycaster.intersectObjects<InstancedMesh>(
      this.pickMeshes,
      false,
    )[0];

    if (!hit || hit.instanceId === undefined) {
      this.setHovered();
      return;
    }

    const group = this.meshGroups.get(hit.object);
    if (!group) {
      this.setHovered();
      return;
    }

    this.setHovered(group, hit.instanceId);
  }

  private updateHighlights(dt: number): void {
    if (this.highlights.size === 0) return;
    const alpha = 1 - Math.exp(-HIGHLIGHT_DAMPING * dt);

    for (const highlight of this.highlights) {
      highlight.strength += (highlight.target - highlight.strength) * alpha;
      const strength = highlight.strength;
      __highlightColor.setRGB(
        1 + strength * 2,
        1 + strength * 1.1,
        1 + strength * 0.3,
      );
      this.setInstanceColor(highlight.group, highlight.index, __highlightColor);

      if (highlight.target === 0 && highlight.strength < 0.01) {
        this.setInstanceColor(
          highlight.group,
          highlight.index,
          BASE_INSTANCE_COLOR,
        );
        this.highlights.delete(highlight);
      }
    }
  }

  private setHovered(group?: ColumeInstance, index?: number): void {
    if (
      group &&
      index !== undefined &&
      this.hovered?.group === group &&
      this.hovered.index === index
    ) {
      return;
    }

    if (this.hovered) this.hovered.target = 0;
    this.hovered = undefined;

    if (group && index !== undefined) {
      let next: ColumnHighlight | undefined;
      for (const highlight of this.highlights) {
        if (highlight.group === group && highlight.index === index) {
          next = highlight;
          break;
        }
      }
      if (!next) {
        next = { group, index, strength: 0, target: 1 };
        this.highlights.add(next);
      }
      next.target = 1;
      this.hovered = next;
    }

    this.getInputElement().style.cursor = this.hovered ? 'pointer' : '';
  }

  private setInstanceColor(
    group: ColumeInstance,
    index: number,
    color: Color,
  ): void {
    for (const mesh of group.instance) {
      mesh.setColorAt(index, color);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private disableInteraction = (): void => {
    this.interactionEnabled = false;
    this.pointerInside = false;
    this.setHovered();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.interactionEnabled || event.pointerType === 'touch') return;
    const eventTarget = event.target;
    if (
      eventTarget instanceof Element &&
      eventTarget.closest('a, button, [role="button"]')
    ) {
      this.pointerInside = false;
      this.setHovered();
      return;
    }

    const bounds = this.getInputElement().getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.pointerInside = true;
  };

  private onPointerLeave = (): void => {
    this.pointerInside = false;
    this.setHovered();
  };

  private getInputElement(): HTMLElement {
    const canvas = this.viewer.renderer.domElement;
    return canvas.parentElement ?? canvas;
  }

  private cloneList(
    List: {
      Object: string;
      Location: number[];
      Rotation: number[];
      Scale: number[];
    }[],
  ) {
    const nL: {
      Object: string;
      Location: number[];
      Rotation: number[];
      Scale: number[];
    }[] = [];
    for (const i of List) {
      nL.push({
        Object: i.Object,
        Location: i.Location.slice(),
        Rotation: i.Rotation.slice(),
        Scale: i.Scale.slice(),
      });
    }
    return nL;
  }
}
