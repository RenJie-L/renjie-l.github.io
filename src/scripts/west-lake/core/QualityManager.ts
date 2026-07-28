import type { SceneQuality } from '@/scripts/west-lake/types';

export function resolveSceneQuality(): SceneQuality {
  const constrainedCpu =
    navigator.hardwareConcurrency !== undefined &&
    navigator.hardwareConcurrency <= 4;
  const constrainedMemory =
    'deviceMemory' in navigator &&
    typeof navigator.deviceMemory === 'number' &&
    navigator.deviceMemory <= 4;
  const lite = innerWidth < 760 || constrainedCpu || constrainedMemory;

  return {
    lite,
    label: lite ? 'lite' : 'full',
    pixelRatio: Math.min(devicePixelRatio, lite ? 1.15 : 1.5),
    waterSegments: lite ? 48 : 88,
    vegetationScale: lite ? 0.58 : 1,
    postProcessing: !lite,
  };
}
