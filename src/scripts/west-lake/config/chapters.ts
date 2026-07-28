import type {
  LandmarkDefinition,
  SceneChapter,
} from '@/scripts/west-lake/types';

export const WEST_LAKE_CHAPTERS: SceneChapter[] = [
  {
    id: 'broken-bridge',
    progress: 0,
    camera: [-3.8, 1.75, 8.4],
    lookAt: [-3.25, -0.25, -1.15],
    fogDensity: 0.018,
    waterNear: '#365f68',
    waterFar: '#a8bfbd',
    eyebrow: { zh: '第一景', en: 'Chapter I' },
    title: { zh: '断桥残雪', en: 'Broken Bridge' },
  },
  {
    id: 'lotus-courtyard',
    progress: 0.5,
    camera: [-0.65, 1.28, 6.15],
    lookAt: [-0.35, -0.72, 0.9],
    fogDensity: 0.014,
    waterNear: '#315e62',
    waterFar: '#9eb9ae',
    eyebrow: { zh: '第二景', en: 'Chapter II' },
    title: { zh: '曲院风荷', en: 'Lotus in the Breeze' },
  },
  {
    id: 'leifeng-sunset',
    progress: 1,
    camera: [3.15, 1.62, 6.25],
    lookAt: [3.85, 0.12, -5.15],
    fogDensity: 0.012,
    waterNear: '#42656b',
    waterFar: '#91aaa5',
    eyebrow: { zh: '第三景', en: 'Chapter III' },
    title: { zh: '雷峰夕照', en: 'Leifeng at Sunset' },
  },
];

export const WEST_LAKE_LANDMARKS: LandmarkDefinition[] = [
  {
    id: 'broken-bridge',
    chapterId: 'broken-bridge',
    position: [-3.3, 0.38, -1.1],
    eyebrow: { zh: '西湖十景 · 断桥残雪', en: 'Ten Scenes · Broken Bridge' },
    title: { zh: '断桥', en: 'Broken Bridge' },
    story: {
      zh: '桥身以一段低缓的弧线横过湖面。冬雪初霁时，向阳一侧先融，远望桥堤似断非断，因而得名。',
      en: 'A low arc crosses the lake. After winter snow, its sunlit side thaws first, making the causeway appear broken from afar.',
    },
    poem: {
      zh: '断桥荒藓涩，空院落花深。',
      en: 'Moss gathers on the bridge; fallen petals deepen in the empty court.',
    },
  },
  {
    id: 'lotus-courtyard',
    chapterId: 'lotus-courtyard',
    position: [-0.45, -0.18, 1.15],
    eyebrow: {
      zh: '西湖十景 · 曲院风荷',
      en: 'Ten Scenes · Lotus in the Breeze',
    },
    title: { zh: '风荷', en: 'Breeze over Lotus' },
    story: {
      zh: '湖风穿过成片荷叶，叶面与水纹形成层层节奏。这里用实例化几何铺开荷塘，并让花叶随时间轻轻起伏。',
      en: 'Lake wind passes through broad lotus fields. Instanced leaves and blossoms build a layered rhythm across the water.',
    },
    poem: {
      zh: '接天莲叶无穷碧，映日荷花别样红。',
      en: 'Lotus leaves meet the sky in endless green; blossoms glow differently beneath the sun.',
    },
  },
  {
    id: 'leifeng-pagoda',
    chapterId: 'leifeng-sunset',
    position: [3.9, 1.4, -5.2],
    eyebrow: { zh: '西湖十景 · 雷峰夕照', en: 'Ten Scenes · Leifeng Sunset' },
    title: { zh: '雷峰塔', en: 'Leifeng Pagoda' },
    story: {
      zh: '塔影立于南岸山色之间。镜头抵达终章时，冷青水墨逐渐转为温暖赭色，让夕照成为整段游览的收束。',
      en: 'The pagoda rises among the southern hills. In the final chapter, cool ink tones warm into an amber sunset.',
    },
    poem: {
      zh: '烟光山色淡溟濛，千尺浮图兀倚空。',
      en: 'Mist softens mountain light; the tall pagoda leans into open sky.',
    },
  },
];

export function getChapter(id: string) {
  return WEST_LAKE_CHAPTERS.find((chapter) => chapter.id === id);
}

export function getLandmark(id: string) {
  return WEST_LAKE_LANDMARKS.find((landmark) => landmark.id === id);
}
