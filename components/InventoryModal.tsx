import React, {
  useState,
  useMemo,
  useTransition,
  useCallback,
  memo,
} from 'react';
import Modal from './common/Modal';
import {
  Item,
  ItemType,
  ItemRarity,
  EquipmentSlot,
  RealmType,
} from '../types';
import {
  X,
  Package,
  ShieldCheck,
  Hammer,
  Trash2,
  Sparkles,
  ArrowUpDown,
  Trash,
  Zap,
  Search,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import { REALM_ORDER, SPIRITUAL_ROOT_NAMES, FOUNDATION_TREASURES, HEAVEN_EARTH_ESSENCES, HEAVEN_EARTH_MARROWS, LONGEVITY_RULES, CULTIVATION_ARTS } from '../constants/index';
import EquipmentPanel from './EquipmentPanel';
import BatchDiscardModal from './BatchDiscardModal';
import BatchUseModal from './BatchUseModal';
import {
  getRarityNameClasses,
  getRarityBorder,
  getRarityBadge,
  getRarityOrder,
  getRarityDisplayName,
  normalizeRarityValue,
} from '../utils/rarityUtils';
import { getItemStats, normalizeTypeLabel } from '../utils/itemUtils';
import {
  findEmptyEquipmentSlot,
  isItemEquipped as checkItemEquipped,
  findItemEquippedSlot,
  areSlotsInSameGroup,
  getEquipmentSlotsByType,
} from '../utils/equipmentUtils';
import { useDebounce } from '../hooks/useDebounce';
import { showConfirm } from '../utils/toastUtils';
import { formatValueChange, formatNumber } from '../utils/formatUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inventory: Item[];
  equippedItems: Partial<Record<EquipmentSlot, string>>;
  natalArtifactId?: string;
  playerRealm: string;
  foundationTreasure?: string;
  heavenEarthEssence?: string;
  heavenEarthMarrow?: string;
  longevityRules?: string[];
  maxLongevityRules?: number;
  onUseItem: (item: Item) => void;
  onEquipItem: (item: Item, slot: EquipmentSlot) => void;
  onUnequipItem: (slot: EquipmentSlot) => void;
  onUpgradeItem: (item: Item) => void;
  onDiscardItem: (item: Item) => void;
  onBatchDiscard: (itemIds: string[]) => void;
  onBatchUse?: (itemIds: string[]) => void;
  onOrganizeInventory?: () => void;
  onEquipBestSet?: () => void;
  onRefineNatalArtifact?: (item: Item) => void;
  onUnrefineNatalArtifact?: () => void;
  onRefineAdvancedItem?: (item: Item) => void;
  setItemActionLog?: (log: { text: string; type: string } | null) => void;
}

type ItemCategory = 'all' | 'equipment' | 'pill' | 'material' | 'herb' | 'synthesisStone' | 'recipe' | 'advancedItem';

// 物品项组件 - 使用 memo 优化性能
interface InventoryItemProps {
  item: Item;
  isNatal: boolean;
  canRefine: boolean;
  isEquipped: boolean;
  playerRealm: string;
  foundationTreasure?: string;
  heavenEarthEssence?: string;
  heavenEarthMarrow?: string;
  longevityRules?: string[];
  maxLongevityRules?: number;
  onHover: (item: Item | null) => void;
  onUseItem: (item: Item) => void;
  onEquipItem: (item: Item) => void;
  onUnequipItem: (item: Item) => void;
  onUpgradeItem: (item: Item) => void;
  onDiscardItem: (item: Item) => void;
  onRefineNatalArtifact?: (item: Item) => void;
  onUnrefineNatalArtifact?: () => void;
  onRefineAdvancedItem?: (item: Item) => void;
  setItemActionLog?: (log: { text: string; type: string } | null) => void;
}

