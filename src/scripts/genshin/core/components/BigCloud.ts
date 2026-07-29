import { Component, Mesh, Object3D } from '../../libs/xviewer';
import { cameraCenter } from './ForwardCamera';
import { M_BigCloud, M_BigCloudBG } from './Materials';

export class BigCloud extends Component {
  public vCloud!: Object3D;
  onLoad(): void {
    const v = this.viewer.user.resources.SM_BigCloud as Object3D;
    this.viewer.scene.add(v);
    this.vCloud = v;
    for (const i of v.children) {
      i.position.multiplyScalar(0.1);
      i.scale.multiplyScalar(0.1);
    }
    v.traverse((node: Object3D) => {
      const mesh = node as Mesh;
      if (mesh instanceof Mesh) {
        mesh.renderOrder = -1;
        if (mesh.name === 'Plane011') {
          mesh.material = M_BigCloud;
        } else {
          mesh.material = M_BigCloudBG;
        }
      }
    });
  }
  update(): void {
    if (this.vCloud) {
      this.vCloud.position.copy(cameraCenter);
    }
  }
}
