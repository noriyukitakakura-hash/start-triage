import { describe, expect, it } from 'vitest';
import {
  CRT_BANDS,
  CRT_PRESS_SECONDS,
  MEASURED_CRT_MARGIN,
  crtBandOf,
  estimateCrtSeconds,
  isPressSufficient,
} from '@/domain/circulation';
import { judge } from '@/domain/judge';
import { JP_FDMA } from '@/domain/profiles';
import type { TriageCase } from '@/domain/types';

describe('isPressSufficient: 圧迫時間が足りない計測は無効', () => {
  it(`${CRT_PRESS_SECONDS}秒未満は不十分`, () => {
    expect(isPressSufficient(0)).toBe(false);
    expect(isPressSufficient(1000)).toBe(false);
    expect(isPressSufficient(CRT_PRESS_SECONDS * 1000 - 1)).toBe(false);
  });

  it(`${CRT_PRESS_SECONDS}秒以上なら十分`, () => {
    expect(isPressSufficient(CRT_PRESS_SECONDS * 1000)).toBe(true);
    expect(isPressSufficient(8000)).toBe(true);
  });

  it('現場の手技どおり5秒を要求する', () => {
    expect(CRT_PRESS_SECONDS).toBe(5);
  });
});

describe('estimateCrtSeconds', () => {
  it('離してから申告するまでの秒数を小数1桁で返す', () => {
    expect(estimateCrtSeconds(1000, 3400)).toBe(2.4);
    expect(estimateCrtSeconds(10_000, 11_200)).toBe(1.2);
  });

  it('真の値どおりに申告すれば測定値が一致する', () => {
    for (const crt of [1.0, 1.5, 2.5, 3.2, 4.0]) {
      const released = 5000;
      expect(estimateCrtSeconds(released, released + crt * 1000)).toBe(crt);
    }
  });

  it('時刻が逆転しても負を返さない', () => {
    expect(estimateCrtSeconds(5000, 4000)).toBe(0);
  });

  it('浮動小数の誤差を持たない', () => {
    for (let ms = 0; ms <= 4000; ms += 100) {
      const v = estimateCrtSeconds(0, ms);
      expect(v).toBe(Number(v.toFixed(1)));
    }
  });
});

describe('crtBandOf: judge と同じ境界を使う', () => {
  const base: TriageCase = {
    id: 'crt-band',
    patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
    canWalk: false,
    hasSpontaneousBreathing: true,
    breathingAfterAirway: null,
    respiratoryRate: 18,
    radialPulsePalpable: true,
    pulseRate: 88,
    crtSeconds: 1.2,
    obeysCommands: true,
  };

  it('閾値ちょうどは delayed、その直下は withinRange', () => {
    expect(crtBandOf(JP_FDMA.crtThresholdSeconds, JP_FDMA)).toBe('delayed');
    expect(crtBandOf(1.9, JP_FDMA)).toBe('withinRange');
    expect(crtBandOf(2.0, JP_FDMA)).toBe('delayed');
  });

  it('帯の判断が judge の循環判定と一致する', () => {
    for (let crt = 1.0; crt <= 4.0; crt = Number((crt + 0.1).toFixed(1))) {
      const category = judge({ ...base, crtSeconds: crt }, JP_FDMA).category;
      const band = crtBandOf(crt, JP_FDMA);
      // 循環で確定するなら I類、通過すれば意識へ進んで II類
      expect(band === 'delayed' ? 'I' : 'II', `crt=${crt}`).toBe(category);
    }
  });

  it('定義済みの帯しか返さない', () => {
    for (let crt = 0.1; crt <= 6.0; crt = Number((crt + 0.1).toFixed(1))) {
      expect(CRT_BANDS).toContain(crtBandOf(crt, JP_FDMA));
    }
  });
});

describe('実測CRTのマージン', () => {
  it('目視誤差（±0.3秒程度）を超える0.5秒を確保する', () => {
    expect(MEASURED_CRT_MARGIN).toBe(0.5);
  });

  it('通過域の上限と該当域の下限が1.0秒離れる', () => {
    const passMax = JP_FDMA.crtThresholdSeconds - MEASURED_CRT_MARGIN;
    const failMin = JP_FDMA.crtThresholdSeconds + MEASURED_CRT_MARGIN;
    expect(passMax).toBe(1.5);
    expect(failMin).toBe(2.5);
    expect(failMin - passMax).toBeCloseTo(1.0, 10);
  });
});
