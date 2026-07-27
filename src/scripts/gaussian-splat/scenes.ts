// 场景配置：把 URL / 坐标系 transform / 取景参数从代码里抽出来变成数据。
// transform 顺序与 Three.js Object3D 一致：scale → quaternion → position，
// 其中 position 表示「居中之后的额外偏移」，frameSplat() 会先把包围盒中心搬到原点。

export interface SplatTransform {
  /** 居中之后的额外平移（世界系） */
  position?: [number, number, number];
  /** 旋转四元数 [x, y, z, w] */
  quaternion?: [number, number, number, number];
  /** 均匀缩放，默认 1 */
  scale?: number;
}

export interface SplatFraming {
  /** 相机视高相对 size.y 的比例，默认 -0.4 */
  eyeHeightRatio?: number;
  /** 相机 X 偏移相对 size.x 的比例，默认 -0.12 */
  eyeOffsetXRatio?: number;
  /** 注视距离相对 sceneScale 的比例，默认 0.025 */
  lookRadiusRatio?: number;
  /** 相机最大后退距离相对 sceneScale 的比例，默认 0.22 */
  maxDistanceRatio?: number;
}

/** 直接硬编码相机位置；优先级高于 framing，调试好视角后直接写进来 */
export interface SplatCamera {
  /** 相机位置 [x, y, z] */
  position: [number, number, number];
  /** OrbitControls 注视点 [x, y, z] */
  target: [number, number, number];
}

export interface SplatSceneConfig {
  id: string;
  name: string;
  url: string;
  /** 用于进度条估算，字节 */
  sizeBytes?: number;
  transform: SplatTransform;
  /** 取景比例；若设置了 camera 则被忽略 */
  framing?: SplatFraming;
  /** 硬编码相机位置，优先级高于 framing */
  camera?: SplatCamera;
}

// Z-up → Y-up：绕 X 轴 -90°，四元数 (x, y, z, w) = (-√2/2, 0, 0, √2/2)
const Z_UP_TO_Y_UP: [number, number, number, number] = [
  -Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2,
];

export const SPLAT_SCENES: readonly SplatSceneConfig[] = [
  {
    id: 'interior',
    name: '室内场景',
    url: 'https://qhrenderstorage-oss.kujiale.com//worldmodel/prod_test/2026/06/24/5470b666-1552-4bfe-ab6e-d42821118b41.spz',
    sizeBytes: 7_973_645,
    // 原代码 quaternion.set(1, 0, 0, 0) 即 180° X 翻转
    transform: { quaternion: [1, 0, 0, 0] },
  },
  {
    id: 'holo-cos',
    name: '美丽州教堂',
    url: 'https://holo-cos.aholo3d.cn/splat-transform/3FO4G3I22OGB/26808c29-29ef-46a1-9c6b-27afc544a218.spz',
    transform: { quaternion: Z_UP_TO_Y_UP, scale: 10 },
    camera: {
      position: [-4.119140712099977, -4.569609048811838, 1.5860676408275411],
      target: [-3.1639628215868587, -4.645173674088324, 1.3894621970911851],
    },
  },
];

export const DEFAULT_SCENE_ID = SPLAT_SCENES[0].id;

export function findSceneConfig(id: string | null | undefined): SplatSceneConfig | undefined {
  if (!id) return undefined;
  return SPLAT_SCENES.find((s) => s.id === id);
}
