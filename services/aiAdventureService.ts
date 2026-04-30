import {
  AdventureResult,
  AdventureType,
  ItemRarity,
  ItemType,
  PlayerStats,
} from '../types';
import { REALM_ORDER } from '../constants/index';
import { getAIConfig, validateAIConfig } from '../config/aiConfig';
import { getAllItemsFromConstants } from '../utils/itemConstantsUtils';
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

type AiItemRequest = {
  type?: string;
  rarity?: string;
  nameHint?: string;
};

type AiAdventurePayload = Partial<AdventureResult> & {
  itemRequest?: AiItemRequest;
  itemType?: string;
  itemRarity?: string;
  itemNameHint?: string;
};

type NumericRange = {
  min: number;
  max: number;
};

type AdventureBounds = {
  hpChange: NumericRange;
  expChange: NumericRange;
  spiritStonesChange: NumericRange;
  lotteryTicketsChange: NumericRange;
  reputationChange: NumericRange;
  itemChance: number;
  allowedItemTypes: string[];
  allowedRarities: ItemRarity[];
  designNotes: string[];
};

const EVENT_COLORS: AdventureResult['eventColor'][] = [
  'normal',
  'gain',
  'danger',
  'special',
];

const ITEM_TYPES = Object.values(ItemType) as string[];
const ITEM_RARITIES: ItemRarity[] = ['普通', '稀有', '传说', '仙品'];

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

function pickEventColor(
  value: unknown,
  hpChange: number,
  expChange: number,
  spiritStonesChange: number
): AdventureResult['eventColor'] {
  if (EVENT_COLORS.includes(value as AdventureResult['eventColor'])) {
    return value as AdventureResult['eventColor'];
  }

  if (hpChange < 0) return 'danger';
  if (expChange > 0 || spiritStonesChange > 0) return 'gain';
  return 'normal';
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

function getRealmMultiplier(player: PlayerStats): number {
  const realmIndex = Math.max(0, REALM_ORDER.indexOf(player.realm));
  const realmBaseMultipliers = [1, 2, 4, 8, 16, 32, 64];
  const realmBaseMultiplier = realmBaseMultipliers[realmIndex] || 1;
  const levelMultiplier = 1 + (player.realmLevel - 1) * 0.3;
  return realmBaseMultiplier * levelMultiplier;
}

function buildAdventureBounds(
  player: PlayerStats,
  adventureType: AdventureType,
  riskLevel?: string
): AdventureBounds {
  const totalStats = getPlayerTotalStats(player);
  const realmIndex = Math.max(0, REALM_ORDER.indexOf(player.realm));
  const realmMultiplier = getRealmMultiplier(player);

  let expBase: [number, number] = [18, 85];
  let stoneBase: [number, number] = [0, 95];
  let hpLossRatio = 0.18;
  let hpGainRatio = 0.12;
  let itemChance = 0.35;
  const designNotes = [
    '数值要服务长期养成，不能为了戏剧性突然暴涨或暴跌。',
    '危险事件可以扣血，但应该给出对应修为或灵石补偿。',
    '普通历练偏日常，lucky 偏机缘，secret_realm 偏高风险高收益。',
  ];

  if (adventureType === 'lucky') {
    expBase = [160, 520];
    stoneBase = [120, 420];
    hpLossRatio = 0.10;
    hpGainRatio = 0.18;
    itemChance = 0.75;
    designNotes.push('大机缘应该明显优于普通历练，但不能直接跨境界。');
  } else if (adventureType === 'secret_realm') {
    expBase = [90, 420];
    stoneBase = [100, 650];
    hpLossRatio =
      riskLevel === '极度危险' ? 0.45 : riskLevel === '高' ? 0.34 : 0.24;
    hpGainRatio = 0.08;
    itemChance = 0.65;
    designNotes.push('秘境事件允许更强烈的危险感，收益也应该更高。');
  } else if (adventureType === 'sect_challenge') {
    expBase = [55, 180];
    stoneBase = [80, 260];
    hpLossRatio = 0.25;
    hpGainRatio = 0.06;
    itemChance = 0.4;
    designNotes.push('宗门事件要体现任务、声望、贡献感。');
  } else if (adventureType === 'dao_combining_challenge') {
    expBase = [0, 0];
    stoneBase = [0, 0];
    hpLossRatio = 0;
    hpGainRatio = 0;
    itemChance = 0;
    designNotes.push('天地之魄挑战只负责铺垫，不直接发放普通奖励。');
  }

  const maxHpLoss = Math.max(8, Math.floor(totalStats.maxHp * hpLossRatio));
  const maxHpGain = Math.max(0, Math.floor(totalStats.maxHp * hpGainRatio));
  const allowedRarityCount = Math.min(
    ITEM_RARITIES.length,
    adventureType === 'lucky' || adventureType === 'secret_realm'
      ? realmIndex + 3
      : realmIndex + 2
  );

  return {
    hpChange: {
      min: -maxHpLoss,
      max: maxHpGain,
    },
    expChange: {
      min: Math.floor(expBase[0] * realmMultiplier),
      max: Math.floor(expBase[1] * realmMultiplier),
    },
    spiritStonesChange: {
      min: Math.floor(stoneBase[0] * realmMultiplier),
      max: Math.floor(stoneBase[1] * realmMultiplier),
    },
    lotteryTicketsChange: {
      min: 0,
      max: adventureType === 'lucky' ? 5 : 2,
    },
    reputationChange: {
      min: adventureType === 'sect_challenge' ? -20 : -10,
      max: adventureType === 'sect_challenge' ? 35 : 20,
    },
    itemChance,
    allowedItemTypes: [
      ItemType.Herb,
      ItemType.Pill,
      ItemType.Material,
      ItemType.Weapon,
      ItemType.Armor,
      ItemType.Accessory,
      ItemType.Ring,
      ItemType.Artifact,
      ...(adventureType === 'lucky' || adventureType === 'secret_realm'
        ? [ItemType.AdvancedItem]
        : []),
    ],
    allowedRarities: ITEM_RARITIES.slice(0, Math.max(1, allowedRarityCount)),
    designNotes,
  };
}

function normalizeItemType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return ITEM_TYPES.find(type => type === value || value.includes(type));
}

