import {
  Component,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from '../../libs/xviewer';
import { MashList } from '../datas/ColumnList';
import { zLength } from '../datas/Config';

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

const __matrix = new Matrix4();
const __position = new Vector3();
const __quaternion = new Quaternion();
const __scale = new Vector3();
const __euler = new Euler();

export class Column extends Component {
  private columeInstanceMap: Map<string, ColumeInstance> = new Map();
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
          }
          this.viewer.scene.add(instancedMesh);
          columeInstance.instance.push(instancedMesh);
        }
      });
      this.viewer.scene.remove(v);
    }
  }
  update(): void {
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
