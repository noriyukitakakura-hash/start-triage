import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BEST_TIMES,
  DEFAULT_SETTINGS,
  OBSERVED_RR_MARGIN,
  isRrPresentation,
  loadState,
  loadStoredLocale,
  patchSettings,
  recordBestTime,
  rrMarginFor,
  saveState,
} from '@/lib/storage';

const KEY = 'triage-start:v1';

function writeRaw(value: unknown): void {
  localStorage.setItem(KEY, JSON.stringify(value));
}

describe('loadState: v1 → v2 移行', () => {
  beforeEach(() => localStorage.clear());

  it('v1 の単一 bestTimeMs を数値モードの記録として引き継ぐ', () => {
    writeRaw({
      schemaVersion: 1,
      bestTimeMs: 83450,
      settings: { locale: 'en', profile: 'JP-FDMA', boundaryRate: 0.5, suddenDeath: true, showTimer: false },
    });

    const state = loadState();
    expect(state.schemaVersion).toBe(2);
    expect(state.bestTimeMs).toEqual({ numeric: 83450, observed: null });
  });

  it('v1 の設定は破棄せず引き継ぐ', () => {
    writeRaw({
      schemaVersion: 1,
      bestTimeMs: 1000,
      settings: { locale: 'en', profile: 'JP-FDMA', boundaryRate: 0.5, suddenDeath: true, showTimer: false },
    });

    const { settings } = loadState();
    expect(settings.locale).toBe('en');
    expect(settings.boundaryRate).toBe(0.5);
    expect(settings.suddenDeath).toBe(true);
    expect(settings.showTimer).toBe(false);
  });

  it('v1 には存在しなかった rrPresentation は既定の numeric になる', () => {
    writeRaw({ schemaVersion: 1, bestTimeMs: 1000, settings: { locale: 'ja' } });
    expect(loadState().settings.rrPresentation).toBe('numeric');
  });

  it('v1 の bestTimeMs が未設定でも落ちない', () => {
    writeRaw({ schemaVersion: 1, bestTimeMs: null, settings: { locale: 'ja' } });
    expect(loadState().bestTimeMs).toEqual(DEFAULT_BEST_TIMES);
  });
});