function normalizeRarity(
  value: unknown,
  allowedRarities: ItemRarity[]
): ItemRarity {
  if (typeof value === 'string') {
    const exact = ITEM_RARITIES.find(rarity => rarity === value);
    if (exact && allowedRarities.includes(exact)) return exact;
  }
  return allowedRarities[allowedRarities.length - 1] || '普通';
}

function pickConstantItem(
  payload: AiAdventurePayload,
  bounds: AdventureBounds
): AdventureResult['itemObtained'] | undefined {
  const request = payload.itemRequest || {};
  const requestedType = normalizeItemType(request.type || payload.itemType);
  const requestedRarity = normalizeRarity(
    request.rarity || payload.itemRarity,
    bounds.allowedRarities
  );
  const nameHint = (request.nameHint || payload.itemNameHint || '').trim();

  if (!requestedType || !bounds.allowedItemTypes.includes(requestedType)) {
    return undefined;
  }

  if (Math.random() > bounds.itemChance) {
    return undefined;
  }

  const allItems = getAllItemsFromConstants();
  let candidates = allItems.filter(
    item => item.type === requestedType && item.rarity === requestedRarity
  );

  if (nameHint) {
    const hinted = candidates.filter(
      item => item.name.includes(nameHint) || nameHint.includes(item.name)
    );
    if (hinted.length > 0) candidates = hinted;
  }

  if (candidates.length === 0) {
    candidates = allItems.filter(item => item.type === requestedType);
  }

  if (candidates.length === 0) return undefined;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    name: selected.name,
    type: selected.type,
    description: selected.description,
    rarity: selected.rarity,
    effect: selected.effect,
    permanentEffect: selected.permanentEffect,
    isEquippable: selected.isEquippable,
    equipmentSlot: selected.equipmentSlot,
    advancedItemType: selected.advancedItemType,
    advancedItemId: selected.advancedItemId,
  };
}

