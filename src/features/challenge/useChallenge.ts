import { useCallback, useMemo, useState } from 'react';
import { generateQuizSet, QUIZ_LENGTH, type GeneratedCase } from '@/domain/generator';
import { judge } from '@/domain/judge';
import { JP_FDMA } from '@/domain/profiles';
import { createRng } from '@/domain/rng';
import type { Category } from '@/domain/types';
import { recordBestTime, rrMarginFor, type RrPresentation, type Settings } from '@/lib/storage';

/**
 * 10問チャレンジの進行（SPEC §2.4）。
 *
 * **計測は `performance.now()` の差分で行う。** 1問目の提示から10問目の回答確定まで。
 * 表示の更新頻度とは独立させ、描画が計測精度に影響しないようにする（SPEC §4.5）。
 */

export type ChallengePhase = 'countdown' | 'playing' | 'finished';

export interface AnsweredCase {
  item: GeneratedCase;
  expected: Category;
  answered: Category;
  correct: boolean;
}

export interface ChallengeState {
  phase: ChallengePhase;
  /** 現在の問題番号（0 始まり） */
  index: number;
  current: GeneratedCase | null;
  answers: AnsweredCase[];
  /** `performance.now()` 基準。1問目提示時に設定される */
  startedAt: number | null;
  /** 確定した所要時間 */
  timeMs: number | null;
  correct: number;
  /** サドンデスで打ち切られたか */
  endedEarly: boolean;
  /** 自己ベストを更新したか */
  newBest: boolean;
}

export interface Challenge extends ChallengeState {
  total: number;
  presentation: RrPresentation;
  begin: () => void;
  answer: (category: Category) => void;
  restart: () => void;
}

function createSet(settings: Settings): GeneratedCase[] {
  const rng = createRng(`challenge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  return generateQuizSet(rng, {
    boundaryRate: settings.boundaryRate,
    rrMargin: rrMarginFor(settings.rrPresentation),
    profile: JP_FDMA,
  });
}

const INITIAL: Omit<ChallengeState, 'current'> = {
  phase: 'countdown',
  index: 0,
  answers: [],
  startedAt: null,
  timeMs: null,
  correct: 0,
  endedEarly: false,
  newBest: false,
};

export function useChallenge(settings: Settings): Challenge {
  const [cases, setCases] = useState<GeneratedCase[]>(() => createSet(settings));
  const [state, setState] = useState<Omit<ChallengeState, 'current'>>(INITIAL);

  const current = state.phase === 'playing' ? (cases[state.index] ?? null) : null;

  /** カウントダウン終了。ここで計測を開始する */
  const begin = useCallback(() => {
    setState((s) => ({ ...s, phase: 'playing', startedAt: performance.now() }));
  }, []);

  const answer = useCallback(
    (category: Category) => {
      setState((s) => {
        if (s.phase !== 'playing') return s;
        const item = cases[s.index];
        if (item === undefined) return s;

        const expected = judge(item.case, JP_FDMA).category;
        const correct = expected === category;
        const answers = [...s.answers, { item, expected, answered: category, correct }];
        const correctCount = s.correct + (correct ? 1 : 0);

        const isLast = s.index + 1 >= cases.length;
        const stopNow = settings.suddenDeath && !correct;

        if (!isLast && !stopNow) {
          return { ...s, index: s.index + 1, answers, correct: correctCount };
        }

        // 終了。計測を確定させる
        const timeMs = s.startedAt === null ? 0 : performance.now() - s.startedAt;
        // **全問正解のときだけ記録する。** 誤答を含む速い回が完答より上に来ないようにするため
        const perfect = correctCount === cases.length;
        const newBest = perfect && recordBestTime(settings.rrPresentation, timeMs);

        return {
          ...s,
          phase: 'finished',
          answers,
          correct: correctCount,
          timeMs,
          endedEarly: stopNow && !isLast,
          newBest,
        };
      });
    },
    [cases, settings.suddenDeath, settings.rrPresentation],
  );

  const restart = useCallback(() => {
    setCases(createSet(settings));
    setState(INITIAL);
  }, [settings]);

  return useMemo(
    () => ({
      ...state,
      current,
      total: cases.length || QUIZ_LENGTH,
      presentation: settings.rrPresentation,
      begin,
      answer,
      restart,
    }),
    [state, current, cases.length, settings.rrPresentation, begin, answer, restart],
  );
}
