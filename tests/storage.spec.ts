import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MEASURED_CRT_MARGIN } from '@/domain/circulation';
import {
  DEFAULT_BEST_TIMES,
  DEFAULT_SETTINGS,
  OBSERVED_RR_MARGIN,
  crtMarginFor,
  isRrPresentation,
  loadState,
  DISCLAIMER_VERSION,
  acknowledgeDisclaimer,
  emptyLearnStats,
  hasAcknowledgedDisclaimer,
  loadStoredLocale,
  patchSettings,
  recordLearnAnswer,
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

  it('v1 には存在しなかった rrPresentation は既定値になる', () => {
    writeRaw({ schemaVersion: 1, bestTimeMs: 1000, settings: { locale: 'ja' } });
    expect(loadState().settings.vitalsPresentation).toBe(DEFAULT_SETTINGS.vitalsPresentation);
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
      learnStats: emptyLearnStats(),
      disclaimerAckVersion: null,
    });
  });

  it('JSON が壊れていても例外を投げない', () => {
    localStorage.setItem(KEY, '{壊れた');
    expect(() => loadState()).not.toThrow();
    expect(loadState().settings).toEqual(DEFAULT_SETTINGS);
  });

  it('不正な rrPresentation は既定値に落ちる', () => {
    writeRaw({ schemaVersion: 2, settings: { vitalsPresentation: 'telepathy' }, bestTimeMs: {} });
    expect(loadState().settings.vitalsPresentation).toBe(DEFAULT_SETTINGS.vitalsPresentation);
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
      learnStats: emptyLearnStats(),
      disclaimerAckVersion: null,
    });
  });
});

describe('recordLearnAnswer: 学習統計（SPEC §2.3）', () => {
  beforeEach(() => localStorage.clear());

  it('正答と誤答を累計する', () => {
    recordLearnAnswer('I', 'I');
    recordLearnAnswer('II', 'I');
    const stats = recordLearnAnswer('III', 'III');

    expect(stats.answered).toBe(3);
    expect(stats.correct).toBe(2);
  });

  it('誤答の内訳を混同行列に積む', () => {
    recordLearnAnswer('II', 'I');
    recordLearnAnswer('II', 'I');
    const stats = recordLearnAnswer('0', 'I');

    expect(stats.confusion.II.I).toBe(2);
    expect(stats.confusion['0'].I).toBe(1);
    expect(stats.confusion.II.II).toBe(0);
  });

  it('正答も混同行列の対角に積まれる', () => {
    const stats = recordLearnAnswer('III', 'III');
    expect(stats.confusion.III.III).toBe(1);
  });

  it('統計は永続化される', () => {
    recordLearnAnswer('I', 'I');
    expect(loadState().learnStats.answered).toBe(1);
  });

  it('壊れた統計は初期化され、正答数が回答数を超えない', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 2, settings: {}, bestTimeMs: {}, learnStats: { answered: 3, correct: 99, confusion: 'broken' } }),
    );
    const stats = loadState().learnStats;
    expect(stats.answered).toBe(3);
    expect(stats.correct).toBe(3);
    expect(stats.confusion.I.I).toBe(0);
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

describe('既定の提示方式（SPEC §2.2）', () => {
  beforeEach(() => localStorage.clear());

  it('既定は実測モード。現場で必要な「見て判断する」技能を標準にする', () => {
    expect(DEFAULT_SETTINGS.vitalsPresentation).toBe('observed');
    expect(loadState().settings.vitalsPresentation).toBe('observed');
  });

  it('既定では呼吸数もCRTも閾値から離される（実測モードの制約が既定で効く）', () => {
    const presentation = loadState().settings.vitalsPresentation;
    expect(rrMarginFor(presentation)).toBe(OBSERVED_RR_MARGIN);
    expect(crtMarginFor(presentation)).toBe(MEASURED_CRT_MARGIN);
  });

  it('数値モードではどちらのマージンもかからない', () => {
    expect(rrMarginFor('numeric')).toBe(0);
    expect(crtMarginFor('numeric')).toBe(0);
  });
});

