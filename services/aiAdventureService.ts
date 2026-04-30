import { AdventureResult, AdventureType, PlayerStats } from '../types';
import { getAIConfig, validateAIConfig } from '../config/aiConfig';
import { getPlayerTotalStats } from '../utils/statUtils';

type AiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const EVENT_COLORS: AdventureResult['eventColor'][] = [
  'normal',
  'gain',
  'danger',
  'special',
];

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback = 0
): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(numberValue)));
}

function pickEventColor(value: unknown): AdventureResult['eventColor'] {
  return EVENT_COLORS.includes(value as AdventureResult['eventColor'])
    ? (value as AdventureResult['eventColor'])
    : 'normal';
}

function extractJsonObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sanitizeAIResult(
  raw: unknown,
  adventureType: AdventureType,
  player: PlayerStats
): AdventureResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<AdventureResult>;
  const story = typeof data.story === 'string' ? data.story.trim() : '';
  if (story.length < 8) return null;

  const totalStats = getPlayerTotalStats(player);
  const realmFactor = Math.max(1, player.realmLevel);
  const maxHpLoss = Math.max(10, Math.floor(totalStats.maxHp * 0.35));

  return {
    story: story.slice(0, 220),
    hpChange: clampNumber(data.hpChange, -maxHpLoss, maxHpLoss, 0),
    expChange: clampNumber(data.expChange, 0, 120 * realmFactor, 20),
    spiritStonesChange: clampNumber(
      data.spiritStonesChange,
      0,
      220 * realmFactor,
      0
    ),
    lotteryTicketsChange:
      clampNumber(data.lotteryTicketsChange, 0, 3, 0) || undefined,
    reputationChange:
      clampNumber(data.reputationChange, -20, 30, 0) || undefined,
    triggerSecretRealm: data.triggerSecretRealm === true,
    eventColor: pickEventColor(data.eventColor),
    adventureType,
  };
}

function buildPrompt(
  player: PlayerStats,
  adventureType: AdventureType,
  riskLevel?: string
): AiChatMessage[] {
  const totalStats = getPlayerTotalStats(player);

  return [
    {
      role: 'system',
      content:
        '你是一个修仙文字游戏事件生成器。只返回一个严格 JSON 对象，不要 Markdown，不要解释。字段必须是：story, hpChange, expChange, spiritStonesChange, eventColor。可选字段：lotteryTicketsChange, reputationChange, triggerSecretRealm。eventColor 只能是 normal/gain/danger/special。数值要克制，不能破坏游戏平衡。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        request: '生成一次修仙历练事件',
        adventureType,
        riskLevel: riskLevel || null,
        player: {
          name: player.name,
          realm: player.realm,
          realmLevel: player.realmLevel,
          hp: player.hp,
          maxHp: totalStats.maxHp,
          attack: totalStats.attack,
          defense: totalStats.defense,
          spirit: totalStats.spirit,
          physique: totalStats.physique,
          speed: totalStats.speed,
          luck: player.luck,
          spiritStones: player.spiritStones,
        },
        outputExample: {
          story: '你在山谷中发现一处残破阵法，谨慎参悟后略有所得。',
          hpChange: -5,
          expChange: 35,
          spiritStonesChange: 12,
          eventColor: 'normal',
        },
      }),
    },
  ];
}

export async function generateAIAdventureResult(
  player: PlayerStats,
  adventureType: AdventureType,
  riskLevel?: string
): Promise<AdventureResult | null> {
  const config = getAIConfig();
  const validation = validateAIConfig(config);
  if (!validation.valid || !config.apiUrl || !config.model) return null;

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildPrompt(player, adventureType, riskLevel),
      temperature: 0.85,
      max_tokens: 360,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = (await response.json()) as AiChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  return sanitizeAIResult(extractJsonObject(content), adventureType, player);
}
