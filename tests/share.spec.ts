import { describe, expect, it } from 'vitest';
import { buildShareUrl, shareModeKey, type SharePayload } from '@/lib/share';

const BASE: SharePayload = {
  text: 'START法トリアージ 10問チャレンジ 全問正解！\nタイム 1分23.45秒（実測モード）',
  hashtags: 'STARTトリアージ,災害医療,トリアージ訓練',
  locale: 'ja',
  origin: 'https://triage-start.pages.dev',
};

describe('buildShareUrl', () => {
  it('X の Web Intent を指す', () => {
    const url = new URL(buildShareUrl(BASE));
    expect(url.origin).toBe('https://x.com');
    expect(url.pathname).toBe('/intent/post');
  });

  it('本文を改行ごとエンコードして渡す', () => {
    const url = new URL(buildShareUrl(BASE));
    expect(url.searchParams.get('text')).toBe(BASE.text);
    // 生の改行がクエリに混入しない
    expect(buildShareUrl(BASE)).not.toContain('\n');
  });

  it('投稿URLに言語を付ける（投稿者と同じ言語で開ける）', () => {
    expect(new URL(buildShareUrl(BASE)).searchParams.get('url')).toBe(
      'https://triage-start.pages.dev/?lang=ja',
    );
    expect(new URL(buildShareUrl({ ...BASE, locale: 'en' })).searchParams.get('url')).toBe(
      'https://triage-start.pages.dev/?lang=en',
    );
  });

  it('ハッシュタグをそのまま渡す（# は付けない）', () => {
    expect(new URL(buildShareUrl(BASE)).searchParams.get('hashtags')).toBe(BASE.hashtags);
    expect(new URL(buildShareUrl(BASE)).searchParams.get('hashtags')).not.toContain('#');
  });

  it('日本語とハッシュタグが安全にエンコードされる', () => {
    const raw = buildShareUrl(BASE);
    expect(raw).not.toContain('全問正解');
    // エンコードを戻せば元に戻る
    expect(new URL(raw).searchParams.get('text')).toContain('全問正解');
  });

  it('オリジンが変わっても正しいURLを作る（ローカル・本番の双方）', () => {
    for (const origin of ['http://localhost:4173', 'https://start.keiku-labo.space']) {
      expect(new URL(buildShareUrl({ ...BASE, origin })).searchParams.get('url')).toBe(
        `${origin}/?lang=ja`,
      );
    }
  });
});

describe('shareModeKey', () => {
  it('提示方式ごとのモード名キーを返す', () => {
    expect(shareModeKey('numeric')).toBe('share.mode.numeric');
    expect(shareModeKey('observed')).toBe('share.mode.observed');
  });
});
