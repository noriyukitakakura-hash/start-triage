/**
 * localStorage ラッパ（SPEC §4.4）。
 * スキーマ不一致・JSON破損・localStorage 無効（Safariプライベート等）でも例外を投げず既定値へ落ちる。
 */
import { MEASURED_CRT_MARGIN } from '@/domain/circulation';
import { DEFAULT_LOCALE } from '@/i18n/detect';
import { isLocale, type Locale } from '@/i18n/types';
import { CATEGORIES, type Category } from '@/domain/types';

const STORAGE_KEY = 'triage-start:v1';
const SCHEMA_VERSION = 2;

/**
 * バイタルの提示方式（docs/OBSERVATION.md）。
 *
 * - `numeric`  すべて数値で提示する。閾値（呼吸数 9/10・29/30、CRT 2.0秒）の記憶を訓練する
 * - `observed` 自分で計測する。胸郭の動きを数え、爪床を圧迫して CRT を測り、
 *   橈骨動脈の拍動を数える。現場の実務を訓練する
 *
 * **値は変えてはならない。** `bestTimeMs` のキーに使っており、
 * 変更すると既存の記録を失う。
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

/** 提示方式に対応する CRT マージン（秒）。ジェネレータへそのまま渡す */
export function crtMarginFor(presentation: RrPresentation): number {
  return presentation === 'observed' ? MEASURED_CRT_MARGIN : 0;
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
  /** バイタルの提示方式。呼吸数・CRT・脈拍のすべてに効く */
  vitalsPresentation: RrPresentation;
}

/**
 * 自己ベストタイム。**提示方式ごとに分けて保持する。**
 *
 * 実測モードは観察時間が支配的になるため、数値モードのタイムと比較できない。
 * 単一の値にすると比較不能なタイムを同じ記録として扱ってしまう。
 */
export type BestTimes = Record<RrPresentation, number | null>;

/**
 * 学習モードの累計統計（SPEC §2.3）。
 * `confusion[expected][answered]` に誤答の内訳を積む。どの区分をどの区分と
 * 取り違えやすいかが分かり、弱点が可視化される。
 */
export interface LearnStats {
  answered: number;
  correct: number;
  confusion: Record<Category, Record<Category, number>>;
}

/**
 * 免責文の版番号（SPEC §1.7）。
 *
 * 初回起動時に明示的な確認を求め、確認した版を記録する。
 * **免責文を実質的に改訂したらこの値を上げる。** 利用者に再度確認を求めるため。
 * 文言の微修正では上げない。
 */
export const DISCLAIMER_VERSION = 1;

/**
 * 測定の案内を見せた版（SPEC §2.1）。
 *
 * **真偽値ではなく版番号にする。** 計測器の操作を実質的に変えたらこの値を上げ、
 * 既存の利用者にもう一度見せられるようにするため。
 *
 * **`SCHEMA_VERSION` は上げてはならない。** `loadState` は
 * `version > SCHEMA_VERSION` を既定値へ落とす作りで、落とすと自己ベストも
 * 設定も失われる。これは Service Worker を持つ PWA であり、新版を配っても
 * 旧版のクライアントがしばらく動き続ける。項目を足すだけなら、
 * 欠けた項目が既定値に落ちるだけなので版を上げる必要はない。
 */
export const MEASURE_GUIDE_VERSION = 1;

export interface PersistedState {
  schemaVersion: number;
  settings: Settings;
  bestTimeMs: BestTimes;
  learnStats: LearnStats;
  /** 利用者が確認した免責文の版。未確認は null */
  disclaimerAckVersion: number | null;
  /** 利用者に見せた測定案内の版。未表示は null */
  measureGuideSeenVersion: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: DEFAULT_LOCALE,
  profile: 'JP-FDMA',
  boundaryRate: 0.35,
  suddenDeath: false,
  showTimer: true,
  // 既定は実測。現場で必要なのは「見て判断する」技能であり、
  // 数値を読む練習は設定で明示的に選ぶものとする（docs/OBSERVATION.md §2）
  vitalsPresentation: 'observed',
};

export const DEFAULT_BEST_TIMES: BestTimes = { numeric: null, observed: null };

function emptyConfusion(): Record<Category, Record<Category, number>> {
  const rows = {} as Record<Category, Record<Category, number>>;
  for (const expected of CATEGORIES) {
    const row = {} as Record<Category, number>;
    for (const answered of CATEGORIES) row[answered] = 0;
    rows[expected] = row;
  }
  return rows;
}

