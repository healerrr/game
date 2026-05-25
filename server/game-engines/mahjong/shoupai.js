const { sortTiles, tileKey, sameTile } = require('./tiles');

function addTile(hand, tile) {
  return sortTiles([...hand, tile]);
}

function removeTile(hand, tile) {
  const index = hand.findIndex((item) => item.id === tile.id || sameTile(item, tile));
  if (index === -1) return null;
  const next = [...hand];
  next.splice(index, 1);
  return sortTiles(next);
}

function countTile(hand, tile) {
  const key = tileKey(tile);
  return hand.filter((item) => tileKey(item) === key).length;
}

function groupTiles(hand) {
  return hand.reduce((map, tile) => {
    const key = tileKey(tile);
    const item = map.get(key) || [];
    item.push(tile);
    map.set(key, item);
    return map;
  }, new Map());
}

function findAnGangOptions(hand) {
  return [...groupTiles(hand).values()]
    .filter((tiles) => tiles.length === 4)
    .map((tiles) => ({
      type: 'angang',
      tile: tiles[0],
      cards: tiles
    }));
}

function findBuGangOptions(hand, fulu) {
  return fulu
    .filter((meld) => meld.type === 'peng')
    .flatMap((meld) => {
      const match = hand.find((tile) => tileKey(tile) === tileKey(meld.tile));
      return match ? [{
        type: 'bugang',
        tile: meld.tile,
        cards: [match]
      }] : [];
    });
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
  createMeld
};
