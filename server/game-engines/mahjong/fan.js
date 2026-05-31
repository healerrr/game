'use strict';

const { isZhong } = require('./tiles');
const { checkSevenPairs, buildCounts } = require('./hule');

/**
 * 红中推倒胡番型计算
 * @param {Array} hand - 完整手牌（含胡的那张牌）
 * @param {Array} fulu - 副露数组
 * @param {object} winTile - 胡的那张牌
 * @param {string} winType - 胡牌方式: 'zimo'|'dianpao'|'gangshanghua'|'qianggang'|'tianhu'|'dihu'
 * @returns {{ fan: number, detail: Array<{name: string, fan: number}> }}
 */
function evaluateFan(hand, fulu = [], winTile = null, winType = 'dianpao') {
  const detail = [];
  const allTiles = hand || [];

  if (allTiles.length === 0) {
    return { fan: 1, detail: [{ name: '平胡', fan: 1 }] };
  }

  let totalFan = 1;
  const addMultiplier = (name, fan) => {
    totalFan *= fan;
    detail.push({ name, fan });
  };

  // 1. 基础平胡 = 1番
  detail.push({ name: '平胡', fan: 1 });

  // 2. 天胡/地胡
  if (winType === 'tianhu') {
    addMultiplier('天胡', 5);
  }
  if (winType === 'dihu') {
    addMultiplier('地胡', 4);
  }

  // 3. 对对胡(碰碰胡) = 2番 - 所有面子都是刻子/杠，无顺子
  if (isAllPong(allTiles, fulu)) {
    addMultiplier('对对胡', 2);
  }

  // 4. 清一色 = 3番（仅一种花色的数字牌，红中不计入花色判断）
  const nonZhongHand = allTiles.filter(t => !isZhong(t));
  const fuluTiles = fulu.flatMap(f => f.cards || []).filter(t => !isZhong(t));
  const allNonZhong = [...nonZhongHand, ...fuluTiles];
  if (allNonZhong.length > 0) {
    const suits = new Set(allNonZhong.map(t => t.suit));
    if (suits.size === 1) {
      addMultiplier('清一色', 3);
    }
  }

  // 5. 七对 = 3番
  if (fulu.length === 0 && allTiles.length === 14 && checkSevenPairs(allTiles)) {
    addMultiplier('七对', 3);
    // 七对不计平胡
    const idx = detail.findIndex(d => d.name === '平胡');
    if (idx >= 0) detail.splice(idx, 1);
  }

  // 6. 杠上开花 = 2番
  if (winType === 'gangshanghua') {
    addMultiplier('杠上开花', 2);
  }

  // 7. 抢杠胡 +1
  if (winType === 'qianggang') {
    detail.push({ name: '抢杠胡', fan: 1 });
  }

  // 8. 全求人 +1（4副露，手里只剩将牌，点炮胡）
  if (fulu.length === 4 && allTiles.length === 2 && winType === 'dianpao') {
    detail.push({ name: '全求人', fan: 1 });
  }

  // 9. 四红中 = 4番
  const zhongCount = allTiles.filter(t => isZhong(t)).length;
  const fuluZhongCount = fulu.flatMap(f => f.cards || []).filter(t => isZhong(t)).length;
  const totalZhong = zhongCount + fuluZhongCount;
  if (totalZhong >= 4) {
    addMultiplier('四红中', 4);
  }

  // 10. 无红中胡(杀鬼) = 2番
  if (zhongCount === 0 && fuluZhongCount === 0) {
    addMultiplier('杀鬼(无红中)', 2);
  }

  return { fan: Math.max(1, totalFan), detail };
}

/**
 * 判断是否对对胡（全刻子无顺子）
 * 独立判定，不依赖 decompose 的拆解顺序
 */
function isAllPong(hand, fulu) {
  // 副露中是否有顺子
  for (const f of fulu) {
    if (f.type === 'chi') return false;
  }

  // 手牌中：去掉红中后，检查是否能仅用刻子+雀头拆解
  const zhongCount = hand.filter(t => isZhong(t)).length;
  const nonZhong = hand.filter(t => !isZhong(t));
  const counts = buildCounts(nonZhong);
  const values = Object.values(counts);

  // 枚举哪种牌做雀头
  const keys = Object.keys(counts);
  for (const pairKey of keys) {
    if (counts[pairKey] < 2) continue;
    // 尝试这种牌做雀头
    let zhongNeeded = 0;
    let valid = true;
    for (const k of keys) {
      const c = k === pairKey ? counts[k] - 2 : counts[k];
      if (c === 0) continue;
      if (c === 3) continue; // 完整刻子
      if (c === 1) zhongNeeded += 2; // 需要2红中凑刻子
      else if (c === 2) zhongNeeded += 1; // 需要1红中凑刻子
      else { valid = false; break; } // c===4时当成1个刻子+1张, 需要2红中
    }
    // 处理count=4的情况
    if (!valid) {
      zhongNeeded = 0;
      valid = true;
      for (const k of keys) {
        let c = k === pairKey ? counts[k] - 2 : counts[k];
        if (c === 0) continue;
        while (c >= 3) c -= 3;
        if (c === 0) continue;
        if (c === 1) zhongNeeded += 2;
        else if (c === 2) zhongNeeded += 1;
        else { valid = false; break; }
      }
    }
    if (valid && zhongNeeded <= zhongCount) return true;
  }

  // 用1红中配雀头
  if (zhongCount >= 1) {
    for (const pairKey of keys) {
      if (counts[pairKey] < 1) continue;
      let zhongNeeded = 0;
      let valid = true;
      for (const k of keys) {
        let c = k === pairKey ? counts[k] - 1 : counts[k];
        if (c === 0) continue;
        while (c >= 3) c -= 3;
        if (c === 0) continue;
        if (c === 1) zhongNeeded += 2;
        else if (c === 2) zhongNeeded += 1;
        else { valid = false; break; }
      }
      if (valid && zhongNeeded + 1 <= zhongCount) return true;
    }
  }

  // 2红中做雀头
  if (zhongCount >= 2) {
    let zhongNeeded = 0;
    let valid = true;
    for (const k of keys) {
      let c = counts[k];
      if (c === 0) continue;
      while (c >= 3) c -= 3;
      if (c === 0) continue;
      if (c === 1) zhongNeeded += 2;
      else if (c === 2) zhongNeeded += 1;
      else { valid = false; break; }
    }
    if (valid && zhongNeeded + 2 <= zhongCount) return true;
  }

  return false;
}

module.exports = { evaluateFan };