export function emptyLearnStats(): LearnStats {
  return { answered: 0, correct: 0, confusion: emptyConfusion() };
}

export const DEFAULT_STATE: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  settings: DEFAULT_SETTINGS,
  bestTimeMs: DEFAULT_BEST_TIMES,
  learnStats: emptyLearnStats(),
  disclaimerAckVersion: null,
  measureGuideSeenVersion: null,
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

/** 保存値は外部入力として扱い、型を偽らず unknown のまま辿る */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function sanitizeLearnStats(value: unknown): LearnStats {
  const fresh = emptyLearnStats();
  const s = asRecord(value);
  if (s === null) return fresh;

  const count = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

  const stored = asRecord(s.confusion);
  if (stored !== null) {
    for (const expected of CATEGORIES) {
      const row = asRecord(stored[expected]);
      if (row === null) continue;
      for (const answered of CATEGORIES) {
        fresh.confusion[expected][answered] = count(row[answered]);
      }
    }
  }

  const answered = count(s.answered);
  return { answered, correct: Math.min(answered, count(s.correct)), confusion: fresh.confusion };
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
    // 旧 `rrPresentation` からの移行。呼吸だけの設定ではなくなったため改名した。
    // 値は変えていないので、そのまま読み替えれば記録も設定も失われない
    vitalsPresentation: isRrPresentation(s.vitalsPresentation)
      ? s.vitalsPresentation
      : isRrPresentation((value as Record<string, unknown>).rrPresentation)
        ? ((value as Record<string, unknown>).rrPresentation as RrPresentation)
        : DEFAULT_SETTINGS.vitalsPresentation,
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
    learnStats: sanitizeLearnStats(obj.learnStats),
    disclaimerAckVersion:
      typeof obj.disclaimerAckVersion === 'number' && Number.isFinite(obj.disclaimerAckVersion)
        ? obj.disclaimerAckVersion
        : null,
    measureGuideSeenVersion:
      typeof obj.measureGuideSeenVersion === 'number' && Number.isFinite(obj.measureGuideSeenVersion)
        ? obj.measureGuideSeenVersion
        : null,
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

/** 学習モードの累計統計を消去する。設定や自己ベストには触れない */
export function resetLearnStats(): LearnStats {
  const current = loadState();
  const fresh = emptyLearnStats();
  saveState({ ...current, learnStats: fresh });
  return fresh;
}

/** 現行版の免責文を確認済みか */
export function hasAcknowledgedDisclaimer(): boolean {
  const acknowledged = loadState().disclaimerAckVersion;
  return acknowledged !== null && acknowledged >= DISCLAIMER_VERSION;
}

/** 免責文を確認したことを記録する */
export function acknowledgeDisclaimer(): void {
  saveState({ ...loadState(), disclaimerAckVersion: DISCLAIMER_VERSION });
}

/** 現行版の測定案内を見たか */
export function hasSeenMeasureGuide(): boolean {
  const seen = loadState().measureGuideSeenVersion;
  return seen !== null && seen >= MEASURE_GUIDE_VERSION;
}

/** 測定案内を見たことを記録する */
export function markMeasureGuideSeen(): void {
  saveState({ ...loadState(), measureGuideSeenVersion: MEASURE_GUIDE_VERSION });
}

/** 学習モードの1問分の結果を累計に加える */
export function recordLearnAnswer(expected: Category, answered: Category): LearnStats {
  const current = loadState();
  const stats = current.learnStats;
  const next: LearnStats = {
    answered: stats.answered + 1,
    correct: stats.correct + (expected === answered ? 1 : 0),
    confusion: {
      ...stats.confusion,
      [expected]: {
        ...stats.confusion[expected],
        [answered]: stats.confusion[expected][answered] + 1,
      },
    },
  };
  saveState({ ...current, learnStats: next });
  return next;
}

/** 保存済みの locale のみを取得する（起動時の言語決定用） */
export function loadStoredLocale(): string | null {
  const parsed = readRaw();
  if (parsed === null || typeof parsed !== 'object') return null;
  const settings = (parsed as Partial<PersistedState>).settings;
  return typeof settings?.locale === 'string' ? settings.locale : null;
}
