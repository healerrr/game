const { isHonor, isFlower, tileKey } = require('./tiles');
const { canHu } = require('./hule');

function countMap(tiles) {
  return tiles.filter((tile) => !isFlower(tile)).reduce((map, tile) => {
    const key = tileKey(tile);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function getSuits(tiles, fulu = []) {
  const all = [...tiles, ...fulu.flatMap((meld) => meld.cards)];
  const suits = new Set(all.filter((tile) => !isFlower(tile)).map((tile) => tile.suit));
  return [...suits];
}

function hasOneDragon(tiles, fulu = []) {
  const all = [...tiles, ...fulu.flatMap((meld) => meld.cards)];
  const suitBuckets = {
    wan: new Set(),
    tiao: new Set(),
    tong: new Set()
  };
  all.forEach((tile) => {
    if (tile.suit === 'wan' || tile.suit === 'tiao' || tile.suit === 'tong') {
      suitBuckets[tile.suit].add(Number(tile.rank));
    }
  });
  return Object.values(suitBuckets).some((bucket) => bucket.size === 9);
}

function isAllTriples(tiles, fulu = []) {
  if (!canHu(tiles, fulu).standard) return false;
  const counts = countMap(tiles);
  const pairCount = [...counts.values()].filter((count) => count === 2).length;
  const invalid = [...counts.values()].some((count) => ![2, 3, 4].includes(count));
  const sequenceLike = tiles.some((tile) => {
    if (isHonor(tile) || isFlower(tile)) return false;
    const key1 = `${tile.suit}:${Number(tile.rank) + 1}`;
    const key2 = `${tile.suit}:${Number(tile.rank) + 2}`;
    return counts.has(key1) && counts.has(key2);
  });
  return pairCount === 1 && !invalid && !sequenceLike && fulu.every((meld) => ['peng', 'angang', 'minggang', 'bugang'].includes(meld.type));
}

function evaluateFan(tiles, fulu = [], flowers = [], context = {}) {
  const fanList = [];
  const suits = getSuits(tiles, fulu);
  const counts = countMap(tiles);
  const huCheck = canHu(tiles, fulu);
  const allTiles = [...tiles, ...fulu.flatMap((meld) => meld.cards)];

  if (!huCheck.canHu) {
    return { fanList: [], totalFan: 0, flowerFan: 0 };
  }

  if (fulu.length === 0) {
    fanList.push({ name: '门清', fan: 1 });
  }

  if (isAllTriples(tiles, fulu)) {
    fanList.push({ name: '对对胡', fan: 2 });
  }

  const hasHonors = allTiles.some((tile) => isHonor(tile));
  const suitOnly = suits.filter((suit) => ['wan', 'tiao', 'tong'].includes(suit));
  if (suitOnly.length === 1 && !hasHonors) {
    fanList.push({ name: '清一色', fan: 4 });
  } else if (suitOnly.length === 1 && hasHonors) {
    fanList.push({ name: '混一色', fan: 2 });
  }

  if (huCheck.sevenPairs) {
    const hasHonorsInPairs = [...counts.keys()].some((key) => key.startsWith('wind:') || key.startsWith('dragon:'));
    const hasQuad = [...counts.values()].some((value) => value === 4);
    if (hasQuad) {
      fanList.push({ name: '豪华七对', fan: 8 });
    } else if (hasHonorsInPairs) {
      fanList.push({ name: '混七对', fan: 2 });
    } else {
      fanList.push({ name: '七对', fan: 4 });
    }
  }

  if (hasOneDragon(allTiles)) {
    fanList.push({ name: '一条龙', fan: 2 });
  }

  if (fulu.length === 4 && tiles.filter((tile) => !isFlower(tile)).length <= 2) {
    fanList.push({ name: '全求人', fan: 1 });
  }

  if (context.winType === 'gangshanghua') {
    fanList.push({ name: '杠开', fan: 1 });
  }

  if (context.winType === 'qianggang') {
    fanList.push({ name: '抢杠', fan: 1 });
  }

  const flowerFan = flowers.length > 0 ? flowers.length : 1;
  if (flowers.length > 0) {
    fanList.push({ name: '花牌', fan: flowers.length });
  } else {
    fanList.push({ name: '无花', fan: 1 });
  }

  const totalFan = fanList.reduce((sum, item) => sum + item.fan, 0);
  return {
    fanList,
    totalFan,
    flowerFan
  };
}

module.exports = {
  evaluateFan
};
