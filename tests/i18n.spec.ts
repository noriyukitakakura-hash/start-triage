import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ja } from '@/i18n/ja';
import { en } from '@/i18n/en';
import { interpolate, translate } from '@/i18n';
import { detectLocale } from '@/i18n/detect';
import { LOCALES } from '@/i18n/types';
import { ALL_RATIONALE_KEYS, CONCLUSION_KEY, explain } from '@/domain/explain';
import { VALID_COMBINATIONS, generateCase } from '@/domain/generator';
import { ILLUSTRATIONS } from '@/domain/illustrations';
import { JP_FDMA } from '@/domain/profiles';
import { createRng } from '@/domain/rng';
import { CATEGORIES, DECIDING_STEPS } from '@/domain/types';

const PLACEHOLDER = /\{(\w+)\}/g;
function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((m) => m[1] as string).sort();
}

describe('I18N.md §9-1: キー集合の一致', () => {
  it('ja と en のキー集合が完全に一致する', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });
});

describe('I18N.md §9-2: プレースホルダの一致', () => {
  it.each(Object.keys(ja) as (keyof typeof ja)[])('%s のプレースホルダが ja/en で一致する', (key) => {
    expect(placeholders(en[key])).toEqual(placeholders(ja[key]));
  });
});

describe('I18N.md §9-3: 空文字の禁止', () => {
  it.each(LOCALES)('%s に空の訳文が存在しない', (locale) => {
    const messages = locale === 'ja' ? (ja as Record<string, string>) : (en as Record<string, string>);
    const empty = Object.entries(messages).filter(([, v]) => v.trim() === '');
    expect(empty).toEqual([]);
  });
});

describe('I18N.md §9-4: ドメイン層の言語非依存性', () => {
  it('src/domain 配下に i18n / react への import が存在しない', () => {
    const dir = join(process.cwd(), 'src/domain');
    // P1 以降にファイルが入る。空／未作成でもテストが壊れないようにする
    if (!existsSync(dir)) return;
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'));
    const offenders = files.filter((f) => {
      const src = readFileSync(join(dir, f), 'utf8');
      return /from\s+['"](.*i18n.*|react(-dom)?)['"]/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});

describe('I18N.md §9-5: ドメイン層が生成するキーの実在性', () => {
  const keys = Object.keys(ja);

  it('judge が返し得る全根拠キーが ja/en 双方に存在する', () => {
    const missing = ALL_RATIONALE_KEYS.filter((k) => !keys.includes(k));
    expect(missing).toEqual([]);
  });

  it('explain の結論キーが存在する', () => {
    expect(keys).toContain(CONCLUSION_KEY);
  });

  it('イラストカタログの全状況文キーが存在する', () => {
    const missing = ILLUSTRATIONS.map((i) => i.situationKey).filter((k) => !keys.includes(k));
    expect(missing).toEqual([]);
  });

  it('全 DecidingStep のステップ名キーが存在する', () => {
    const missing = DECIDING_STEPS.map((s) => `step.${s}`).filter((k) => !keys.includes(k));
    expect(missing).toEqual([]);
  });

  it('全 Category の区分名キーが存在する', () => {
    const missing = CATEGORIES.flatMap((c) => [
      `category.${c}.roman`,
      `category.${c}.short`,
      `category.${c}.name`,
      `category.${c}.color`,
    ]).filter((k) => !keys.includes(k));
    expect(missing).toEqual([]);
  });

  it('全ステップ・全分岐を網羅しても未登録のキーが現れない', () => {
    // 生成し得る全組み合わせを実際に判定・解説まで通し、キーの欠落を検出する
    const rng = createRng('i18n-coverage');
    const used = new Set<string>();

    for (let i = 0; i < 3000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const g = generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng);
      const e = explain(g.case, JP_FDMA);

      used.add(e.conclusion.key);
      used.add(g.case.patient.situationKey);
      for (const step of e.steps) {
        used.add(`step.${step.step}`);
        for (const d of step.details) used.add(d.key);
      }
    }

    const missing = [...used].filter((k) => !keys.includes(k));
    expect(missing).toEqual([]);
    // 14の根拠キーすべてが実際に到達されることも確認する
    expect(ALL_RATIONALE_KEYS.filter((k) => !used.has(k))).toEqual([]);
  });
});

describe('interpolate', () => {
  it('プレースホルダを置換する', () => {
    expect(interpolate('呼吸数 {rr}回/分（{threshold}回以上）', { rr: 32, threshold: 30 })).toBe(
      '呼吸数 32回/分（30回以上）',
    );
  });

  it('params が未指定ならテンプレートをそのまま返す', () => {
    expect(interpolate('{rr}')).toBe('{rr}');
  });

  it('未知のプレースホルダは置換せず残す', () => {
    expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}');
  });

  it('prototype 由来のキーを値として解決しない', () => {
    expect(interpolate('{toString}', {})).toBe('{toString}');
  });
});

describe('translate', () => {
  it('ロケールごとに異なる訳文を返す', () => {
    expect(translate('ja', 'nav.challenge')).toBe('10問チャレンジ');
    expect(translate('en', 'nav.challenge')).toBe('10-Case Challenge');
  });

  it('params を適用する', () => {
    expect(translate('en', 'dev.scaffoldReady', { locale: 'en' })).toContain('en');
  });
});

describe('detectLocale (I18N.md §4)', () => {
  it('保存済みの明示選択を最優先する', () => {
    expect(
      detectLocale({ stored: 'en', search: '?lang=ja', navigatorLanguage: 'ja-JP' }),
    ).toBe('en');
  });

  it('保存がなければ URL クエリを使う', () => {
    expect(detectLocale({ stored: null, search: '?lang=en', navigatorLanguage: 'ja-JP' })).toBe('en');
  });

  it('不正な stored / lang は無視する', () => {
    expect(detectLocale({ stored: 'xx', search: '?lang=zz', navigatorLanguage: 'ja' })).toBe('ja');
  });

  it('navigator.language が ja 系なら ja', () => {
    expect(detectLocale({ stored: null, search: '', navigatorLanguage: 'ja' })).toBe('ja');
  });

  it('ja 以外の navigator.language なら en', () => {
    expect(detectLocale({ stored: null, search: '', navigatorLanguage: 'fr-FR' })).toBe('en');
  });

  it('手がかりが何もなければ既定の ja', () => {
    expect(detectLocale({ stored: null, search: null, navigatorLanguage: null })).toBe('ja');
  });
});
