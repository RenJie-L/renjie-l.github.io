export const GENSHIN_ASSET_BASE = '/assets/experiments/genshin/v1';

export const GENSHIN_ASSETS = {
  models: {
    DOOR: `${GENSHIN_ASSET_BASE}/models/DOOR.glb`,
    SM_BigCloud: `${GENSHIN_ASSET_BASE}/models/SM_BigCloud.glb`,
    SM_Light: `${GENSHIN_ASSET_BASE}/models/SM_Light.glb`,
    SM_Qiao01: `${GENSHIN_ASSET_BASE}/models/SM_Qiao01.glb`,
    SM_Qiao02: `${GENSHIN_ASSET_BASE}/models/SM_Qiao02.glb`,
    SM_Qiao03: `${GENSHIN_ASSET_BASE}/models/SM_Qiao03.glb`,
    SM_Qiao04: `${GENSHIN_ASSET_BASE}/models/SM_Qiao04.glb`,
    SM_Road: `${GENSHIN_ASSET_BASE}/models/SM_Road.glb`,
    SM_ZhuZi01: `${GENSHIN_ASSET_BASE}/models/SM_ZhuZi01.glb`,
    SM_ZhuZi02: `${GENSHIN_ASSET_BASE}/models/SM_ZhuZi02.glb`,
    SM_ZhuZi03: `${GENSHIN_ASSET_BASE}/models/SM_ZhuZi03.glb`,
    SM_ZhuZi04: `${GENSHIN_ASSET_BASE}/models/SM_ZhuZi04.glb`,
    WHITE_PLANE: `${GENSHIN_ASSET_BASE}/models/WHITE_PLANE.glb`,
  },
  textures: {
    cloudMask: `${GENSHIN_ASSET_BASE}/textures/Tex_0062.png`,
    bigCloud: `${GENSHIN_ASSET_BASE}/textures/Tex_0063.png`,
    bigCloudBackground: `${GENSHIN_ASSET_BASE}/textures/Tex_0067b.png`,
    polarLight: `${GENSHIN_ASSET_BASE}/textures/Tex_0071.png`,
    star: `${GENSHIN_ASSET_BASE}/textures/Tex_0075.png`,
  },
  audio: {
    bgm: `${GENSHIN_ASSET_BASE}/audio/BGM.mp3`,
    start: `${GENSHIN_ASSET_BASE}/audio/Genshin Impact [Duang].mp3`,
    doorCreate: `${GENSHIN_ASSET_BASE}/audio/Genshin Impact [DoorComeout].mp3`,
    doorThrough: `${GENSHIN_ASSET_BASE}/audio/Genshin Impact [DoorThrough].mp3`,
  },
  ui: {
    logo: `${GENSHIN_ASSET_BASE}/ui/Genshin.png`,
    start: `${GENSHIN_ASSET_BASE}/ui/ClickMe.png`,
    video: `${GENSHIN_ASSET_BASE}/ui/jump.png`,
    entry: `${GENSHIN_ASSET_BASE}/ui/Entry.png`,
    backdrop: `${GENSHIN_ASSET_BASE}/ui/Tex_0096.png`,
    pointer: `${GENSHIN_ASSET_BASE}/ui/T_Mouse.png`,
  },
} as const;

export type GenshinModelName = keyof typeof GENSHIN_ASSETS.models;
