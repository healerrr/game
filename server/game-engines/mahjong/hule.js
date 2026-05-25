'use strict';

const { isZhong, isNumberTile, tileKey, SUITS } = require('./tiles');

/**
 * 红中百搭胡牌判定
 * 红中可以替代任何数字牌(万/筒/条)组成面子或雀头
 */

// 构建计数对象 { "suit:rank": count }
function buildCounts(tiles) {
  const counts = {};
  for (const t of tiles) {
    if (!t) continue;
    const key = tileKey(t);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// 获取counts中剩余牌总数
function totalRemaining(counts) {
  let sum = 0;
  for (const key of Object.keys(counts)) {
    sum += counts[key];
  }
  return sum;
}

// 解析key得到suit和rank
function parseKey(key) {
  const [suit, rankStr] = key.split(':');
  const rank = suit === 'zhong' ? 'zhong' : Number(rankStr);
  return { suit, rank };
}

// 获取counts中第一个数量>0的key（按排序顺序，便于递归剪枝）
function getFirstKey(counts) {
  const suitOrder = { wan: 1, tong: 2, tiao: 3, zhong: 4 };
  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  if (keys.length === 0) return null;
  keys.sort((a, b) => {
    const pa = parseKey(a);
    const pb = parseKey(b);
    const so = (suitOrder[pa.suit] || 99) - (suitOrder[pb.suit] || 99);
    if (so !== 0) return so;
    return (typeof pa.rank === 'number' ? pa.rank : 99) - (typeof pb.rank === 'number' ? pb.rank : 99);
  });
  return keys[0];
}

/**
 * 递归检查是否能从counts中组成needMelds个面子
 * zhongLeft: 可用的红中数量（作为百搭）
 * 红中可以替代任何缺少的牌来凑成刻子或顺子
 */
function canFormMelds(counts, zhongLeft, needMelds) {
  const remaining = totalRemaining(counts);

  // 所有面子都已组成
  if (needMelds === 0) {
    // 剩余的普通牌必须为0，剩余红中可以3个一组组面子
    return remaining === 0 && zhongLeft % 3 === 0;
  }

  // 剩余的牌（含红中）不够组成需要的面子
  if (remaining + zhongLeft < needMelds * 3) return false;

  // 如果没有普通牌了，看红中能否全部组成面子
  if (remaining === 0) {
    return zhongLeft >= needMelds * 3 && zhongLeft % 3 === 0;
  }

  const key = getFirstKey(counts);
  if (!key) {
    // 没有普通牌了，红中凑面子
    return zhongLeft >= needMelds * 3;
  }

  const { suit, rank } = parseKey(key);
  const count = counts[key];

  // 尝试刻子
  if (count >= 3) {
    counts[key] -= 3;
    if (canFormMelds(counts, zhongLeft, needMelds - 1)) {
      counts[key] += 3;
      return true;
    }
    counts[key] += 3;
  }

  // 2张 + 1红中 组刻子
  if (count >= 2 && zhongLeft >= 1) {
    counts[key] -= 2;
    if (canFormMelds(counts, zhongLeft - 1, needMelds - 1)) {
      counts[key] += 2;
      return true;
    }
    counts[key] += 2;
  }

  // 1张 + 2红中 组刻子
  if (count >= 1 && zhongLeft >= 2) {
    counts[key] -= 1;
    if (canFormMelds(counts, zhongLeft - 2, needMelds - 1)) {
      counts[key] += 1;
      return true;
    }
    counts[key] += 1;
  }

  // 尝试顺子（仅数字牌）
  if (isNumberTile({ suit, rank })) {
    const key2 = `${suit}:${rank + 1}`;
    const key3 = `${suit}:${rank + 2}`;

    if (rank <= 7) {
      const c2 = counts[key2] || 0;
      const c3 = counts[key3] || 0;

      // 3张齐全
      if (c2 > 0 && c3 > 0) {
        counts[key] -= 1;
        counts[key2] = (counts[key2] || 0) - 1;
        counts[key3] = (counts[key3] || 0) - 1;
        if (canFormMelds(counts, zhongLeft, needMelds - 1)) {
          counts[key] += 1;
          counts[key2] += 1;
          counts[key3] += 1;
          return true;
        }
        counts[key] += 1;
        counts[key2] += 1;
        counts[key3] += 1;
      }

      // 缺1张用红中补
      if (zhongLeft >= 1) {
        // 有key和key2，缺key3
        if (c2 > 0 && c3 === 0) {
          counts[key] -= 1;
          counts[key2] -= 1;
          if (canFormMelds(counts, zhongLeft - 1, needMelds - 1)) {
            counts[key] += 1;
            counts[key2] += 1;
            return true;
          }
          counts[key] += 1;
          counts[key2] += 1;
        }
        // 有key和key3，缺key2
        if (c2 === 0 && c3 > 0) {
          counts[key] -= 1;
          counts[key3] -= 1;
          if (canFormMelds(counts, zhongLeft - 1, needMelds - 1)) {
            counts[key] += 1;
            counts[key3] += 1;
            return true;
          }
          counts[key] += 1;
          counts[key3] += 1;
        }
      }

      // 缺2张用红中补（只有key自身）
      if (zhongLeft >= 2 && c2 === 0 && c3 === 0) {
        counts[key] -= 1;
        if (canFormMelds(counts, zhongLeft - 2, needMelds - 1)) {
          counts[key] += 1;
          return true;
        }
        counts[key] += 1;
      }
    }

    // rank <= 8: key, key-1已处理过(从小到大), 尝试 key as middle
    if (rank >= 2 && rank <= 8) {
      const keyPrev = `${suit}:${rank - 1}`;
      const cPrev = counts[keyPrev] || 0;
      const cNext = counts[key2] || 0;
      // key as middle: prev+key+next - 但prev应该已经被处理过了（从小开始）
      // 这里不需要，因为从小到大遍历时，包含key的顺子只可能是 key, key+1, key+2
      // 或者 key-1, key, key+1 或 key-2, key-1, key - 但前者的起始key-1应该已经处理
    }

    // rank >= 3 且 rank <= 9: 不需要额外处理，从小到大已覆盖
  }

  return false;
}

/**
 * 标准胡检查：从手牌中找 needMelds 个面子 + 1个雀头
 */
function checkStandardHu(nonZhongTiles, zhongCount, needMelds) {
  const counts = buildCounts(nonZhongTiles);
  const allKeys = Object.keys(counts).filter(k => counts[k] > 0);

  // 枚举雀头
  // 1. 两张相同的普通牌作雀头
  for (const key of allKeys) {
    if (counts[key] >= 2) {
      counts[key] -= 2;
      if (canFormMelds(counts, zhongCount, needMelds)) {
        counts[key] += 2;
        return true;
      }
      counts[key] += 2;
    }
  }

  // 2. 一张普通牌 + 1红中作雀头
  if (zhongCount >= 1) {
    for (const key of allKeys) {
      if (counts[key] >= 1) {
        counts[key] -= 1;
        if (canFormMelds(counts, zhongCount - 1, needMelds)) {
          counts[key] += 1;
          return true;
        }
        counts[key] += 1;
      }
    }
  }

  // 3. 2红中作雀头
  if (zhongCount >= 2) {
    if (canFormMelds(counts, zhongCount - 2, needMelds)) {
      return true;
    }
  }

  return false;
}

/**
 * 七对检查（含红中百搭）
 * 14张手牌，7对。红中可以配对任何单张。
 */
function checkSevenPairs(hand) {
  if (!hand || hand.length !== 14) return false;

  const zhongCount = hand.filter(t => isZhong(t)).length;
  const nonZhong = hand.filter(t => !isZhong(t));
  const counts = buildCounts(nonZhong);

  // 每种牌奇数张需要1个红中配对
  let zhongNeeded = 0;
  for (const count of Object.values(counts)) {
    zhongNeeded += count % 2;
  }

  // 红中要够用来配对，且剩余红中要能自己成对（偶数个）
  return zhongNeeded <= zhongCount && (zhongCount - zhongNeeded) % 2 === 0;
}

/**
 * 检查是否能胡牌
 * @param {Array} hand - 手牌（包含要胡的那张牌）
 * @param {Array} fulu - 副露数组
 * @returns {boolean}
 */
function canHu(hand, fulu = []) {
  if (!hand || hand.length === 0) return false;

  const zhongCount = hand.filter(t => isZhong(t)).length;
  const nonZhong = hand.filter(t => !isZhong(t));

  // 手牌总数校验：应为 14 - fulu.length * 3
  const expectedLen = 14 - fulu.length * 3;
  if (hand.length !== expectedLen) return false;

  // 四红中直接胡
  if (zhongCount >= 4) return true;

  // 七对检查
  if (fulu.length === 0 && hand.length === 14) {
    if (checkSevenPairs(hand)) return true;
  }

  // 标准胡检查
  const needMelds = 4 - fulu.length;
  return checkStandardHu(nonZhong, zhongCount, needMelds);
}

/**
 * 获取胡牌详情（用于番型判定）
 * @returns {{ type: 'standard'|'qidui'|'sizhong', melds: Array, pair: object }|null}
 */
function getHuDetail(hand, fulu = []) {
  if (!hand || hand.length === 0) return null;

  const zhongCount = hand.filter(t => isZhong(t)).length;
  const nonZhong = hand.filter(t => !isZhong(t));
  const expectedLen = 14 - fulu.length * 3;
  if (hand.length !== expectedLen) return null;

  // 四红中
  if (zhongCount >= 4) {
    return { type: 'sizhong', melds: [], pair: null };
  }

  // 七对
  if (fulu.length === 0 && hand.length === 14 && checkSevenPairs(hand)) {
    return { type: 'qidui', melds: [], pair: null };
  }

  // 标准胡 - 尝试拆解面子
  const needMelds = 4 - fulu.length;
  const detail = tryDecompose(nonZhong, zhongCount, needMelds);
  if (detail) {
    return { type: 'standard', melds: detail.melds, pair: detail.pair };
  }

  return null;
}

/**
 * 尝试拆解手牌为面子+雀头，返回拆解详情
 */
function tryDecompose(nonZhongTiles, zhongCount, needMelds) {
  const counts = buildCounts(nonZhongTiles);
  const allKeys = Object.keys(counts).filter(k => counts[k] > 0);

  // 枚举雀头
  for (const key of allKeys) {
    if (counts[key] >= 2) {
      counts[key] -= 2;
      const melds = decomposeMelds(counts, zhongCount, needMelds);
      if (melds !== null) {
        counts[key] += 2;
        return { melds, pair: parseKey(key) };
      }
      counts[key] += 2;
    }
  }

  if (zhongCount >= 1) {
    for (const key of allKeys) {
      if (counts[key] >= 1) {
        counts[key] -= 1;
        const melds = decomposeMelds(counts, zhongCount - 1, needMelds);
        if (melds !== null) {
          counts[key] += 1;
          return { melds, pair: { ...parseKey(key), hasZhong: true } };
        }
        counts[key] += 1;
      }
    }
  }

  if (zhongCount >= 2) {
    const melds = decomposeMelds(counts, zhongCount - 2, needMelds);
    if (melds !== null) {
      return { melds, pair: { suit: 'zhong', rank: 'zhong', pureZhong: true } };
    }
  }

  return null;
}

/**
 * 递归拆解面子，返回面子数组或null
 */
function decomposeMelds(counts, zhongLeft, needMelds) {
  const remaining = totalRemaining(counts);
  if (needMelds === 0) {
    if (remaining === 0 && zhongLeft % 3 === 0) {
      const melds = [];
      for (let i = 0; i < zhongLeft / 3; i++) {
        melds.push({ type: 'ke', zhongOnly: true });
      }
      return melds;
    }
    return null;
  }

  if (remaining + zhongLeft < needMelds * 3) return null;
  if (remaining === 0) {
    if (zhongLeft >= needMelds * 3) {
      const melds = [];
      for (let i = 0; i < needMelds; i++) {
        melds.push({ type: 'ke', zhongOnly: true });
      }
      return melds;
    }
    return null;
  }

  const key = getFirstKey(counts);
  if (!key) return null;

  const { suit, rank } = parseKey(key);
  const count = counts[key];

  // 刻子
  if (count >= 3) {
    counts[key] -= 3;
    const result = decomposeMelds(counts, zhongLeft, needMelds - 1);
    if (result !== null) {
      counts[key] += 3;
      return [{ type: 'ke', suit, rank }, ...result];
    }
    counts[key] += 3;
  }

  // 2+1红中刻子
  if (count >= 2 && zhongLeft >= 1) {
    counts[key] -= 2;
    const result = decomposeMelds(counts, zhongLeft - 1, needMelds - 1);
    if (result !== null) {
      counts[key] += 2;
      return [{ type: 'ke', suit, rank, zhongUsed: 1 }, ...result];
    }
    counts[key] += 2;
  }

  // 1+2红中刻子
  if (count >= 1 && zhongLeft >= 2) {
    counts[key] -= 1;
    const result = decomposeMelds(counts, zhongLeft - 2, needMelds - 1);
    if (result !== null) {
      counts[key] += 1;
      return [{ type: 'ke', suit, rank, zhongUsed: 2 }, ...result];
    }
    counts[key] += 1;
  }

  // 顺子（仅数字牌）
  if (isNumberTile({ suit, rank }) && rank <= 7) {
    const key2 = `${suit}:${rank + 1}`;
    const key3 = `${suit}:${rank + 2}`;
    const c2 = counts[key2] || 0;
    const c3 = counts[key3] || 0;

    // 完整顺子
    if (c2 > 0 && c3 > 0) {
      counts[key] -= 1;
      counts[key2] = (counts[key2] || 0) - 1;
      counts[key3] = (counts[key3] || 0) - 1;
      const result = decomposeMelds(counts, zhongLeft, needMelds - 1);
      if (result !== null) {
        counts[key] += 1;
        counts[key2] += 1;
        counts[key3] += 1;
        return [{ type: 'shun', suit, rank }, ...result];
      }
      counts[key] += 1;
      counts[key2] += 1;
      counts[key3] += 1;
    }

    // 缺一张用红中
    if (zhongLeft >= 1) {
      if (c2 > 0 && c3 === 0) {
        counts[key] -= 1;
        counts[key2] -= 1;
        const result = decomposeMelds(counts, zhongLeft - 1, needMelds - 1);
        if (result !== null) {
          counts[key] += 1;
          counts[key2] += 1;
          return [{ type: 'shun', suit, rank, zhongUsed: 1 }, ...result];
        }
        counts[key] += 1;
        counts[key2] += 1;
      }
      if (c2 === 0 && c3 > 0) {
        counts[key] -= 1;
        counts[key3] -= 1;
        const result = decomposeMelds(counts, zhongLeft - 1, needMelds - 1);
        if (result !== null) {
          counts[key] += 1;
          counts[key3] += 1;
          return [{ type: 'shun', suit, rank, zhongUsed: 1 }, ...result];
        }
        counts[key] += 1;
        counts[key3] += 1;
      }
    }

    // 缺两张用红中
    if (zhongLeft >= 2 && c2 === 0 && c3 === 0) {
      counts[key] -= 1;
      const result = decomposeMelds(counts, zhongLeft - 2, needMelds - 1);
      if (result !== null) {
        counts[key] += 1;
        return [{ type: 'shun', suit, rank, zhongUsed: 2 }, ...result];
      }
      counts[key] += 1;
    }
  }

  return null;
}

/**
 * 获取听牌列表
 */
function getWaitTiles(hand, fulu = []) {
  if (!hand) return [];
  const waits = [];
  const allPossible = [];

  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      allPossible.push({ suit, rank });
    }
  }
  allPossible.push({ suit: 'zhong', rank: 'zhong' });

  for (const tile of allPossible) {
    const testHand = [...hand, tile];
    if (canHu(testHand, fulu)) {
      waits.push(tile);
    }
  }
  return waits;
}

module.exports = {
  canHu,
  getWaitTiles,
  checkSevenPairs,
  buildCounts,
  getHuDetail
};
