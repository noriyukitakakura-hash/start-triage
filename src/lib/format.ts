/** 表示用の整形。計測そのものは performance.now() の生値で行う */

/** 経過秒を小数1桁で返す。例 12400 → "12.4" */
export function formatSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

/** 正答率を整数パーセントで返す。0問のときは 0 */
export function accuracyPercent(correct: number, answered: number): number {
  if (answered <= 0) return 0;
  return Math.round((correct / answered) * 100);
}

/** 符号付きの差分。例 -2 → "−2"、+3 → "+3" */
export function signedDelta(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * 経過時間を分と秒に分ける。表記（「1分23.45秒」か「1:23.45」か）は
 * 言語ごとに異なるため、整形そのものは表示層に委ねる。
 */
export function formatDurationParts(ms: number): { minutes: number; seconds: string } {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  // 分がある場合は秒を2桁ゼロ詰めにする（1分5.30秒 を 1分05.30秒 と揃える）
  const fixed = seconds.toFixed(2);
  return { minutes, seconds: minutes > 0 ? fixed.padStart(5, '0') : fixed };
}
