import { useCallback, useState } from 'react';
import { VOICE_PROMPTS, responseKeyFor, type VoicePrompt } from '@/domain/consciousness';
import type { TriageCase } from '@/domain/types';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

/**
 * 声かけと反応（SPEC §2.2）。
 *
 * 傷病者に声をかけ、返ってきた反応から従命の可否を判断する。
 *
 * **押すまで反応を出さない。** 先に見せてしまうと、確かめる行為そのものが
 * 訓練にならない。
 *
 * **呼名では従命を確認できない。** 選択肢に混ぜてあるのは、
 * 「どう声をかけるか」も判断の一部だからである。
 *
 * イラストに重ねて配置する。イラストには余裕があるため高さが増えず、
 * 呼吸の計数を犠牲にしない（SPEC §5.1）。
 */
export interface VoicePromptOverlayProps {
  case: TriageCase;
  /** 利用者が行った声かけを親へ伝える（解説での指摘に使う） */
  onAsked: (prompts: VoicePrompt[]) => void;
}

export function VoicePromptOverlay({ case: c, onAsked }: VoicePromptOverlayProps) {
  const { t } = useI18n();
  const [asked, setAsked] = useState<VoicePrompt[]>([]);
  const [last, setLast] = useState<VoicePrompt | null>(null);

  const ask = useCallback(
    (prompt: VoicePrompt) => {
      setLast(prompt);
      setAsked((previous) => {
        // 同じ声かけを繰り返しても反応は変わらない。症例の性質であるため
        const next = previous.includes(prompt) ? previous : [...previous, prompt];
        onAsked(next);
        return next;
      });
    },
    [onAsked],
  );

  return (
    <div
      role="group"
      aria-label={t('voice.heading')}
      className="pointer-events-none absolute inset-0 flex flex-col justify-between p-1"
    >
      {/* 吹き出し。傷病者の頭部付近に出す */}
      <div aria-live="polite" className="flex justify-center">
        {last !== null && (
          <p className="pointer-events-auto max-w-[85%] border border-slate-500 bg-slate-950/90 px-2 py-1 text-center text-xs leading-tight text-slate-100">
            {t(responseKeyFor(c, last) as TranslationKey)}
          </p>
        )}
      </div>

      <div className="pointer-events-auto flex gap-1">
        {VOICE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            aria-label={t(`voice.prompt.${prompt}`)}
            aria-pressed={asked.includes(prompt)}
            className={[
              'min-h-11 flex-1 border px-1 text-[11px] font-medium leading-tight transition active:scale-95',
              asked.includes(prompt)
                ? 'border-slate-400 bg-slate-700 text-slate-100'
                : 'border-slate-600 bg-slate-900/85 text-slate-200',
            ].join(' ')}
          >
            {t(`voice.prompt.${prompt}.short`)}
          </button>
        ))}
      </div>
    </div>
  );
}
