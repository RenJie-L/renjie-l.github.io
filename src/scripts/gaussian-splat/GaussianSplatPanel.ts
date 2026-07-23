import type { GaussianParams } from './GaussianSplatScene';

const STORAGE_KEY = 'gaussian-splat-params';

// 面板默认值；与 GaussianSplatScene 初始化时的渲染器/对象默认值保持一致。
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

// 会触发 LoD / 排序重算的昂贵参数，单独 debounce 以避免拖动时卡顿。
const EXPENSIVE_KEYS = new Set<keyof GaussianParams>([
  'lodSplatScale',
  'lodRenderScale',
  'focalDistance',
  'apertureAngle',
  'coneFov0',
  'coneFov',
  'coneFoveate',
  'behindFoveate',
]);

type ApplyFn = (params: Partial<GaussianParams>) => void;

/**
 * 高斯参数调节面板控制器。
 * 只负责 UI 状态与事件分发，所有渲染器调用通过 apply 回调下发。
 */
export class GaussianSplatPanel {
  private readonly panel: HTMLElement;
  private readonly apply: ApplyFn;
  private readonly state: GaussianParams;
  private readonly applyTimers = new Map<
    keyof GaussianParams,
    ReturnType<typeof setTimeout>
  >();

  constructor(root: HTMLElement, apply: ApplyFn) {
    this.apply = apply;
    const panel = root.querySelector<HTMLElement>('[data-splat-panel]');
    if (!panel) throw new Error('Gaussian splat panel element is missing.');
    this.panel = panel;

    this.state = this.loadState();
    this.bindControls();
    this.reflectState();
    // 场景加载完成后默认展开，参数变化可以直接与画面对照。
    this.setOpen(true);
    // 初始一次性下发，确保渲染器状态与持久化值一致。
    this.apply(this.state);
  }

  toggle(): boolean {
    const open = this.panel.dataset.open !== 'true';
    return this.setOpen(open);
  }

  setOpen(open: boolean): boolean {
    this.panel.dataset.open = String(open);
    this.panel.setAttribute('aria-hidden', String(!open));
    return open;
  }

  dispose(): void {
    for (const timer of this.applyTimers.values()) clearTimeout(timer);
    this.applyTimers.clear();
  }

  private loadState(): GaussianParams {
    const merged = { ...DEFAULT_PARAMS };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) Object.assign(merged, JSON.parse(stored));
    } catch {
      /* localStorage 不可用或解析失败则使用默认值 */
    }
    return merged;
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* 静默忽略写入失败 */
    }
  }

  private bindControls(): void {
    // 滑块、数值输入、颜色、下拉
    const inputs = this.panel.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-param]');
    for (const input of inputs) {
      const key = input.dataset.param as keyof GaussianParams | undefined;
      if (!key) continue;
      const handler = () => this.readControl(input, key);
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    }

    // 布尔开关
    const toggles =
      this.panel.querySelectorAll<HTMLInputElement>('[data-bool-param]');
    for (const toggle of toggles) {
      const key = toggle.dataset.boolParam as keyof GaussianParams | undefined;
      if (!key) continue;
      toggle.addEventListener('change', () => {
        (this.state[key] as unknown) = toggle.checked;
        this.scheduleApply(key);
        this.saveState();
      });
    }

    // 恢复默认
    this.panel
      .querySelector('[data-panel-reset]')
      ?.addEventListener('click', () => this.reset());

    // 折叠分组
    const groups =
      this.panel.querySelectorAll<HTMLElement>('[data-collapsible]');
    for (const group of groups) {
      const trigger = group.querySelector<HTMLElement>(
        '[data-collapse-trigger]',
      );
      trigger?.addEventListener('click', () => {
        const collapsed = group.dataset.collapsed === 'true';
        group.dataset.collapsed = String(!collapsed);
      });
    }
  }

  private readControl(
    input: HTMLInputElement | HTMLSelectElement,
    key: keyof GaussianParams,
  ): void {
    if (input instanceof HTMLInputElement && input.type === 'color') {
      (this.state[key] as unknown) = input.value;
    } else if (
      input instanceof HTMLInputElement &&
      (input.type === 'number' || input.type === 'range')
    ) {
      const num = Number(input.value);
      if (Number.isFinite(num)) (this.state[key] as unknown) = num;
    } else if (input instanceof HTMLSelectElement) {
      const num = Number(input.value);
      (this.state[key] as unknown) = Number.isFinite(num) ? num : input.value;
    } else {
      (this.state[key] as unknown) = input.value;
    }
    this.scheduleApply(key);
    this.saveState();
  }

  // 根据 state 反写到控件显示，避免初始/重置后控件与状态不同步。
  private reflectState(): void {
    const inputs = this.panel.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-param]');
    for (const input of inputs) {
      const key = input.dataset.param as keyof GaussianParams | undefined;
      if (!key) continue;
      const value = this.state[key];
      if (
        input instanceof HTMLInputElement &&
        input.type === 'color' &&
        typeof value === 'string'
      ) {
        input.value = value;
      } else if (
        input instanceof HTMLInputElement &&
        (input.type === 'number' || input.type === 'range')
      ) {
        input.value = String(value);
      } else if (input instanceof HTMLSelectElement) {
        input.value = String(value);
      }
    }

    const toggles =
      this.panel.querySelectorAll<HTMLInputElement>('[data-bool-param]');
    for (const toggle of toggles) {
      const key = toggle.dataset.boolParam as keyof GaussianParams | undefined;
      if (!key) continue;
      toggle.checked = Boolean(this.state[key]);
    }

    this.refreshValueLabels();
  }

  private refreshValueLabels(): void {
    const labels = this.panel.querySelectorAll<HTMLElement>('[data-value-for]');
    for (const label of labels) {
      const key = label.dataset.valueFor as keyof GaussianParams | undefined;
      if (!key) continue;
      const value = this.state[key];
      label.textContent =
        typeof value === 'number' ? formatNumber(value) : String(value);
    }
  }

  private scheduleApply(key: keyof GaussianParams): void {
    this.refreshValueLabels();
    const pending = this.applyTimers.get(key);
    if (pending) clearTimeout(pending);

    // 每个参数独立 debounce。共用计时器会让快速连续调整不同参数时，
    // 前一个参数的渲染更新被后一个参数取消。
    const delay = EXPENSIVE_KEYS.has(key) ? 200 : 50;
    const timer = setTimeout(() => {
      this.applyTimers.delete(key);
      this.apply({ [key]: this.state[key] });
    }, delay);
    this.applyTimers.set(key, timer);
  }

  private reset(): void {
    Object.assign(this.state, DEFAULT_PARAMS);
    this.reflectState();
    this.apply({ ...DEFAULT_PARAMS });
    this.saveState();
  }
}

function formatNumber(value: number): string {
  // 紧凑显示，避免过长尾数。
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(value < 0.01 ? 4 : value < 1 ? 3 : 2);
}
