/**
 * localStorage ラッパ（SPEC §4.4）。
 * スキーマ不一致・JSON破損・localStorage 無効（Safariプライベート等）でも例外を投げず既定値へ落ちる。
 */
import { DEFAULT_LOCALE } from '@/i18n/detect';
import { isLocale, type Locale } from '@/i18n/types';

const STORAGE_KEY = 'triage-start:v1';
const SCHEMA_VERSION = 1;

export interface Settings {
  /** 表示言語。**profile とは独立**（docs/I18N.md §2） */
  locale: Locale;
  /** 判定基準プロファイル。言語切替で変更してはならない */
  profile: 'JP-FDMA';
  /** 境界値症例の出題率 0..1 */
  boundaryRate: number;
  suddenDeath: boolean;
  showTimer: boolean;
}

export interface PersistedState {
  schemaVersion: number;
  settings: Settings;
  bestTimeMs: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: DEFAULT_LOCALE,
  profile: 'JP-FDMA',
  boundaryRate: 0.35,
  suddenDeath: false,
  showTimer: true,
};

export const DEFAULT_STATE: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  settings: DEFAULT_SETTINGS,
  bestTimeMs: null,
};

function readRaw(): unknown {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadState(): PersistedState {
  const parsed = readRaw();
  if (parsed === null || typeof parsed !== 'object') return DEFAULT_STATE;

  const obj = parsed as Partial<PersistedState>;
  if (obj.schemaVersion !== SCHEMA_VERSION) return DEFAULT_STATE;

  const stored = obj.settings;
  return {
    schemaVersion: SCHEMA_VERSION,
    bestTimeMs: typeof obj.bestTimeMs === 'number' ? obj.bestTimeMs : null,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(stored && typeof stored === 'object' ? stored : {}),
      // 外部から来た値は必ず検証する
      locale: isLocale(stored?.locale) ? stored.locale : DEFAULT_SETTINGS.locale,
      profile: 'JP-FDMA',
    },
  };
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

/** 保存済みの locale のみを取得する（起動時の言語決定用） */
export function loadStoredLocale(): string | null {
  const parsed = readRaw();
  if (parsed === null || typeof parsed !== 'object') return null;
  const settings = (parsed as Partial<PersistedState>).settings;
  return typeof settings?.locale === 'string' ? settings.locale : null;
}
