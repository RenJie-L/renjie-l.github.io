export interface GaussianParams {
  // SplatMesh instance properties
  opacity: number;
  recolor: string;
  maxSh: 0 | 1 | 2 | 3;
  // SparkRenderer appearance
  maxStdDev: number;
  focalAdjustment: number;
  falloff: number;
  minAlpha: number;
  minPixelRadius: number;
  maxPixelRadius: number;
  preBlurAmount: number;
  sortRadial: boolean;
  enable2DGS: boolean;
  // LoD
  lodSplatScale: number;
  lodRenderScale: number;
  // Depth of field
  focalDistance: number;
  apertureAngle: number;
  // Foveation
  coneFov0: number;
  coneFov: number;
  coneFoveate: number;
  behindFoveate: number;
}

export type CameraMode = 'orbit' | 'fly';
export type PerformanceMode = 'quality' | 'performance';

export const DEFAULT_PARAMS: GaussianParams = {
  opacity: 1,
  recolor: '#ffffff',
  maxSh: 3,
  maxStdDev: Math.sqrt(8),
  focalAdjustment: 1,
  falloff: 1,
  minAlpha: 0.5 / 255,
  minPixelRadius: 0,
  maxPixelRadius: 512,
  preBlurAmount: 0,
  sortRadial: true,
  enable2DGS: false,
  lodSplatScale: 1,
  lodRenderScale: 1,
  focalDistance: 0,
  apertureAngle: 0,
  coneFov0: 90,
  coneFov: 120,
  coneFoveate: 0.4,
  behindFoveate: 0.2,
};

export const PERFORMANCE_MODE_STORAGE_KEY = 'gaussian-splat-performance-mode';

export const PERFORMANCE_PROFILE = {
  desktopPixelRatioCap: 1,
  mobilePixelRatioCap: 0.75,
  lodSplatScaleMultiplier: 0.55,
  minLodRenderScale: 2,
  minSortIntervalMs: 32,
} as const;

export const QUALITY_PROFILE = {
  desktopPixelRatioCap: 1.75,
  mobilePixelRatioCap: 1.25,
  minSortIntervalMs: 0,
} as const;

export function getDefaultPerformanceMode(): PerformanceMode {
  if (typeof window === 'undefined') return 'quality';
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return coarsePointer || (deviceMemory !== undefined && deviceMemory <= 4)
    ? 'performance'
    : 'quality';
}