describe('loadState: 不正な値の検証', () => {
  beforeEach(() => localStorage.clear());

  it('保存がなければ既定値', () => {
    expect(loadState()).toEqual({
      schemaVersion: 2,
      settings: DEFAULT_SETTINGS,
      bestTimeMs: DEFAULT_BEST_TIMES,
    });
  });

  it('JSON が壊れていても例外を投げない', () => {
    localStorage.setItem(KEY, '{壊れた');
    expect(() => loadState()).not.toThrow();
    expect(loadState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('不正な rrPresentation は numeric に落ちる', () => {
    writeRaw({ schemaVersion: 2, settings: { rrPresentation: 'telepathy' }, bestTimeMs: {} });
    expect(loadState().settings.rrPresentation).toBe('numeric');
  });

  it('不正な locale は既定に落ちる', () => {
    writeRaw({ schemaVersion: 2, settings: { locale: 'xx' }, bestTimeMs: {} });
    expect(loadState().settings.locale).toBe(DEFAULT_SETTINGS.locale);
  });

  it('profile は保存値にかかわらず JP-FDMA に固定される', () => {
    writeRaw({ schemaVersion: 2, settings: { profile: 'US-START' }, bestTimeMs: {} });
    expect(loadState().settings.profile).toBe('JP-FDMA');
  });

  it('範囲外の boundaryRate は既定に落ちる', () => {
    for (const bad of [-0.1, 1.5, 'high', null]) {
      writeRaw({ schemaVersion: 2, settings: { boundaryRate: bad }, bestTimeMs: {} });
      expect(loadState().settings.boundaryRate).toBe(DEFAULT_SETTINGS.boundaryRate);
    }
  });

  it('負・ゼロ・非数のベストタイムは null になる', () => {
    writeRaw({ schemaVersion: 2, settings: {}, bestTimeMs: { numeric: -5, observed: 'fast' } });
    expect(loadState().bestTimeMs).toEqual({ numeric: null, observed: null });
  });

  it('未知の将来バージョンは既定値へ落とす', () => {
    writeRaw({ schemaVersion: 99, settings: { locale: 'en' }, bestTimeMs: { numeric: 1000 } });
    expect(loadState()).toEqual({
      schemaVersion: 2,
      settings: DEFAULT_SETTINGS,
      bestTimeMs: DEFAULT_BEST_TIMES,
    });
  });
});

describe('recordBestTime: 提示方式ごとに分離して記録する', () => {
  beforeEach(() => localStorage.clear());

  it('初回は必ず記録される', () => {
    expect(recordBestTime('numeric', 90000)).toBe(true);
    expect(loadState().bestTimeMs).toEqual({ numeric: 90000, observed: null });
  });

  it('速くなった場合のみ更新する', () => {
    recordBestTime('numeric', 90000);
    expect(recordBestTime('numeric', 95000)).toBe(false);
    expect(recordBestTime('numeric', 85000)).toBe(true);
    expect(loadState().bestTimeMs.numeric).toBe(85000);
  });

  it('同タイムは更新しない', () => {
    recordBestTime('numeric', 90000);
    expect(recordBestTime('numeric', 90000)).toBe(false);
  });

  it('実測モードの記録が数値モードの記録を上書きしない', () => {
    recordBestTime('numeric', 60000);
    // 実測モードは観察時間が支配的で必ず遅くなる。それでも別枠として記録される
    expect(recordBestTime('observed', 180000)).toBe(true);

    expect(loadState().bestTimeMs).toEqual({ numeric: 60000, observed: 180000 });
  });

  it('モードをまたいだ比較で記録が失われない', () => {
    recordBestTime('observed', 180000);
    // 数値モードの速いタイムは、実測モードの記録と比較されない
    expect(recordBestTime('numeric', 60000)).toBe(true);
    expect(loadState().bestTimeMs.observed).toBe(180000);
  });
});

describe('rrMarginFor', () => {
  it('数値モードは制約なし、実測モードは4回', () => {
    expect(rrMarginFor('numeric')).toBe(0);
    expect(rrMarginFor('observed')).toBe(OBSERVED_RR_MARGIN);
    expect(OBSERVED_RR_MARGIN).toBe(4);
  });
});

describe('isRrPresentation', () => {
  it('既知の値のみ受け付ける', () => {
    expect(isRrPresentation('numeric')).toBe(true);
    expect(isRrPresentation('observed')).toBe(true);
    expect(isRrPresentation('animated')).toBe(false);
    expect(isRrPresentation(null)).toBe(false);
    expect(isRrPresentation(undefined)).toBe(false);
  });
});

describe('patchSettings', () => {
  beforeEach(() => localStorage.clear());

  it('指定した設定だけを変更する', () => {
    patchSettings({ rrPresentation: 'observed' });
    const { settings } = loadState();
    expect(settings.rrPresentation).toBe('observed');
    expect(settings.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(settings.boundaryRate).toBe(DEFAULT_SETTINGS.boundaryRate);
  });

  it('提示方式を切り替えてもベストタイムは保持される', () => {
    recordBestTime('numeric', 70000);
    patchSettings({ rrPresentation: 'observed' });
    expect(loadState().bestTimeMs.numeric).toBe(70000);
  });

  it('言語切替は判定基準プロファイルを変更しない（docs/I18N.md §2）', () => {
    patchSettings({ locale: 'en' });
    expect(loadState().settings.profile).toBe('JP-FDMA');
  });
});

describe('localStorage が使えない環境', () => {
  beforeEach(() => localStorage.clear());

  it('書き込みが失敗しても例外を投げない', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => saveState({ schemaVersion: 2, settings: DEFAULT_SETTINGS, bestTimeMs: DEFAULT_BEST_TIMES })).not.toThrow();
    expect(() => patchSettings({ rrPresentation: 'observed' })).not.toThrow();
    expect(() => recordBestTime('numeric', 1000)).not.toThrow();

    spy.mockRestore();
  });

  it('読み込みが失敗しても既定値を返す', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(loadState().settings).toEqual(DEFAULT_SETTINGS);
    expect(loadStoredLocale()).toBeNull();

    spy.mockRestore();
  });
});
