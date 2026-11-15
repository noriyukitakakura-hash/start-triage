import type { Messages } from './types';

/**
 * 英語リソース。`Messages` 型により `ja.ts` と同一のキー集合であることを強制される。
 * 用語は docs/I18N.md §8 の対訳表に従う。
 */
export const en: Messages = {
  'app.title': 'START Triage Trainer',
  'app.tagline': 'Drill primary triage for mass casualty incidents',

  'nav.home': 'Home',
  'nav.practice': 'Practice',
  'nav.challenge': '10-Case Challenge',
  'nav.reference': 'START Reference',
  'nav.settings': 'Settings',

  'locale.label': 'Language',
  'locale.ja': '日本語',
  'locale.en': 'English',

  'disclaimer.training':
    'This app is a training simulation. In a real incident, follow the protocol and instructions of your own organization.',
  'disclaimer.criteria':
    'Judgements use the START criteria standardized by the Japan Fire and Disaster Management Agency (respiratory rate ≤9 or ≥30 /min indicates Immediate). These thresholds differ from the original US START protocol (>30 /min only).',

  'category.I.roman': 'I',
  'category.I.short': 'Immediate',
  'category.I.name': 'Immediate (Category I)',
  'category.I.color': 'Red',
  'category.II.roman': 'II',
  'category.II.short': 'Delayed',
  'category.II.name': 'Delayed (Category II)',
  'category.II.color': 'Yellow',
  'category.III.roman': 'III',
  'category.III.short': 'Minor',
  'category.III.name': 'Minor (Category III)',
  'category.III.color': 'Green',
  'category.0.roman': '0',
  'category.0.short': 'Deceased',
  'category.0.name': 'Deceased (Category 0)',
  'category.0.color': 'Black',

  'dev.scaffoldReady': 'P0 scaffold is ready. Current language: {locale}',
};
