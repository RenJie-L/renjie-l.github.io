// 场景配置：把 URL / 坐标系 transform / 取景参数从代码里抽出来变成数据。
// transform 顺序与 Three.js Object3D 一致：scale → quaternion → position，
// 保留 SPZ 原始坐标原点；position 仅表示显式配置的世界坐标偏移。

export interface SplatTransform {
  /** 世界坐标偏移，默认 [0, 0, 0]，不自动居中 */
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
  loading?: 'standard' | 'progressive-spz';
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
    name: '白宫',
    url: 'https://qhrenderstorage-oss.kujiale.com//worldmodel/prod_test/2026/06/24/5470b666-1552-4bfe-ab6e-d42821118b41.spz',
    sizeBytes: 7_973_645,
    // 原代码 quaternion.set(1, 0, 0, 0) 即 180° X 翻转
    transform: { quaternion: [1, 0, 0, 0] },
    camera: { position: [0, 0, 0], target: [0, 0, -1] },
  },
  {
    id: 'holo-cos',
    name: '美丽州教堂',
    loading: 'progressive-spz',
    sizeBytes: 90_672_752,
    url: 'https://holo-cos.aholo3d.cn/splat-transform/3FO4G3I22OGB/26808c29-29ef-46a1-9c6b-27afc544a218.spz',
    transform: { quaternion: Z_UP_TO_Y_UP, scale: 10 },
    camera: { position: [0, 0, 0], target: [0, 0, -1] },
  },
  {
    id: 'palace',
    name: '宫殿',
    url: 'https://user-platform-oss.kujiale.com/upms/direct/7ec6cc2e46dd7727-1789113375347-1.spz',
    sizeBytes: 30_201_189,
    transform: { quaternion: [0, 0, 0, 1] },
    camera: { position: [0, 0, 0], target: [0, 0, -1] },
  },
  {
    id: 'wizard-of-oz',
    name: '绿野仙踪',
    url: 'https://user-platform-oss.kujiale.com/upms/direct/0b4bd340d57d62be-1789113375655-2.spz',
    sizeBytes: 31_042_494,
    transform: { quaternion: [0, 0, 0, 1] },
    camera: { position: [0, 0, 0], target: [-1, 0, 0] },
  },
];

export const DEFAULT_SCENE_ID = 'wizard-of-oz';

export function findSceneConfig(
  id: string | null | undefined,
): SplatSceneConfig | undefined {
  if (!id) return undefined;
  return SPLAT_SCENES.find((s) => s.id === id);
}
