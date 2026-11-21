import type { NonObeyingResponse, TriageCase } from './types';

/**
 * 声かけと反応の対応（SPEC §2.2）。
 *
 * 現場では傷病者に声をかけ、その反応から従命の可否を判断する。
 * **声のかけ方自体に適否がある。** 呼名だけでは反応の有無しか分からず、
 * 従命を確認できない。
 *
 * `domain/breathing.ts` や `domain/circulation.ts` と同じく、
 * **表示文字列を返さず翻訳キーを返す**（docs/I18N.md §5）。
 */

export const VOICE_PROMPTS = ['callName', 'openEyes', 'squeezeHand'] as const;
export type VoicePrompt = (typeof VOICE_PROMPTS)[number];

/**
 * その声かけで従命の可否を確かめられるか。
 *
 * **呼名では確かめられない。** 「聞こえますか？」に声が返っても、
 * それは反応があっただけで、指示に従えたことにはならない。
 */
export function confirmsObedience(prompt: VoicePrompt): boolean {
  return prompt !== 'callName';
}

/** 症例が示す反応の種別。従命できる症例は `obeys` */
export type ResponseKind = 'obeys' | NonObeyingResponse;

export function responseKindOf(c: TriageCase): ResponseKind {
  if (c.obeysCommands) return 'obeys';
  // 生成側の整合性制約により、従命できない症例は必ず反応を持つ
  return c.nonObeyingResponse ?? 'none';
}

/**
 * 声かけに対する反応の翻訳キー。
 *
 * 無反応は声かけによらず同じなので、キーをひとつにまとめている。
 */
export function responseKeyFor(c: TriageCase, prompt: VoicePrompt): string {
  const kind = responseKindOf(c);
  if (kind === 'none') return 'voice.response.none';
  return `voice.response.${kind}.${prompt}`;
}

/**
 * その反応が「指示に従った」ことを示すか。
 *
 * **呼名への反応は、従命できる症例でも従命を示さない。**
 * 解説でこの点を指摘するために使う。
 */
export function showsObedience(c: TriageCase, prompt: VoicePrompt): boolean {
  return c.obeysCommands && confirmsObedience(prompt);
}

/** 利用者が従命を確認できる声かけを行ったか */
export function hasConfirmedObedience(prompts: readonly VoicePrompt[]): boolean {
  return prompts.some(confirmsObedience);
}
