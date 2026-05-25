const { isFlower, tileKey, isHonor, allWinningTileTypes } = require('./tiles');

function toCounts(tiles) {
  return tiles.reduce((map, tile) => {
    if (isFlower(tile)) return map;
    const key = tileKey(tile);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function parseKey(key) {
  const [suit, rank] = key.split(':');
  return { suit, rank };
}

function nextSuitKey(tile, delta) {
  return `${tile.suit}:${Number(tile.rank) + delta}`;
}

function cloneCounts(counts) {
  return new Map(counts);
}

function firstNonZero(counts) {
  for (const [key, value] of counts.entries()) {
    if (value > 0) return key;
  }
  return null;
}

function reduceCount(counts, key, amount = 1) {
  const next = cloneCounts(counts);
  const current = next.get(key) || 0;
  if (current < amount) return null;
  const remaining = current - amount;
  if (remaining === 0) next.delete(key);
  else next.set(key, remaining);
  return next;
}

function canFormSets(counts, neededSets) {
  if (neededSets === 0) return counts.size === 0;
  const key = firstNonZero(counts);
  if (!key) return neededSets === 0;
  const tile = parseKey(key);

  const tripleCounts = reduceCount(counts, key, 3);
  if (tripleCounts && canFormSets(tripleCounts, neededSets - 1)) {
    return true;
  }

  if (!isHonor(tile)) {
    const key2 = nextSuitKey(tile, 1);
    const key3 = nextSuitKey(tile, 2);
    if ((counts.get(key2) || 0) > 0 && (counts.get(key3) || 0) > 0) {
      let next = reduceCount(counts, key, 1);
      next = reduceCount(next, key2, 1);
      next = reduceCount(next, key3, 1);
      if (next && canFormSets(next, neededSets - 1)) {
        return true;
      }
    }
  }

  return false;
}

function checkStandardHu(tiles, meldCount = 0) {
  const cleanTiles = tiles.filter((tile) => !isFlower(tile));
  const expectedLength = 14 - meldCount * 3;
  if (cleanTiles.length !== expectedLength) return false;
  const counts = toCounts(cleanTiles);
  const neededSets = 4 - meldCount;

  for (const [key, value] of counts.entries()) {
    if (value < 2) continue;
    const remaining = reduceCount(counts, key, 2);
    if (remaining && canFormSets(remaining, neededSets)) {
      return true;
    }
  }

  return false;
}

function checkSevenPairs(tiles, meldCount = 0) {
  if (meldCount > 0) return false;
  const cleanTiles = tiles.filter((tile) => !isFlower(tile));
  if (cleanTiles.length !== 14) return false;
  const counts = toCounts(cleanTiles);
  return [...counts.values()].every((value) => value === 2 || value === 4);
}

function getWaitTiles(tiles, fulu = []) {
  const waits = [];
  const candidates = [...allWinningTileTypes().values()];
  candidates.forEach((tile) => {
    const test = [...tiles, tile];
    if (canHu(test, fulu).canHu) {
      waits.push(tile);
    }
  });
  return waits;
}

function canHu(tiles, fulu = []) {
  const meldCount = fulu.length;
  const standard = checkStandardHu(tiles, meldCount);
  const sevenPairs = checkSevenPairs(tiles, meldCount);
  return {
    canHu: standard || sevenPairs,
    standard,
    sevenPairs
  };
}

module.exports = {
  checkStandardHu,
  checkSevenPairs,
  canHu,
  getWaitTiles
};
