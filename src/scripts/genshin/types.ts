export type GenshinState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'flying'
  | 'portal-forming'
  | 'portal-ready'
  | 'entering'
  | 'complete'
  | 'error'
  | 'destroyed';

export type GenshinProgressCallback = (
  progress: number,
  status: string,
) => void;

export interface GenshinProgressDetail {
  progress: number;
  status: string;
}

export interface GenshinErrorDetail {
  error: unknown;
  message: string;
}

export interface GenshinControllerEventMap {
  'genshin:progress': CustomEvent<GenshinProgressDetail>;
  'genshin:ready': CustomEvent<{ controller: unknown }>;
  'genshin:portal-forming': CustomEvent<Record<string, never>>;
  'genshin:portal-ready': CustomEvent<Record<string, never>>;
  'genshin:entering': CustomEvent<Record<string, never>>;
  'genshin:whiteout': CustomEvent<Record<string, never>>;
  'genshin:complete': CustomEvent<Record<string, never>>;
  'genshin:error': CustomEvent<GenshinErrorDetail>;
}
