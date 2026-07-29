import {
  Component,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from '../../libs/xviewer';

import { MashList } from '../datas/CloudList';
import { M_Cloud } from './Materials';
import { cameraCenter } from './ForwardCamera';
import { zLength } from '../datas/Config';

export class Cloud extends Component {
  private posList: Vector3[] = [];
  private instanceMesh!: InstancedMesh;
  onLoad(): void {
    const Plane = new PlaneGeometry(3000, 1500);
    const instancedMesh = new InstancedMesh(Plane, M_Cloud, MashList.length);
    //加载云列表
    for (let i = 0; i < MashList.length; i++) {
      const position = new Vector3(
        MashList[i].Location[0],
        MashList[i].Location[2],
        -MashList[i].Location[1],
      ).multiplyScalar(0.1);
      this.posList.push(position);
    }
    const customSort = function (a: Vector3, b: Vector3) {
      return a.z - b.z;
    };
    this.posList.sort(customSort);

    this.instanceMesh = instancedMesh;
    this.updateInstance();
    this.viewer.scene.add(instancedMesh);
  }
  update(): void {
    if (this.instanceMesh) {
      if (this.posList[this.posList.length - 1].z > cameraCenter.z) {
        const firstElement = this.posList.pop();
        if (!firstElement) return;
        firstElement.z -= zLength * 0.1;
        this.posList.unshift(firstElement);
        this.updateInstance();
      }
    }
  }
  private updateInstance() {
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    for (let i = 0; i < this.posList.length; i++) {
      const matrix = new Matrix4();
      matrix.compose(this.posList[i], quaternion, scale);
      this.instanceMesh.setMatrixAt(i, matrix);
    }
    this.instanceMesh.instanceMatrix.needsUpdate = true;
  }
}