describe('設定の改名 rrPresentation → vitalsPresentation', () => {
  beforeEach(() => localStorage.clear());

  it('旧フィールドの値を引き継ぐ（記録も設定も失わない）', () => {
    writeRaw({ schemaVersion: 2, settings: { rrPresentation: 'numeric' }, bestTimeMs: { numeric: 70_000 } });

    const state = loadState();
    expect(state.settings.vitalsPresentation).toBe('numeric');
    // 値を変えていないので自己ベストのキーもそのまま使える
    expect(state.bestTimeMs.numeric).toBe(70_000);
  });

  it('新フィールドがあれば旧フィールドより優先する', () => {
    writeRaw({
      schemaVersion: 2,
      settings: { rrPresentation: 'numeric', vitalsPresentation: 'observed' },
      bestTimeMs: {},
    });
    expect(loadState().settings.vitalsPresentation).toBe('observed');
  });

  it('旧フィールドが不正なら既定値に落ちる', () => {
    writeRaw({ schemaVersion: 2, settings: { rrPresentation: 'telepathy' }, bestTimeMs: {} });
    expect(loadState().settings.vitalsPresentation).toBe(DEFAULT_SETTINGS.vitalsPresentation);
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
    patchSettings({ vitalsPresentation: 'observed' });
    const { settings } = loadState();
    expect(settings.vitalsPresentation).toBe('observed');
    expect(settings.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(settings.boundaryRate).toBe(DEFAULT_SETTINGS.boundaryRate);
  });

  it('提示方式を切り替えてもベストタイムは保持される', () => {
    recordBestTime('numeric', 70000);
    patchSettings({ vitalsPresentation: 'observed' });
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

    expect(() => saveState({ schemaVersion: 2, settings: DEFAULT_SETTINGS, bestTimeMs: DEFAULT_BEST_TIMES, learnStats: emptyLearnStats(), disclaimerAckVersion: null })).not.toThrow();
    expect(() => patchSettings({ vitalsPresentation: 'observed' })).not.toThrow();
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

describe('免責文の確認状態（SPEC §1.7）', () => {
  beforeEach(() => localStorage.clear());

  it('初回は未確認', () => {
    expect(hasAcknowledgedDisclaimer()).toBe(false);
    expect(loadState().disclaimerAckVersion).toBeNull();
  });

  it('確認すると記録され、次回以降は確認済みになる', () => {
    acknowledgeDisclaimer();
    expect(hasAcknowledgedDisclaimer()).toBe(true);
    expect(loadState().disclaimerAckVersion).toBe(DISCLAIMER_VERSION);
  });

  it('免責文を改訂したら（版が上がったら）再確認が必要になる', () => {
    writeRaw({ schemaVersion: 2, settings: {}, bestTimeMs: {}, disclaimerAckVersion: DISCLAIMER_VERSION - 1 });
    expect(hasAcknowledgedDisclaimer()).toBe(false);
  });

  it('不正な値は未確認として扱う', () => {
    for (const bad of ['yes', true, {}, NaN]) {
      writeRaw({ schemaVersion: 2, settings: {}, bestTimeMs: {}, disclaimerAckVersion: bad });
      expect(hasAcknowledgedDisclaimer()).toBe(false);
    }
  });

  it('確認しても他の設定や統計を壊さない', () => {
    patchSettings({ vitalsPresentation: 'observed' });
    recordLearnAnswer('I', 'I');
    acknowledgeDisclaimer();

    const state = loadState();
    expect(state.settings.vitalsPresentation).toBe('observed');
    expect(state.learnStats.answered).toBe(1);
    expect(state.disclaimerAckVersion).toBe(DISCLAIMER_VERSION);
  });
});
