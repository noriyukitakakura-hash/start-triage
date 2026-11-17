import { useCallback, useEffect, useRef, useState } from 'react';
import { CRT_PRESS_SECONDS, estimateCrtSeconds, isPressSufficient } from '@/domain/circulation';

/**
 * CRT 計測の手順（docs/OBSERVATION.md §3.4）。
 *
 * 現場の手技をそのままなぞる:
 * 1. 爪床を {@link CRT_PRESS_SECONDS} 秒間圧迫する
 * 2. 離すと爪床は白くなっている
 * 3. 色が戻るまでの秒数を自分で測る
 *
 * **圧迫が5秒に満たない計測は無効として扱う。** 毛細血管が十分に空にならず
 * 正しく測れないため。ここで手技の要点を体で覚えてもらう。
 *
 * 見た目から独立させているのは、**表示が小さくなっても手技の規則は
 * 変わってはならない**ため。レイアウトを変えても規則が壊れていないことを
 * テストで押さえられる。
 */
export type CrtPhase = 'idle' | 'pressing' | 'refilling' | 'measured';

export interface CrtMeasurement {
  phase: CrtPhase;
  /** 押下中の残り秒数 */
  remaining: number;
  /** 圧迫が短すぎて成立しなかった直後か */
  tooShort: boolean;
  startPress: () => void;
  endPress: () => void;
  reportReturned: () => void;
  retry: () => void;
}

export function useCrtMeasurement(onMeasured: (seconds: number) => void): CrtMeasurement {
  const [phase, setPhase] = useState<CrtPhase>('idle');
  const [remaining, setRemaining] = useState(CRT_PRESS_SECONDS);
  const [tooShort, setTooShort] = useState(false);
  const pressStartRef = useRef<number | null>(null);
  const releasedAtRef = useRef<number | null>(null);

  // 残り秒数の表示だけを 100ms 間隔で更新する。
  // 判定そのものは performance.now() の差分で行い、描画頻度に影響されない
  useEffect(() => {
    if (phase !== 'pressing') return;
    const id = setInterval(() => {
      const start = pressStartRef.current;
      if (start === null) return;
      const left = CRT_PRESS_SECONDS - (performance.now() - start) / 1000;
      setRemaining(Math.max(0, Number(left.toFixed(1))));
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const startPress = useCallback(() => {
    setPhase((current) => {
      if (current === 'refilling' || current === 'measured') return current;
      setTooShort(false);
      pressStartRef.current = performance.now();
      setRemaining(CRT_PRESS_SECONDS);
      return 'pressing';
    });
  }, []);

  const endPress = useCallback(() => {
    setPhase((current) => {
      if (current !== 'pressing') return current;

      const start = pressStartRef.current;
      const pressMs = start === null ? 0 : performance.now() - start;
      pressStartRef.current = null;

      if (!isPressSufficient(pressMs)) {
        // 圧迫不足。手技として成立していないので計測させない
        setTooShort(true);
        return 'idle';
      }

      releasedAtRef.current = performance.now();
      return 'refilling';
    });
  }, []);

  const reportReturned = useCallback(() => {
    setPhase((current) => {
      const released = releasedAtRef.current;
      if (current !== 'refilling' || released === null) return current;
      onMeasured(estimateCrtSeconds(released, performance.now()));
      return 'measured';
    });
  }, [onMeasured]);

  const retry = useCallback(() => {
    releasedAtRef.current = null;
    setTooShort(false);
    setPhase('idle');
  }, []);

  return { phase, remaining, tooShort, startPress, endPress, reportReturned, retry };
}
