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

function sanitizeStory(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as { story?: unknown };
  if (typeof data.story !== 'string') return null;
  const story = data.story.trim();
  if (story.length < 12) return null;
  return story.slice(0, 360);
}

function buildPrompt(
  player: PlayerStats,
  result: AdventureResult,
  adventureType: AdventureType,
  riskLevel?: string
): AiChatMessage[] {
  const totalStats = getPlayerTotalStats(player);

  return [
    {
      role: 'system',
      content:
        '你是修仙文字游戏的文案润色器。你只能润色 story，不能改变任何数值、奖励、物品、事件类型、战斗结果或进阶结果。只返回严格 JSON：{"story":"润色后的故事"}。不要 Markdown，不要解释。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task:
          '在不改变事实的前提下润色历练故事。必须保留原事件含义、胜负、风险、物品线索和代价。不要新增未发生的奖励。',
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
        },
        lockedResult: {
          story: result.story,
          hpChange: result.hpChange,
          expChange: result.expChange,
          spiritStonesChange: result.spiritStonesChange,
          eventColor: result.eventColor,
          adventureType: result.adventureType || adventureType,
          itemObtained: result.itemObtained
            ? {
                name: result.itemObtained.name,
                type: result.itemObtained.type,
                rarity: result.itemObtained.rarity,
                advancedItemType: result.itemObtained.advancedItemType,
              }
            : null,
          petObtained: result.petObtained || null,
          triggerSecretRealm: result.triggerSecretRealm || false,
          heavenEarthSoulEncounter: result.heavenEarthSoulEncounter || null,
          longevityRuleObtained: result.longevityRuleObtained || null,
        },
      }),
    },
  ];
}

export async function polishAIAdventureStory(
  result: AdventureResult,
  player: PlayerStats,
  adventureType: AdventureType,
  riskLevel?: string
): Promise<AdventureResult> {
  const config = getAIConfig();
  const validation = validateAIConfig(config);
  if (!validation.valid || !config.apiUrl || !config.model || !result.story) {
    return result;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: buildPrompt(player, result, adventureType, riskLevel),
      temperature: 0.75,
      max_tokens: 480,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI story polish failed: ${response.status}`);
  }

  const data = (await response.json()) as AiChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return result;

  const story = sanitizeStory(extractJsonObject(content));
  return story ? { ...result, story } : result;
}
