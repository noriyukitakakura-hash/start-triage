/**
 * localStorage ラッパ（SPEC §4.4）。
 * スキーマ不一致・JSON破損・localStorage 無効（Safariプライベート等）でも例外を投げず既定値へ落ちる。
 */
import { DEFAULT_LOCALE } from '@/i18n/detect';
import { isLocale, type Locale } from '@/i18n/types';

const STORAGE_KEY = 'triage-start:v1';
const SCHEMA_VERSION = 2;

/**
 * 呼吸数の提示方式（docs/OBSERVATION.md）。
 * - `numeric`  数値で提示する。閾値（9/10・29/30）の記憶を訓練する
 * - `observed` 胸郭アニメーションを観察してタップで数える。現場の実務を訓練する
 */
export const RR_PRESENTATIONS = ['numeric', 'observed'] as const;
export type RrPresentation = (typeof RR_PRESENTATIONS)[number];

/** 実測モードで呼吸数を閾値から離す回数。docs/OBSERVATION.md §2 */
export const OBSERVED_RR_MARGIN = 4;

export function isRrPresentation(value: unknown): value is RrPresentation {
  return typeof value === 'string' && (RR_PRESENTATIONS as readonly string[]).includes(value);
}

/** 提示方式に対応する呼吸数マージン。ジェネレータへそのまま渡す */
export function rrMarginFor(presentation: RrPresentation): number {
  return presentation === 'observed' ? OBSERVED_RR_MARGIN : 0;
}

export interface Settings {
  /** 表示言語。**profile とは独立**（docs/I18N.md §2） */
  locale: Locale;
  /** 判定基準プロファイル。言語切替で変更してはならない */
  profile: 'JP-FDMA';
  /** 境界値症例の出題率 0..1 */
  boundaryRate: number;
  suddenDeath: boolean;
  showTimer: boolean;
  /** 呼吸数の提示方式 */
  rrPresentation: RrPresentation;
}

/**
 * 自己ベストタイム。**提示方式ごとに分けて保持する。**
 *
 * 実測モードは観察時間が支配的になるため、数値モードのタイムと比較できない。
 * 単一の値にすると比較不能なタイムを同じ記録として扱ってしまう。
 */
export type BestTimes = Record<RrPresentation, number | null>;

export interface PersistedState {
  schemaVersion: number;
  settings: Settings;
  bestTimeMs: BestTimes;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: DEFAULT_LOCALE,
  profile: 'JP-FDMA',
  boundaryRate: 0.35,
  suddenDeath: false,
  showTimer: true,
  rrPresentation: 'numeric',
};

export const DEFAULT_BEST_TIMES: BestTimes = { numeric: null, observed: null };

export const DEFAULT_STATE: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  settings: DEFAULT_SETTINGS,
  bestTimeMs: DEFAULT_BEST_TIMES,
};

function readRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeBestTimes(value: unknown): BestTimes {
  // v1: bestTimeMs は単一の数値だった。数値モードの記録として引き継ぐ
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { numeric: value, observed: null };
  }
  if (value === null || typeof value !== 'object') return DEFAULT_BEST_TIMES;

  const obj = value as Partial<Record<RrPresentation, unknown>>;
  const pick = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

  return { numeric: pick(obj.numeric), observed: pick(obj.observed) };
}

function sanitizeSettings(value: unknown): Settings {
  if (value === null || typeof value !== 'object') return DEFAULT_SETTINGS;
  const s = value as Partial<Settings>;

  return {
    ...DEFAULT_SETTINGS,
    ...s,
    // 外部から来た値は必ず検証する
    locale: isLocale(s.locale) ? s.locale : DEFAULT_SETTINGS.locale,
    profile: 'JP-FDMA',
    rrPresentation: isRrPresentation(s.rrPresentation)
      ? s.rrPresentation
      : DEFAULT_SETTINGS.rrPresentation,
    boundaryRate:
      typeof s.boundaryRate === 'number' && s.boundaryRate >= 0 && s.boundaryRate <= 1
        ? s.boundaryRate
        : DEFAULT_SETTINGS.boundaryRate,
    suddenDeath: typeof s.suddenDeath === 'boolean' ? s.suddenDeath : DEFAULT_SETTINGS.suddenDeath,
    showTimer: typeof s.showTimer === 'boolean' ? s.showTimer : DEFAULT_SETTINGS.showTimer,
  };
}

/**
 * 保存済みの状態を読む。
 *
 * v1 からの移行: `bestTimeMs` が単一の数値だったものを提示方式ごとの記録へ変換する。
 * 設定はそのまま引き継げるため破棄しない。
 */
export function loadState(): PersistedState {
  const parsed = readRaw();
  if (parsed === null || typeof parsed !== 'object') return DEFAULT_STATE;

  const obj = parsed as Partial<PersistedState>;
  const version = obj.schemaVersion;

  // 未知の将来バージョンは解釈できないため既定値へ落とす
  if (typeof version !== 'number' || version < 1 || version > SCHEMA_VERSION) return DEFAULT_STATE;

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: sanitizeSettings(obj.settings),
    bestTimeMs: sanitizeBestTimes(obj.bestTimeMs),
  };
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }));
  } catch {
    // ストレージ無効・容量超過。永続化できなくても動作は継続させる
  }
}

export function patchSettings(patch: Partial<Settings>): PersistedState {
  const current = loadState();
  const next: PersistedState = { ...current, settings: { ...current.settings, ...patch } };
  saveState(next);
  return next;
}

/** 自己ベストを更新する。更新しなかった場合は false を返す */
export function recordBestTime(presentation: RrPresentation, timeMs: number): boolean {
  const current = loadState();
  const previous = current.bestTimeMs[presentation];
  if (previous !== null && previous <= timeMs) return false;

  saveState({ ...current, bestTimeMs: { ...current.bestTimeMs, [presentation]: timeMs } });
  return true;
}

/** 保存済みの locale のみを取得する（起動時の言語決定用） */
export function loadStoredLocale(): string | null {
  const parsed = readRaw();
  if (parsed === null || typeof parsed !== 'object') return null;
  const settings = (parsed as Partial<PersistedState>).settings;
  return typeof settings?.locale === 'string' ? settings.locale : null;
}
