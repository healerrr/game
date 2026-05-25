'use strict';

const { sortTiles, tileKey, sameTile, isZhong } = require('./tiles');

function addTile(hand, tile) {
  if (!tile) return hand;
  return sortTiles([...hand, tile]);
}

function removeTile(hand, tile) {
  if (!tile || !hand || hand.length === 0) return null;
  const index = hand.findIndex((item) => item.id === tile.id || sameTile(item, tile));
  if (index === -1) return null;
  const next = [...hand];
  next.splice(index, 1);
  return sortTiles(next);
}

function countTile(hand, tile) {
  if (!hand || !tile) return 0;
  const key = tileKey(tile);
  return hand.filter((item) => tileKey(item) === key).length;
}

function groupTiles(hand) {
  if (!hand) return new Map();
  return hand.reduce((map, tile) => {
    const key = tileKey(tile);
    const item = map.get(key) || [];
    item.push(tile);
    map.set(key, item);
    return map;
  }, new Map());
}

// 暗杠选项：手牌中4张相同的牌可以暗杠
function findAnGangOptions(hand) {
  if (!hand || hand.length === 0) return [];
  return [...groupTiles(hand).values()]
    .filter((tiles) => tiles.length === 4)
    .map((tiles) => ({
      type: 'angang',
      tile: tiles[0],
      cards: tiles
    }));
}

// 补杠选项：已有碰的牌，手中再有一张可以补杠
// 红中只能杠红中本身
function findBuGangOptions(hand, fulu) {
  if (!hand || !fulu) return [];
  return fulu
    .filter((meld) => meld.type === 'peng')
    .flatMap((meld) => {
      const match = hand.find((tile) => sameTile(tile, meld.tile));
      return match ? [{
        type: 'bugang',
        tile: meld.tile,
        cards: [match]
      }] : [];
    });
}

// 碰选项：手牌中有2张与目标牌相同的牌
// 红中只能碰红中本身
function findPengOptions(hand, discardTile) {
  if (!hand || !discardTile) return [];
  const count = countTile(hand, discardTile);
  if (count >= 2) {
    const matching = hand.filter((t) => sameTile(t, discardTile)).slice(0, 2);
    return [{
      type: 'peng',
      tile: discardTile,
      cards: matching
    }];
  }
  return [];
}

// 明杠选项：手牌中有3张与目标牌相同的牌
function findMingGangOptions(hand, discardTile) {
  if (!hand || !discardTile) return [];
  const count = countTile(hand, discardTile);
  if (count >= 3) {
    const matching = hand.filter((t) => sameTile(t, discardTile)).slice(0, 3);
    return [{
      type: 'minggang',
      tile: discardTile,
      cards: matching
    }];
  }
  return [];
}

function createMeld(type, cards, fromPlayerId = null) {
  return {
    type,
    tile: cards[0],
    cards: [...cards],
    fromPlayerId
  };
}

module.exports = {
  addTile,
  removeTile,
  countTile,
  groupTiles,
  findAnGangOptions,
  findBuGangOptions,
  findPengOptions,
  findMingGangOptions,
  createMeld
};
