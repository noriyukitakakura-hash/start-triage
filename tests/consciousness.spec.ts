import { describe, expect, it } from 'vitest';
import {
  VOICE_PROMPTS,
  confirmsObedience,
  hasConfirmedObedience,
  responseKeyFor,
  responseKindOf,
  showsObedience,
  type VoicePrompt,
} from '@/domain/consciousness';
import { VALID_COMBINATIONS, generateCase } from '@/domain/generator';
import { createRng } from '@/domain/rng';
import { NON_OBEYING_RESPONSES, type NonObeyingResponse, type TriageCase } from '@/domain/types';

const BASE: TriageCase = {
  id: 'voice-test',
  patient: { illustrationId: 'supine-still', situationKey: 'situation.lyingStill' },
  canWalk: false,
  hasSpontaneousBreathing: true,
  breathingAfterAirway: null,
  respiratoryRate: 18,
  radialPulsePalpable: true,
  pulseRate: 88,
  crtSeconds: 1.2,
  obeysCommands: true,
  nonObeyingResponse: null,
};

const obeying = (): TriageCase => ({ ...BASE, obeysCommands: true, nonObeyingResponse: null });
const notObeying = (response: NonObeyingResponse): TriageCase => ({
  ...BASE,
  obeysCommands: false,
  nonObeyingResponse: response,
});

describe('confirmsObedience: 声のかけ方にも適否がある', () => {
  it('呼名では従命を確認できない', () => {
    expect(confirmsObedience('callName')).toBe(false);
  });

  it('開眼・握手は従命を確認できる', () => {
    expect(confirmsObedience('openEyes')).toBe(true);
    expect(confirmsObedience('squeezeHand')).toBe(true);
  });

  it('従命を確認できる声かけが2種類ある（片方しか無いと選択の訓練にならない）', () => {
    expect(VOICE_PROMPTS.filter(confirmsObedience)).toHaveLength(2);
  });
});

describe('responseKindOf', () => {
  it('従命できる症例は obeys', () => {
    expect(responseKindOf(obeying())).toBe('obeys');
  });

  it('従命できない症例は持っている反応の種別を返す', () => {
    for (const response of NON_OBEYING_RESPONSES) {
      expect(responseKindOf(notObeying(response))).toBe(response);
    }
  });
});

describe('responseKeyFor: すべての組み合わせに反応がある', () => {
  it('従命できる症例 × 全声かけで必ずキーが返る', () => {
    for (const prompt of VOICE_PROMPTS) {
      expect(responseKeyFor(obeying(), prompt)).toMatch(/^voice\.response\./);
    }
  });

  it('従命できない症例 × 全声かけで必ずキーが返る', () => {
    for (const response of NON_OBEYING_RESPONSES) {
      for (const prompt of VOICE_PROMPTS) {
        expect(responseKeyFor(notObeying(response), prompt)).toMatch(/^voice\.response\./);
      }
    }
  });

  it('無反応は声かけによらず同じ', () => {
    const keys = VOICE_PROMPTS.map((p) => responseKeyFor(notObeying('none'), p));
    expect(new Set(keys).size).toBe(1);
  });

  it('声かけごとに異なる反応を返す（声のみ・体動は呼びかけで変わる）', () => {
    for (const response of ['voiceOnly', 'movementOnly'] as const) {
      const keys = VOICE_PROMPTS.map((p) => responseKeyFor(notObeying(response), p));
      expect(new Set(keys).size).toBeGreaterThan(1);
    }
  });

  it('生成したあらゆる症例でキーが決まる', () => {
    const rng = createRng('voice-coverage');
    for (let i = 0; i < 2000; i++) {
      const combo = VALID_COMBINATIONS[i % VALID_COMBINATIONS.length];
      if (combo === undefined) continue;
      const c = generateCase({ target: combo.target, decidingStep: combo.decidingStep }, rng).case;
      for (const prompt of VOICE_PROMPTS) {
        expect(responseKeyFor(c, prompt), `${combo.target}/${prompt}`).toBeTruthy();
      }
    }
  });
});

describe('showsObedience: 反応があることと従命は違う', () => {
  it('従命できる症例でも、呼名への反応は従命を示さない', () => {
    expect(showsObedience(obeying(), 'callName')).toBe(false);
    expect(showsObedience(obeying(), 'openEyes')).toBe(true);
    expect(showsObedience(obeying(), 'squeezeHand')).toBe(true);
  });

  it('従命できない症例は、どの声かけでも従命を示さない', () => {
    for (const response of NON_OBEYING_RESPONSES) {
      for (const prompt of VOICE_PROMPTS) {
        expect(showsObedience(notObeying(response), prompt), `${response}/${prompt}`).toBe(false);
      }
    }
  });

  it('声を出す症例も、払いのける症例も従命ではない（いずれも I類）', () => {
    // 反応はあるが従命ではない、という取り違えの核心
    expect(showsObedience(notObeying('voiceOnly'), 'squeezeHand')).toBe(false);
    expect(showsObedience(notObeying('movementOnly'), 'squeezeHand')).toBe(false);
  });
});

describe('hasConfirmedObedience: 利用者が従命を確かめたか', () => {
  it('呼名しかしていなければ確かめていない', () => {
    expect(hasConfirmedObedience(['callName'])).toBe(false);
    expect(hasConfirmedObedience([])).toBe(false);
  });

  it('従命確認の声かけを含めば確かめている', () => {
    expect(hasConfirmedObedience(['callName', 'openEyes'])).toBe(true);
    expect(hasConfirmedObedience(['squeezeHand'])).toBe(true);
  });
});

describe('ドメイン層が表示文字列を持たない（docs/I18N.md §5）', () => {
  it('返るのは翻訳キーであって文章ではない', () => {
    const prompts: VoicePrompt[] = [...VOICE_PROMPTS];
    for (const response of NON_OBEYING_RESPONSES) {
      for (const prompt of prompts) {
        const key = responseKeyFor(notObeying(response), prompt);
        expect(key).toMatch(/^voice\.response\.[A-Za-z.]+$/);
        expect(key).not.toMatch(/[぀-ヿ一-龯]/);
      }
    }
  });
});
