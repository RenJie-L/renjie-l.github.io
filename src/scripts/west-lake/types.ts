export type ProgressHandler = (progress: number, status: string) => void;

export type ChapterId = 'broken-bridge' | 'lotus-courtyard' | 'leifeng-sunset';

export interface LocalizedCopy {
  zh: string;
  en: string;
}

export interface SceneChapter {
  id: ChapterId;
  progress: number;
  camera: [number, number, number];
  lookAt: [number, number, number];
  fogDensity: number;
  waterNear: string;
  waterFar: string;
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
}

export interface LandmarkDefinition {
  id: string;
  chapterId: ChapterId;
  position: [number, number, number];
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  story: LocalizedCopy;
  poem: LocalizedCopy;
}

export interface SceneQuality {
  lite: boolean;
  label: 'lite' | 'full';
  pixelRatio: number;
  waterSegments: number;
  vegetationScale: number;
  postProcessing: boolean;
}