const InventoryItem = memo<InventoryItemProps>(
  ({
    item,
    isNatal,
    canRefine,
    isEquipped,
    playerRealm,
    foundationTreasure,
    heavenEarthEssence,
    heavenEarthMarrow,
    longevityRules,
    maxLongevityRules,
    onHover,
    onUseItem,
    onEquipItem,
    onUnequipItem,
    onUpgradeItem,
    onDiscardItem,
    onRefineNatalArtifact,
    onUnrefineNatalArtifact,
    onRefineAdvancedItem,
    setItemActionLog,
  }) => {
    // 使用统一的工具函数计算物品统计
    const stats = getItemStats(item, isNatal);
    const rarity = normalizeRarityValue(item.rarity);
    const rarityLabel = getRarityDisplayName(rarity);
    const typeLabel = normalizeTypeLabel(item.type, item);
    const showLevel =
      typeof item.level === 'number' && Number.isFinite(item.level) && item.level > 0;
    const reviveChances =
      typeof item.reviveChances === 'number' && Number.isFinite(item.reviveChances)
        ? item.reviveChances
        : undefined;

    return (
      <div
        className={`p-3 rounded border flex flex-col justify-between relative transition-colors ${isEquipped ? 'bg-ink-800 border-mystic-gold shadow-md' : `bg-ink-800 hover:bg-ink-700 ${getRarityBorder(rarity)}`}`}
        onMouseEnter={() => onHover(item)}
        onMouseLeave={() => onHover(null)}
      >
        {isEquipped && (
          <div className="absolute top-2 right-2 text-mystic-gold bg-mystic-gold/10 px-2 py-0.5 rounded text-xs border border-mystic-gold/30 flex items-center gap-1">
            <ShieldCheck size={12} /> 已装备
          </div>
        )}

        <div>
          <div className="flex justify-between items-start pr-16 mb-1">
            <h4 className={getRarityNameClasses(rarity)}>
              {item.name}{' '}
              {showLevel && (
                <span className="text-stone-500 text-xs font-normal ml-1">
                  + {item.level}
                </span>
              )}
            </h4>
            <span className="text-xs bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded shrink-0 h-fit">
              x{item.quantity}
            </span>
          </div>

          <div className="flex gap-2 mb-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border ${getRarityBadge(rarity)}`}
            >
              {rarityLabel}
            </span>
            <span className="text-xs text-stone-500 py-0.5">{typeLabel}</span>
          </div>

          <p className="text-xs text-stone-500 italic mb-3">
            {item.description}
          </p>

          {/* 进阶物品效果显示 */}
          {item.type === ItemType.AdvancedItem && item.advancedItemType && item.advancedItemId && (() => {
            let advancedItemData: any = null;
            if (item.advancedItemType === 'foundationTreasure') {
              advancedItemData = FOUNDATION_TREASURES[item.advancedItemId];
            } else if (item.advancedItemType === 'heavenEarthEssence') {
              advancedItemData = HEAVEN_EARTH_ESSENCES[item.advancedItemId];
            } else if (item.advancedItemType === 'heavenEarthMarrow') {
              advancedItemData = HEAVEN_EARTH_MARROWS[item.advancedItemId];
            } else if (item.advancedItemType === 'longevityRule') {
              advancedItemData = LONGEVITY_RULES[item.advancedItemId];
            } else if (item.advancedItemType === 'soulArt') {
              advancedItemData = CULTIVATION_ARTS.find(art => art.id === item.advancedItemId);
            }

            if (advancedItemData && advancedItemData.effects) {
              const effects = advancedItemData.effects;
              const effectEntries: string[] = [];

              if (effects.hpBonus) effectEntries.push(`血+${effects.hpBonus}`);
              if (effects.attackBonus) effectEntries.push(`攻+${effects.attackBonus}`);
              if (effects.defenseBonus) effectEntries.push(`防+${effects.defenseBonus}`);
              if (effects.spiritBonus) effectEntries.push(`神识+${effects.spiritBonus}`);
              if (effects.physiqueBonus) effectEntries.push(`体魄+${effects.physiqueBonus}`);
              if (effects.speedBonus) effectEntries.push(`速度+${effects.speedBonus}`);

              // 支持功法格式
              if (effects.hp) effectEntries.push(`血+${effects.hp}`);
              if (effects.attack) effectEntries.push(`攻+${effects.attack}`);
              if (effects.defense) effectEntries.push(`防+${effects.defense}`);
              if (effects.spirit) effectEntries.push(`神识+${effects.spirit}`);
              if (effects.physique) effectEntries.push(`体魄+${effects.physique}`);
              if (effects.speed) effectEntries.push(`速度+${effects.speed}`);

              // 支持百分比格式 (规则之力)
              if (effects.hpPercent) effectEntries.push(`血+${Math.round(effects.hpPercent * 100)}%`);
              if (effects.attackPercent) effectEntries.push(`攻+${Math.round(effects.attackPercent * 100)}%`);
              if (effects.defensePercent) effectEntries.push(`防+${Math.round(effects.defensePercent * 100)}%`);
              if (effects.spiritPercent) effectEntries.push(`神识+${Math.round(effects.spiritPercent * 100)}%`);
              if (effects.physiquePercent) effectEntries.push(`体魄+${Math.round(effects.physiquePercent * 100)}%`);
              if (effects.speedPercent) effectEntries.push(`速度+${Math.round(effects.speedPercent * 100)}%`);

              return (
                <div className="text-xs mb-3 space-y-1">
                  {effectEntries.length > 0 && (
                    <div className="text-stone-400 grid grid-cols-2 gap-1">
                      {effectEntries.map((entry, idx) => (
                        <span key={idx}>{entry}</span>
                      ))}
                    </div>
                  )}
                  {effects.specialEffect && (
                    <div className="text-emerald-400 italic mt-1">
                      ✨ {effects.specialEffect}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {/* 材料用途说明 */}
          {item.type === ItemType.Material && (
            <div className="text-xs text-blue-400 mb-2 p-2 bg-blue-900/20 rounded border border-blue-800/50">
              <div className="font-bold mb-1">💡 用途说明：</div>
              <div className="space-y-0.5 text-blue-300">
                {item.name.includes('材料包') ? (
                  <div>• 使用后可获得对应品级的丹药材料</div>
                ) : item.name === '宗门宝库钥匙' ? (
                  <div>• 使用后可打开宗门宝库，选择一件物品带走</div>
                ) : null}
                {item.name.includes('炼器') || item.name.includes('石') || item.name.includes('铁') || item.name.includes('矿') ? (
                  <div>• 可用于强化法宝和装备</div>
                ) : null}
                {item.name.includes('草') || item.name.includes('花') || item.name.includes('参') || item.name.includes('芝') ? (
                  <div>• 可用于炼制丹药（查看丹方）</div>
                ) : null}
                {item.name.includes('内丹') || item.name.includes('妖丹') ? (
                  <div>• 可用于炼制丹药或喂养灵宠</div>
                ) : null}
                {item.name.includes('符') ? (
                  <div>• 可用于制作符箓或直接使用</div>
                ) : null}
                {!item.name.includes('材料包') && item.name !== '宗门宝库钥匙' && (
                  <div>• 可喂养灵宠获得经验</div>
                )}
                {!item.effect && !item.name.includes('材料包') && item.name !== '宗门宝库钥匙' && (
                  <div className="text-stone-400">• 此材料暂无直接使用效果</div>
                )}
              </div>
            </div>
          )}

          {isNatal && (
            <div className="text-xs text-mystic-gold mb-2 flex items-center gap-1">
              <Sparkles size={12} />
              <span className="font-bold">本命法宝（属性+50%）</span>
            </div>
          )}


          {reviveChances !== undefined && reviveChances > 0 && (
            <div className="text-xs text-yellow-400 mb-2 flex items-center gap-1 font-bold">
              💫 保命机会：{reviveChances}次
            </div>
          )}
          {reviveChances !== undefined && reviveChances <= 0 && (
            <div className="text-[11px] text-stone-500 mb-2 flex items-center gap-1">
              💫 保命机会：已耗尽
            </div>
          )}

          {(item.effect || item.permanentEffect) && (
            <div className="text-xs mb-2 space-y-1">
              {/* 临时效果 */}
              {item.effect && (
                <div className="text-stone-400 grid grid-cols-2 gap-1">
                  {stats.attack > 0 && <span>攻 +{stats.attack}</span>}
                  {stats.defense > 0 && <span>防 +{stats.defense}</span>}
                  {stats.hp > 0 && <span>血 +{stats.hp}</span>}
                  {item.effect.exp && item.effect.exp > 0 && <span>修 +{Math.floor(item.effect.exp)}</span>}
                  {stats.spirit > 0 && <span>神识 +{stats.spirit}</span>}
                  {stats.physique > 0 && <span>体魄 +{stats.physique}</span>}
                  {stats.speed > 0 && <span>速度 +{stats.speed}</span>}
                  {item.effect.lifespan && item.effect.lifespan > 0 && <span>寿 +{Math.floor(item.effect.lifespan)}</span>}
                </div>
              )}
              {/* 永久效果 */}
              {item.permanentEffect && (
                <div className="text-emerald-400 grid grid-cols-2 gap-1">
                  {item.permanentEffect.attack && item.permanentEffect.attack > 0 && (
                    <span>✨ 攻永久 +{item.permanentEffect.attack}</span>
                  )}
                  {item.permanentEffect.defense && item.permanentEffect.defense > 0 && (
                    <span>✨ 防永久 +{item.permanentEffect.defense}</span>
                  )}
                  {item.permanentEffect.maxHp && item.permanentEffect.maxHp > 0 && (
                    <span>✨ 气血上限永久 +{item.permanentEffect.maxHp}</span>
                  )}
                  {item.permanentEffect.spirit && item.permanentEffect.spirit > 0 && (
                    <span>✨ 神识永久 +{item.permanentEffect.spirit}</span>
                  )}
                  {item.permanentEffect.physique && item.permanentEffect.physique > 0 && (
                    <span>✨ 体魄永久 +{item.permanentEffect.physique}</span>
                  )}
                  {item.permanentEffect.speed && item.permanentEffect.speed > 0 && (
                    <span>✨ 速度永久 +{item.permanentEffect.speed}</span>
                  )}
                  {item.permanentEffect.maxLifespan && item.permanentEffect.maxLifespan > 0 && (
                    <span>✨ 寿命上限永久 +{item.permanentEffect.maxLifespan}</span>
                  )}
                  {/* 灵根效果 */}
                  {item.permanentEffect.spiritualRoots && (() => {
                    const roots = item.permanentEffect.spiritualRoots;
                    const rootEntries: string[] = [];

                    if (roots.metal && roots.metal > 0) {
                      rootEntries.push(`${SPIRITUAL_ROOT_NAMES.metal}灵根+${roots.metal}`);
                    }
                    if (roots.wood && roots.wood > 0) {
                      rootEntries.push(`${SPIRITUAL_ROOT_NAMES.wood}灵根+${roots.wood}`);
                    }
                    if (roots.water && roots.water > 0) {
                      rootEntries.push(`${SPIRITUAL_ROOT_NAMES.water}灵根+${roots.water}`);
                    }
                    if (roots.fire && roots.fire > 0) {
                      rootEntries.push(`${SPIRITUAL_ROOT_NAMES.fire}灵根+${roots.fire}`);
                    }
                    if (roots.earth && roots.earth > 0) {
                      rootEntries.push(`${SPIRITUAL_ROOT_NAMES.earth}灵根+${roots.earth}`);
                    }

                    // 如果所有灵根提升相同，合并显示
                    if (rootEntries.length > 0) {
                      const allSame = rootEntries.every(entry => {
                        const match = entry.match(/\+(\d+)$/);
                        return match && match[1] === rootEntries[0].match(/\+(\d+)$/)?.[1];
                      });

                      if (allSame && rootEntries.length === 5) {
                        const value = rootEntries[0].match(/\+(\d+)$/)?.[1] || '0';
                        return <span className="col-span-2">✨ 所有灵根永久 +{value}</span>;
                      } else {
                        return rootEntries.map((entry, idx) => (
                          <span key={idx}>✨ {entry}永久</span>
                        ));
                      }
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-1.5 flex-wrap">
          {item.isEquippable && item.equipmentSlot ? (
            <>
              {isEquipped ? (
                <button
                  onClick={() => onUnequipItem(item)}
                  className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs py-2 rounded transition-colors border border-stone-500"
                >
                  卸下
                </button>
              ) : (
                <button
                  onClick={() => onEquipItem(item)}
                  className="flex-1 bg-mystic-gold/20 hover:bg-mystic-gold/30 text-mystic-gold text-xs py-2 rounded transition-colors border border-mystic-gold/50"
                >
                  装备
                </button>
              )}
              {item.type === ItemType.Artifact && onRefineNatalArtifact && (() => {
                const isDisabled = !isNatal && !canRefine;

                return (
                  <button
                    onClick={() => {
                      if (isNatal && onUnrefineNatalArtifact) {
                        onUnrefineNatalArtifact();
                      } else if (!isNatal && canRefine) {
                        onRefineNatalArtifact(item);
                      }
                    }}
                    disabled={isDisabled}
                    className={`px-3 text-xs py-2 rounded transition-colors border ${
                      isNatal
                        ? 'bg-mystic-gold/20 hover:bg-mystic-gold/30 text-mystic-gold border-mystic-gold/50'
                        : isDisabled
                        ? 'bg-stone-800/50 text-stone-500 border-stone-700/50 cursor-not-allowed opacity-50'
                        : 'bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 border-purple-700/50'
                    }`}
                    title={
                      isNatal
                        ? '解除本命祭炼'
                        : isDisabled
                        ? '祭炼本命法宝需要达到金丹期境界'
                        : '祭炼为本命法宝'
                    }
                  >
                    <Sparkles size={14} />
                  </button>
                );
              })()}
              <button
                onClick={() => onUpgradeItem(item)}
                className="px-3 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs py-2 rounded transition-colors border border-stone-500"
                title="强化"
              >
                <Hammer size={14} />
              </button>
              <button
                onClick={() => onDiscardItem(item)}
                className="px-3 bg-red-900 hover:bg-red-800 text-red-200 text-xs py-2 rounded transition-colors border border-red-700"
                title="丢弃"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <>
              {(() => {
                // 判断物品是否可使用
                const isMaterialPack = item.name.includes('材料包') && item.type === ItemType.Material;
                const isTreasureVaultKey = item.name === '宗门宝库钥匙' && item.type === ItemType.Material;
                const hasEffect = item.effect || item.permanentEffect;
                const isRecipe = item.type === ItemType.Recipe;
                const isUsable = isMaterialPack || isTreasureVaultKey || (hasEffect && item.type !== ItemType.Material) || isRecipe;

                return isUsable ? (
                  <button
                    onClick={() => onUseItem(item)}
                    className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs py-2 rounded transition-colors"
                  >
                    {item.type === ItemType.Recipe ? '研读' : '使用'}
                  </button>
                ) : null;
              })()}
              {item.type === ItemType.AdvancedItem && item.advancedItemType && onRefineAdvancedItem && (() => {
                const currentRealmIndex = REALM_ORDER.indexOf(playerRealm as RealmType);
                let canRefineItem = false;
                let warningMessage = '';
                let requiredRealmName = '';

                if (item.advancedItemType === 'foundationTreasure') {
                  requiredRealmName = '炼气期';
                  canRefineItem = currentRealmIndex >= REALM_ORDER.indexOf(RealmType.QiRefining);
                  warningMessage = `炼化筑基奇物需要达到${requiredRealmName}境界\n当前境界：${playerRealm}`;
                } else if (item.advancedItemType === 'heavenEarthEssence') {
                  requiredRealmName = '金丹期';
                  canRefineItem = currentRealmIndex >= REALM_ORDER.indexOf(RealmType.GoldenCore);
                  warningMessage = `炼化天地精华需要达到${requiredRealmName}境界\n当前境界：${playerRealm}`;
                } else if (item.advancedItemType === 'heavenEarthMarrow') {
                  requiredRealmName = '元婴期';
                  canRefineItem = currentRealmIndex >= REALM_ORDER.indexOf(RealmType.NascentSoul);
                  warningMessage = `炼化天地之髓需要达到${requiredRealmName}境界\n当前境界：${playerRealm}`;
                } else if (item.advancedItemType === 'longevityRule') {
                  requiredRealmName = '合道期';
                  canRefineItem = currentRealmIndex >= REALM_ORDER.indexOf(RealmType.DaoCombining);
                  warningMessage = `炼化规则之力需要达到${requiredRealmName}境界\n当前境界：${playerRealm}`;
                }

                // 检查是否已经拥有
                let alreadyOwned = false;
                let alreadyOwnedMessage = '';
                if (item.advancedItemType === 'foundationTreasure' && foundationTreasure) {
                  alreadyOwned = true;
                  alreadyOwnedMessage = '你已经拥有筑基奇物，无法重复炼化';
                } else if (item.advancedItemType === 'heavenEarthEssence' && heavenEarthEssence) {
                  alreadyOwned = true;
                  alreadyOwnedMessage = '你已经拥有天地精华，无法重复炼化';
                } else if (item.advancedItemType === 'heavenEarthMarrow' && heavenEarthMarrow) {
                  alreadyOwned = true;
                  alreadyOwnedMessage = '你已经拥有天地之髓，无法重复炼化';
                } else if (item.advancedItemType === 'longevityRule' && item.advancedItemId) {
                  if ((longevityRules || []).includes(item.advancedItemId)) {
                    alreadyOwned = true;
                    alreadyOwnedMessage = '你已经拥有该规则之力，无法重复炼化';
                  } else {
                    // 检查是否达到最大数量
                    const maxRules = maxLongevityRules || 3;
                    if ((longevityRules || []).length >= maxRules) {
                      alreadyOwned = true;
                      alreadyOwnedMessage = `你已经拥有${maxRules}个规则之力（已达上限），无法继续炼化`;
                    }
                  }
                }

                // 生成完整的提示信息
                const tooltipMessage = alreadyOwned
                  ? alreadyOwnedMessage
                  : !canRefineItem
                  ? warningMessage
                  : '炼化进阶物品';

                return (
                  <button
                    onClick={() => {
                      if (!canRefineItem) {
                        if (setItemActionLog) {
                          setItemActionLog({ text: warningMessage.replace(/\n/g, ' '), type: 'danger' });
                        }
                        return;
                      }
                      if (alreadyOwned) {
                        if (setItemActionLog) {
                          setItemActionLog({ text: alreadyOwnedMessage, type: 'danger' });
                        }
                        return;
                      }
                      // 二次确认，特别是筑基奇物炼化后不可修改
                      const confirmMessage = item.advancedItemType === 'foundationTreasure'
                        ? `确定要炼化【${item.name}】吗？\n\n⚠️ 警告：筑基奇物炼化后将无法修改，请谨慎选择！`
                        : `确定要炼化【${item.name}】吗？`;
                      showConfirm(
                        confirmMessage,
                        '确认炼化',
                        () => {
                          onRefineAdvancedItem(item);
                        }
                      );
                    }}
                    disabled={!canRefineItem || alreadyOwned}
                    className={`flex-1 text-xs py-2 rounded transition-colors border ${
                      !canRefineItem || alreadyOwned
                        ? 'bg-stone-800/50 text-stone-500 border-stone-700/50 cursor-not-allowed opacity-50'
                        : 'bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 border-purple-700/50'
                    }`}
                    title={tooltipMessage}
                  >
                    <Sparkles size={14} className="inline mr-1" />
                    炼化
                  </button>
                );
              })()}
              <button
                onClick={() => onDiscardItem(item)}
                className="px-3 bg-red-900 hover:bg-red-800 text-red-200 text-xs py-2 rounded transition-colors border border-red-700"
                title="丢弃"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 只有关键属性变化时才重新渲染
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.quantity === nextProps.item.quantity &&
      prevProps.item.level === nextProps.item.level &&
      prevProps.item.rarity === nextProps.item.rarity &&
      prevProps.item.reviveChances === nextProps.item.reviveChances &&
      prevProps.isEquipped === nextProps.isEquipped &&
      prevProps.isNatal === nextProps.isNatal &&
      prevProps.canRefine === nextProps.canRefine &&
      prevProps.playerRealm === nextProps.playerRealm &&
      prevProps.foundationTreasure === nextProps.foundationTreasure &&
      prevProps.heavenEarthEssence === nextProps.heavenEarthEssence &&
      prevProps.heavenEarthMarrow === nextProps.heavenEarthMarrow &&
      prevProps.longevityRules === nextProps.longevityRules &&
      prevProps.maxLongevityRules === nextProps.maxLongevityRules
    );
  }
);

InventoryItem.displayName = 'InventoryItem';

const InventoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  inventory,
  equippedItems,
  natalArtifactId,
  playerRealm,
  foundationTreasure,
  heavenEarthEssence,
  heavenEarthMarrow,
  longevityRules,
  maxLongevityRules,
  onUseItem,
  onEquipItem,
  onUnequipItem,
  onUpgradeItem,
  onDiscardItem,
  onBatchDiscard,
  onBatchUse,
  onOrganizeInventory,
  onEquipBestSet,
  onRefineNatalArtifact,
  onUnrefineNatalArtifact,
  onRefineAdvancedItem,
  setItemActionLog,
}) => {
  const [hoveredItem, setHoveredItem] = useState<Item | null>(null);
  const [showEquipment, setShowEquipment] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory>('all');
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState<
    EquipmentSlot | 'all'
  >('all');
  const [sortByRarity, setSortByRarity] = useState(true);
  const [isBatchDiscardOpen, setIsBatchDiscardOpen] = useState(false);
  const [isBatchUseOpen, setIsBatchUseOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<
    'equipment' | 'inventory'
  >('inventory');
  // 搜索和高级筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');
  const [statFilter, setStatFilter] = useState<'all' | 'attack' | 'defense' | 'hp' | 'spirit' | 'physique' | 'speed'>('all');
  const [statFilterMin, setStatFilterMin] = useState<number>(0);

  // 使用 useTransition 优化分类切换，避免阻塞UI
  const [isPending, startTransition] = useTransition();

  // 防抖搜索输入，减少不必要的重新渲染
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const handleBatchDiscard = (itemIds: string[]) => {
    onBatchDiscard(itemIds);
  };

  const handleBatchUse = (itemIds: string[]) => {
    if (onBatchUse) {
      onBatchUse(itemIds);
    }
  };

  // 使用 useCallback 优化分类切换处理函数
  const handleCategoryChange = useCallback((category: ItemCategory) => {
    startTransition(() => {
      setSelectedCategory(category);
      setSelectedEquipmentSlot('all');
    });
  }, []);

  const handleEquipmentSlotChange = useCallback(
    (slot: EquipmentSlot | 'all') => {
      startTransition(() => {
        setSelectedEquipmentSlot(slot);
      });
    },
    []
  );

  const handleHoverItem = useCallback((item: Item | null) => {
    setHoveredItem(item);
  }, []);

  const handleEquipWrapper = useCallback((item: Item) => {
    // 使用智能查找函数，自动找到对应的空槽位
    // 对于戒指、首饰、法宝，会优先查找空槽位
    // 对于其他装备类型，会使用对应的槽位（如果有空槽位则使用，否则替换已有装备）
    const targetSlot = findEmptyEquipmentSlot(item, equippedItems);

    if (targetSlot) {
      onEquipItem(item, targetSlot);
    }
    // 如果 findEmptyEquipmentSlot 返回 null，说明该物品无法装备（通常是缺少 equipmentSlot 且不是戒指/首饰/法宝）
  }, [equippedItems, onEquipItem]);

  const handleUnequipWrapper = useCallback((item: Item) => {
    const actualSlot = findItemEquippedSlot(item, equippedItems);
    if (actualSlot) {
      onUnequipItem(actualSlot);
    }
  }, [equippedItems, onUnequipItem]);

  // 预计算物品装备状态映射，避免在渲染时重复计算
  const itemEquippedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    inventory.forEach((item) => {
      map.set(item.id, checkItemEquipped(item, equippedItems));
    });
    return map;
  }, [inventory, equippedItems]);

  // 过滤和排序物品
  const filteredAndSortedInventory = useMemo(() => {
    // 判断物品分类
    const getItemCategory = (item: Item): ItemCategory => {
      const typeKey = String(item.type).toLowerCase();
      if (item.type === ItemType.Recipe || typeKey === 'recipe') {
        return 'recipe'; // 丹方单独分类
      }
      if (item.type === ItemType.AdvancedItem || typeKey === 'advanceditem' || typeKey === '进阶物品') {
        return 'advancedItem'; // 进阶物品单独分类
      }
      if (
        item.isEquippable ||
        item.type === ItemType.Weapon ||
        item.type === ItemType.Armor ||
        item.type === ItemType.Artifact ||
        item.type === ItemType.Accessory ||
        item.type === ItemType.Ring ||
        ['weapon', 'armor', 'artifact', 'accessory', 'ring'].includes(typeKey)
      ) {
        return 'equipment';
      }
      if (item.type === ItemType.Pill || ['pill', 'elixir', 'potion'].includes(typeKey)) {
        return 'pill';
      }
      // 判断是草药、合成石还是材料
      const name = item.name;
      // 优先使用 ItemType 判断
      if (item.type === ItemType.Herb || typeKey === 'herb' || typeKey === '草药') {
        return 'herb';
      }
      // 对于 Material 类型或其他类型，根据名称进一步判断
      // 根据名称判断合成石（包含"石"、"铁"、"矿"、"炼器"等关键词）
      if (
        name.includes('合成石')
      ) {
        return 'synthesisStone';
      }
      // 根据名称判断草药（包含"草"、"花"、"参"、"芝"等关键词）
      if (
        name.includes('草') ||
        name.includes('花') ||
        name.includes('参') ||
        name.includes('芝')
      ) {
        return 'herb';
      }
      // 其他材料类物品
      return 'material';
    };

    let filtered = inventory;

    // 按分类过滤
    if (selectedCategory !== 'all') {
      filtered = inventory.filter(
        (item) => getItemCategory(item) === selectedCategory
      );
    }

    // 如果是装备分类，进一步按部位过滤（使用统一的工具函数）
    if (selectedCategory === 'equipment' && selectedEquipmentSlot !== 'all') {
      filtered = filtered.filter((item) => {
        if (!item.equipmentSlot) return false;
        // 使用工具函数检查槽位是否属于同一组
        return areSlotsInSameGroup(item.equipmentSlot, selectedEquipmentSlot);
      });
    }

    // 搜索过滤（按名称和描述）- 使用防抖后的搜索词
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        return nameMatch || descMatch;
      });
    }

    // 稀有度过滤
    if (rarityFilter !== 'all') {
      filtered = filtered.filter(
        (item) => normalizeRarityValue(item.rarity) === rarityFilter
      );
    }

    // 属性过滤 - 优化：只在需要时计算属性
    if (statFilter !== 'all' && statFilterMin > 0) {
      filtered = filtered.filter((item) => {
        const isNatal = item.id === natalArtifactId;
        const stats = getItemStats(item, isNatal);
        const statValue = stats[statFilter] || 0;
        return statValue >= statFilterMin;
      });
    }

    // 按品级排序（从高到低）
    if (sortByRarity) {
      filtered = [...filtered].sort((a, b) => {
        const rarityA = getRarityOrder(normalizeRarityValue(a.rarity));
        const rarityB = getRarityOrder(normalizeRarityValue(b.rarity));
        if (rarityB !== rarityA) {
          return rarityB - rarityA; // 品级从高到低
        }
        // 如果品级相同，按名称排序
        return a.name.localeCompare(b.name, 'zh-CN');
      });
    }

    return filtered;
  }, [inventory, selectedCategory, selectedEquipmentSlot, sortByRarity, debouncedSearchQuery, rarityFilter, statFilter, statFilterMin, natalArtifactId]);

  // 计算所有已装备物品的总属性（使用统一的工具函数）
  const calculateTotalEquippedStats = useMemo(() => {
    let totalAttack = 0;
    let totalDefense = 0;
    let totalHp = 0;

    Object.values(equippedItems).forEach((itemId) => {
      if (itemId) {
        const item = inventory.find((i) => i.id === itemId);
        if (item) {
          // 使用统一的工具函数计算属性
          const isNatal = item.id === natalArtifactId;
          const stats = getItemStats(item, isNatal);

          totalAttack += stats.attack;
          totalDefense += stats.defense;
          totalHp += stats.hp;
        }
      }
    });

    return { attack: totalAttack, defense: totalDefense, hp: totalHp };
  }, [equippedItems, inventory, natalArtifactId]);

  // 获取物品统计信息（用于比较）- 使用统一的工具函数
  const getItemStatsForComparison = useCallback(
    (item: Item) => {
      const isNatal = item.id === natalArtifactId;
      return getItemStats(item, isNatal);
    },
    [natalArtifactId]
  );

  // 使用 useMemo 缓存装备比较结果，避免每次渲染都重新计算
  // 注意：必须在 if (!isOpen) return null; 之前调用，遵守 React Hooks 规则
  const comparison = useMemo(() => {
    if (!hoveredItem || !hoveredItem.isEquippable)
      return null;

    // 1. Get the slot to compare against
    let slot: EquipmentSlot | undefined = hoveredItem.equipmentSlot;

    // For items without equipmentSlot (like some Rings/Accessories/Artifacts),
    // try to find a relevant slot based on type
    if (!slot) {
      const slots = getEquipmentSlotsByType(hoveredItem.type);
      if (slots.length > 0) {
        // Find an empty slot or use the first one
        slot = slots.find(s => !equippedItems[s]) || slots[0];
      }
    }

    if (!slot) return null;

    // 2. Get currently equipped stats for this slot
    const currentEquippedId = equippedItems[slot];
    let currentEquippedStats = { attack: 0, defense: 0, hp: 0 };
    if (currentEquippedId) {
      const currentEquippedItem = inventory.find(
        (i) => i.id === currentEquippedId
      );
      if (currentEquippedItem) {
        currentEquippedStats = getItemStatsForComparison(currentEquippedItem);
      }
    }

    // 3. Get hovered item stats
    const hoveredStats = getItemStatsForComparison(hoveredItem);

    // 4. Calculate difference
    return {
      attack: hoveredStats.attack - currentEquippedStats.attack,
      defense: hoveredStats.defense - currentEquippedStats.defense,
      hp: hoveredStats.hp - currentEquippedStats.hp,
    };
  }, [hoveredItem, equippedItems, inventory, getItemStatsForComparison]);

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="储物袋"
      titleIcon={<Package size={18} className="md:w-5 md:h-5" />}
      size="full"
      containerClassName="md:max-w-6xl bg-paper-800 border-stone-600"
      headerClassName="bg-ink-800 border-b border-stone-600"
      contentClassName="bg-paper-800"
      disableScroll={true}
      showHeaderBorder={false}
      showFooterBorder={false}
      titleExtra={
        <div className="flex gap-2 items-center ml-auto md:ml-4">
            {onEquipBestSet && (
              <button
                onClick={onEquipBestSet}
                className="px-2 md:px-3 py-1.5 md:py-1 rounded text-xs md:text-sm border transition-colors min-h-11 md:min-h-0 touch-manipulation bg-mystic-gold/20 border-mystic-gold text-mystic-gold hover:bg-mystic-gold/30"
                title="自动装备当前背包中综合评分最高的一套装备"
              >
                <div className="flex items-center">
                  <ShieldCheck size={14} className="inline mr-1" />
                  <span>一键最强</span>
                </div>
              </button>
            )}
            {onOrganizeInventory && (
              <button
                onClick={() => {
                  onOrganizeInventory();
                  setSortByRarity(false);
                }}
                className="px-2 md:px-3 py-1.5 md:py-1 rounded text-xs md:text-sm border transition-colors min-h-11 md:min-h-0 touch-manipulation bg-blue-900/20 border-blue-700 text-blue-300 hover:bg-blue-900/30"
                title="合并同类物品并按分类/品质排序"
              >
                <div className="flex items-center">
                  <ArrowUpDown size={14} className="inline mr-1" />
                  <span>整理背包</span>
                </div>
              </button>
            )}
            {onBatchUse && (
              <button
                onClick={() => setIsBatchUseOpen(true)}
                className="px-2 md:px-3 py-1.5 md:py-1 rounded text-xs md:text-sm border transition-colors min-h-11 md:min-h-0 touch-manipulation bg-green-900/20 border-green-700 text-green-300 hover:bg-green-900/30"
              >
                <div className="flex items-center">
                  <Zap size={14} className="inline mr-1" />
                  <span>批量使用</span>
                </div>
              </button>
            )}
            <button
              onClick={() => setIsBatchDiscardOpen(true)}
              className="px-2 md:px-3 py-1.5 md:py-1 rounded text-xs md:text-sm border transition-colors min-h-11 md:min-h-0 touch-manipulation bg-red-900/20 border-red-700 text-red-300 hover:bg-red-900/30"
            >
              <div className="flex items-center">
                <Trash size={14} className="inline mr-1" />
                <span>批量丢弃</span>
              </div>
            </button>
            <button
              onClick={() => setShowEquipment(!showEquipment)}
              className={`hidden md:flex items-center justify-center px-3 py-1 rounded text-sm border transition-colors ${
                showEquipment
                  ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                  : 'bg-stone-700 border-stone-600 text-stone-300'
              }`}
            >
              {showEquipment ? '隐藏' : '显示'}装备栏
            </button>
        </div>
      }
      subHeader={
        <div className="md:hidden border-b border-stone-600 bg-ink-800">
          <div className="flex">
            <button
              onClick={() => setMobileActiveTab('equipment')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                mobileActiveTab === 'equipment'
                  ? 'border-mystic-gold text-mystic-gold bg-mystic-gold/10'
                  : 'border-transparent text-stone-400 hover:text-stone-300'
              }`}
            >
              <ShieldCheck size={16} className="inline mr-2" />
              装备栏位
            </button>
            <button
              onClick={() => setMobileActiveTab('inventory')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                mobileActiveTab === 'inventory'
                  ? 'border-mystic-gold text-mystic-gold bg-mystic-gold/10'
                  : 'border-transparent text-stone-400 hover:text-stone-300'
              }`}
            >
              <Package size={16} className="inline mr-2" />
              背包
            </button>
          </div>
        </div>
      }
      footer={
          <div className="flex items-center justify-center gap-4 min-h-12 text-sm font-serif w-full">
          {comparison ? (
            <div className="flex items-center gap-4">
              <span className="text-stone-400">装备预览:</span>
              {comparison.attack !== 0 && (
                <span
                  className={`${comparison.attack > 0 ? 'text-mystic-jade' : 'text-mystic-blood'}`}
                >
                  攻击 {formatValueChange(calculateTotalEquippedStats.attack, calculateTotalEquippedStats.attack + comparison.attack)}
                </span>
              )}
              {comparison.defense !== 0 && (
                <span
                  className={`${comparison.defense > 0 ? 'text-mystic-jade' : 'text-mystic-blood'}`}
                >
                  防御 {formatValueChange(calculateTotalEquippedStats.defense, calculateTotalEquippedStats.defense + comparison.defense)}
                </span>
              )}
              {comparison.hp !== 0 && (
                <span
                  className={`${comparison.hp > 0 ? 'text-mystic-jade' : 'text-mystic-blood'}`}
                >
                  气血 {formatValueChange(calculateTotalEquippedStats.hp, calculateTotalEquippedStats.hp + comparison.hp)}
                </span>
              )}
              {comparison.attack === 0 &&
                comparison.defense === 0 &&
                comparison.hp === 0 && (
                  <span className="text-stone-500">属性无变化</span>
                )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-stone-400">装备预览:</span>
              {calculateTotalEquippedStats.attack > 0 && (
                <span className="text-mystic-jade">
                  攻击 {formatNumber(calculateTotalEquippedStats.attack)}
                </span>
              )}
              {calculateTotalEquippedStats.defense > 0 && (
                <span className="text-mystic-jade">
                  防御 {formatNumber(calculateTotalEquippedStats.defense)}
                </span>
              )}
              {calculateTotalEquippedStats.hp > 0 && (
                <span className="text-mystic-jade">
                  气血 {formatNumber(calculateTotalEquippedStats.hp)}
                </span>
              )}
              {calculateTotalEquippedStats.attack === 0 &&
                calculateTotalEquippedStats.defense === 0 &&
                calculateTotalEquippedStats.hp === 0 && (
                  <span className="text-stone-500">暂无装备</span>
                )}
            </div>
          )}
          </div>
      }
      footerClassName="p-3 border-t border-stone-600 bg-ink-900 rounded-b"
    >
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row h-full">
          {/* 装备面板 */}
          {(showEquipment || mobileActiveTab === 'equipment') && (
            <div
              className={`w-full md:w-1/2 border-b md:border-b-0 md:border-r border-stone-600 p-3 md:p-4 modal-scroll-container modal-scroll-content ${
                mobileActiveTab !== 'equipment' ? 'hidden md:block' : ''
              }`}
            >
              <EquipmentPanel
                equippedItems={equippedItems}
                inventory={inventory}
                natalArtifactId={natalArtifactId}
                onUnequip={onUnequipItem}
              />
            </div>
          )}

          {/* 物品列表 */}
          <div
            className={`${showEquipment ? 'w-full md:w-1/2' : 'w-full'} modal-scroll-container modal-scroll-content p-4 flex flex-col ${
              mobileActiveTab !== 'inventory' ? 'hidden md:flex' : ''
            }`}
          >
            {/* 搜索和筛选 */}
            <div className="mb-4 flex flex-col gap-3">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索物品名称或描述..."
                  className="w-full pl-10 pr-4 py-2 bg-stone-700 border border-stone-600 rounded text-stone-200 placeholder-stone-500 focus:outline-none focus:border-mystic-gold focus:ring-1 focus:ring-mystic-gold"
                />
                {searchQuery && (
                  <button
                    title="清除搜索"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 hover:text-stone-200"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* 筛选工具栏 */}
              <div className="flex gap-2 items-center flex-wrap">
                {/* 高级筛选按钮 */}
                <button
                  onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors flex items-center gap-2 ${
                    showAdvancedFilter || rarityFilter !== 'all' || statFilter !== 'all'
                      ? 'bg-purple-900/20 border-purple-600 text-purple-300'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  高级筛选
                  {(rarityFilter !== 'all' || statFilter !== 'all') && (
                    <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded">
                      已启用
                    </span>
                  )}
                </button>

                {/* 稀有度快速筛选 */}
                <div className="flex gap-1">
                  {(['all', '普通', '稀有', '传说', '仙品'] as const).map((rarity) => (
                    <button
                      key={rarity}
                      onClick={() => setRarityFilter(rarity)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        rarityFilter === rarity
                          ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                          : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                      }`}
                    >
                      {rarity === 'all' ? '全部品质' : rarity}
                    </button>
                  ))}
                </div>

                {/* 排序按钮 */}
                <button
                  onClick={() => setSortByRarity(!sortByRarity)}
                  className={`ml-auto px-3 py-1.5 rounded text-sm border transition-colors flex items-center gap-2 ${
                    sortByRarity
                      ? 'bg-blue-900/20 border-blue-600 text-blue-300'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  }`}
                >
                  <ArrowUpDown size={16} />
                  {sortByRarity ? '按品质排序' : '不排序'}
                </button>
              </div>

              {/* 高级筛选面板 */}
              {showAdvancedFilter && (
                <div className="bg-stone-800 rounded p-4 border border-stone-600">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter size={16} className="text-purple-400" />
                    <h4 className="text-sm font-bold text-purple-300">高级筛选</h4>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs text-stone-400 mb-2">属性筛选</label>
                    <div className="flex items-center gap-2">
                      {/* 属性筛选 */}
                      <div>
                        <div className="flex gap-2 mb-2">
                          <select
                            title="属性筛选"
                            value={statFilter}
                            onChange={(e) => {
                              setStatFilter(e.target.value as typeof statFilter);
                              if (e.target.value === 'all') setStatFilterMin(0);
                            }}
                            className="flex-1 px-2 py-1.5 bg-stone-700 border border-stone-600 rounded text-sm text-stone-200"
                          >
                            <option value="all">全部属性</option>
                            <option value="attack">攻击力</option>
                            <option value="defense">防御力</option>
                            <option value="hp">气血</option>
                            <option value="spirit">神识</option>
                            <option value="physique">体魄</option>
                            <option value="speed">速度</option>
                          </select>
                        </div>
                        {statFilter !== 'all' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={statFilterMin}
                              onChange={(e) => setStatFilterMin(Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="最小值"
                              className="w-full px-2 py-1.5 bg-stone-700 border border-stone-600 rounded text-sm text-stone-200"
                            />
                          </div>
                        )}
                      </div>

                      {/* 清除筛选按钮 */}
                      <div className="flex items-start" style={{ marginTop: '-10px' }}>
                        <button
                          onClick={() => {
                            setRarityFilter('all');
                            setStatFilter('all');
                            setStatFilterMin(0);
                          }}
                          className="w-full px-3 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-700 text-red-300 rounded text-sm transition-colors"
                        >
                          清除所有筛选
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 分类标签 */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleCategoryChange('all')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  全部
                </button>
                <button
                  onClick={() => handleCategoryChange('equipment')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'equipment'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  装备
                </button>
                <button
                  onClick={() => handleCategoryChange('pill')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'pill'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  丹药
                </button>
                <button
                  onClick={() => handleCategoryChange('material')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'material'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  材料
                </button>
                <button
                  onClick={() => handleCategoryChange('herb')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'herb'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  草药
                </button>
                <button
                  onClick={() => handleCategoryChange('synthesisStone')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'synthesisStone'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  合成石
                </button>
                <button
                  onClick={() => handleCategoryChange('recipe')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'recipe'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  丹方
                </button>
                <button
                  onClick={() => handleCategoryChange('advancedItem')}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selectedCategory === 'advancedItem'
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  进阶物品
                </button>
              </div>
              {/* 装备部位细分（仅在装备分类时显示） */}
              {selectedCategory === 'equipment' && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleEquipmentSlotChange('all')}
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === 'all'
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    全部装备
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Weapon)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Weapon
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    武器
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Head)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Head
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    头部
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Shoulder)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Shoulder
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    肩部
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Chest)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Chest
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    胸甲
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Gloves)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Gloves
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    手套
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Legs)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Legs
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    裤腿
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Boots)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Boots
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    鞋子
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Ring1)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Ring1 ||
                      selectedEquipmentSlot === EquipmentSlot.Ring2 ||
                      selectedEquipmentSlot === EquipmentSlot.Ring3 ||
                      selectedEquipmentSlot === EquipmentSlot.Ring4
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    戒指
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Accessory1)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Accessory1 ||
                      selectedEquipmentSlot === EquipmentSlot.Accessory2
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    首饰
                  </button>
                  <button
                    onClick={() =>
                      handleEquipmentSlotChange(EquipmentSlot.Artifact1)
                    }
                    disabled={isPending}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selectedEquipmentSlot === EquipmentSlot.Artifact1 ||
                      selectedEquipmentSlot === EquipmentSlot.Artifact2
                        ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                        : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                    } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    法宝
                  </button>
                </div>
              )}
              {/* 排序按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortByRarity(!sortByRarity)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors flex items-center gap-1.5 ${
                    sortByRarity
                      ? 'bg-mystic-gold/20 border-mystic-gold text-mystic-gold'
                      : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'
                  }`}
                >
                  <ArrowUpDown size={14} />
                  {sortByRarity ? '按品级排序' : '原始顺序'}
                </button>
                <span className="text-xs text-stone-500">
                  {filteredAndSortedInventory.length} 件物品
                </span>
              </div>
            </div>

            {/* 物品网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {filteredAndSortedInventory.length === 0 ? (
                <div className="col-span-full text-center text-stone-500 py-10 font-serif">
                  {selectedCategory === 'all'
                    ? '储物袋空空如也，快去历练一番吧！'
                    : `当前分类暂无物品`}
                </div>
              ) : (() => {
                const realmIndex = REALM_ORDER.indexOf(playerRealm as RealmType);
                const goldenCoreIndex = REALM_ORDER.indexOf(RealmType.GoldenCore);
                const canRefineGlobal = realmIndex >= goldenCoreIndex;

                return filteredAndSortedInventory.map((item) => (
                  <InventoryItem
                    key={item.id}
                    item={item}
                    isNatal={item.id === natalArtifactId}
                    canRefine={canRefineGlobal}
                    isEquipped={itemEquippedMap.get(item.id) || false}
                    playerRealm={playerRealm}
                    foundationTreasure={foundationTreasure}
                    heavenEarthEssence={heavenEarthEssence}
                    heavenEarthMarrow={heavenEarthMarrow}
                    longevityRules={longevityRules}
                    maxLongevityRules={maxLongevityRules}
                    onHover={handleHoverItem}
                    onUseItem={onUseItem}
                    onEquipItem={handleEquipWrapper}
                    onUnequipItem={handleUnequipWrapper}
                    onUpgradeItem={onUpgradeItem}
                    onDiscardItem={onDiscardItem}
                    onRefineNatalArtifact={onRefineNatalArtifact}
                    onUnrefineNatalArtifact={onUnrefineNatalArtifact}
                    onRefineAdvancedItem={onRefineAdvancedItem}
                    setItemActionLog={setItemActionLog}
                  />
                ));
              })()}
            </div>
          </div>
      </div>
    </Modal>

      <BatchDiscardModal
        isOpen={isBatchDiscardOpen}
        onClose={() => setIsBatchDiscardOpen(false)}
        inventory={inventory}
        equippedItems={equippedItems}
        onDiscardItems={handleBatchDiscard}
      />

      {onBatchUse && (
        <BatchUseModal
          isOpen={isBatchUseOpen}
          onClose={() => setIsBatchUseOpen(false)}
          inventory={inventory}
          equippedItems={equippedItems}
          onUseItems={handleBatchUse}
        />
      )}
    </>
  );
};

export default React.memo(InventoryModal);