function sanitizeAIResult(
  raw: unknown,
  adventureType: AdventureType,
  player: PlayerStats,
  bounds: AdventureBounds
): AdventureResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as AiAdventurePayload;
  const story = typeof data.story === 'string' ? data.story.trim() : '';
  if (story.length < 12) return null;

  const hpChange = clampNumber(
    data.hpChange,
    bounds.hpChange.min,
    bounds.hpChange.max,
    0
  );
  const expChange = clampNumber(
    data.expChange,
    bounds.expChange.min,
    bounds.expChange.max,
    bounds.expChange.min
  );
  const spiritStonesChange = clampNumber(
    data.spiritStonesChange,
    bounds.spiritStonesChange.min,
    bounds.spiritStonesChange.max,
    bounds.spiritStonesChange.min
  );
  const lotteryTicketsChange = clampNumber(
    data.lotteryTicketsChange,
    bounds.lotteryTicketsChange.min,
    bounds.lotteryTicketsChange.max,
    0
  );
  const reputationChange = clampNumber(
    data.reputationChange,
    bounds.reputationChange.min,
    bounds.reputationChange.max,
    0
  );

  return {
    story: story.slice(0, 320),
    hpChange,
    expChange,
    spiritStonesChange,
    lotteryTicketsChange: lotteryTicketsChange || undefined,
    reputationChange: reputationChange || undefined,
    triggerSecretRealm:
      adventureType !== 'secret_realm' && data.triggerSecretRealm === true,
    eventColor: pickEventColor(
      data.eventColor,
      hpChange,
      expChange,
      spiritStonesChange
    ),
    adventureType,
    itemObtained: pickConstantItem(data, bounds),
  };
}

function buildPrompt(
  player: PlayerStats,
  adventureType: AdventureType,
  bounds: AdventureBounds,
  riskLevel?: string
): AiChatMessage[] {
  const totalStats = getPlayerTotalStats(player);

  return [
    {
      role: 'system',
      content:
        '你是修仙文字游戏的 AI 事件设计器和轻量数值策划。你要高度参与事件设计，但必须服从给定数值边界。只返回一个严格 JSON 对象，不要 Markdown，不要解释。字段包括 story, hpChange, expChange, spiritStonesChange, eventColor。可选字段包括 lotteryTicketsChange, reputationChange, triggerSecretRealm, itemRequest。eventColor 只能是 normal/gain/danger/special。itemRequest 只能包含 type, rarity, nameHint，type 和 rarity 必须从允许列表中选择。不要编造最终物品属性，物品会由本地真实物品池分配。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        request:
          '生成一次修仙历练事件。你可以决定事件创意、危险程度、奖励倾向和想要的掉落类型，但所有数字必须在 bounds 范围内。',
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
        bounds,
        outputShape: {
          story: '80到220字，体现玩家境界、场景、选择或代价',
          hpChange: 'number，必须在 bounds.hpChange 内',
          expChange: 'number，必须在 bounds.expChange 内',
          spiritStonesChange:
            'number，必须在 bounds.spiritStonesChange 内',
          eventColor: 'normal | gain | danger | special',
          lotteryTicketsChange: '可选 number',
          reputationChange: '可选 number',
          triggerSecretRealm: '可选 boolean',
          itemRequest: {
            type: bounds.allowedItemTypes.join(' | '),
            rarity: bounds.allowedRarities.join(' | '),
            nameHint: '可选，简短物品意向，不要编造属性',
          },
        },
        example: {
          story:
            '你在雾锁山涧中发现一处半毁的聚灵阵，阵心仍有灵光流转。你以神识推演阵纹，强行补上三处断点，灵气倒灌经脉，虽受轻伤，却从残阵余韵中悟出一丝运转法门。',
          hpChange: -12,
          expChange: bounds.expChange.min,
          spiritStonesChange: bounds.spiritStonesChange.min,
          eventColor: 'danger',
          itemRequest: {
            type: ItemType.Material,
            rarity: bounds.allowedRarities[0],
            nameHint: '阵法材料',
          },
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

  const bounds = buildAdventureBounds(player, adventureType, riskLevel);
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
      messages: buildPrompt(player, adventureType, bounds, riskLevel),
      temperature: 0.9,
      max_tokens: 760,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = (await response.json()) as AiChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  return sanitizeAIResult(
    extractJsonObject(content),
    adventureType,
    player,
    bounds
  );
}
