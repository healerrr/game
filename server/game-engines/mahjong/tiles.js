'use strict';

const SUITS = ['wan', 'tong', 'tiao'];

function createMahjongSet() {
  const tiles = [];
  let id = 0;
  // 万筒条各1-9，每种4张 = 108张
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let i = 0; i < 4; i++) {
        tiles.push({ id: id++, suit, rank });
      }
    }
  }
  // 红中4张
  for (let i = 0; i < 4; i++) {
    tiles.push({ id: id++, suit: 'zhong', rank: 'zhong' });
  }
  return tiles; // 共112张
}

function isZhong(tile) {
  return tile && tile.suit === 'zhong';
}

function isNumberTile(tile) {
  return tile && SUITS.includes(tile.suit);
}

function sameTile(a, b) {
  if (!a || !b) return false;
  return a.suit === b.suit && a.rank === b.rank;
}

function tileKey(tile) {
  if (!tile) return '';
  return `${tile.suit}:${tile.rank}`;
}

function sortTiles(tiles) {
  const suitOrder = { wan: 1, tong: 2, tiao: 3, zhong: 4 };
  return [...tiles].sort((a, b) => {
    const suitDiff = (suitOrder[a.suit] || 99) - (suitOrder[b.suit] || 99);
    if (suitDiff !== 0) return suitDiff;
    if (isNumberTile(a)) {
      return a.rank - b.rank;
    }
    return 0;
  });
}

module.exports = {
  SUITS,
  createMahjongSet,
  isZhong,
  isNumberTile,
  sameTile,
  tileKey,
  sortTiles
};
