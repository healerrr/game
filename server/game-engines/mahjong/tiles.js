const FLOWERS = [
  { rank: 'spring', label: '春' },
  { rank: 'summer', label: '夏' },
  { rank: 'autumn', label: '秋' },
  { rank: 'winter', label: '冬' },
  { rank: 'plum', label: '梅' },
  { rank: 'orchid', label: '兰' },
  { rank: 'bamboo', label: '竹' },
  { rank: 'chrysanthemum', label: '菊' }
];

const WINDS = ['east', 'south', 'west', 'north'];
const DRAGONS = ['red', 'green', 'white'];
const SUITS = ['wan', 'tiao', 'tong'];

function tileId(suit, rank, copyIndex) {
  return `${suit}-${rank}-${copyIndex}`;
}

function createMahjongSet() {
  const tiles = [];
  SUITS.forEach((suit) => {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let copy = 0; copy < 4; copy += 1) {
        tiles.push({
          id: tileId(suit, String(rank), copy),
          suit,
          rank: String(rank),
          label: `${rank}${suit}`
        });
      }
    }
  });

  WINDS.forEach((rank) => {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({
        id: tileId('wind', rank, copy),
        suit: 'wind',
        rank,
        label: rank
      });
    }
  });

  DRAGONS.forEach((rank) => {
    for (let copy = 0; copy < 4; copy += 1) {
      tiles.push({
        id: tileId('dragon', rank, copy),
        suit: 'dragon',
        rank,
        label: rank
      });
    }
  });

  FLOWERS.forEach((flower, copy) => {
    tiles.push({
      id: tileId('flower', flower.rank, copy),
      suit: 'flower',
      rank: flower.rank,
      label: flower.label
    });
  });

  return tiles;
}

function isFlower(tile) {
  return tile?.suit === 'flower';
}

function isHonor(tile) {
  return tile?.suit === 'wind' || tile?.suit === 'dragon';
}

function tileKey(tile) {
  return tile ? `${tile.suit}:${tile.rank}` : '';
}

function sameTile(a, b) {
  return tileKey(a) === tileKey(b);
}

function sortTiles(tiles) {
  const suitOrder = { wan: 1, tiao: 2, tong: 3, wind: 4, dragon: 5, flower: 6 };
  const windOrder = { east: 1, south: 2, west: 3, north: 4 };
  const dragonOrder = { red: 1, green: 2, white: 3 };
  const flowerOrder = {
    spring: 1,
    summer: 2,
    autumn: 3,
    winter: 4,
    plum: 5,
    orchid: 6,
    bamboo: 7,
    chrysanthemum: 8
  };

  return [...tiles].sort((a, b) => {
    const suitDiff = suitOrder[a.suit] - suitOrder[b.suit];
    if (suitDiff !== 0) return suitDiff;
    if (a.suit === 'wan' || a.suit === 'tiao' || a.suit === 'tong') {
      return Number(a.rank) - Number(b.rank);
    }
    if (a.suit === 'wind') return windOrder[a.rank] - windOrder[b.rank];
    if (a.suit === 'dragon') return dragonOrder[a.rank] - dragonOrder[b.rank];
    return flowerOrder[a.rank] - flowerOrder[b.rank];
  });
}

function allWinningTileTypes() {
  return createMahjongSet().filter((tile) => !isFlower(tile)).reduce((map, tile) => {
    map.set(tileKey(tile), tile);
    return map;
  }, new Map());
}

module.exports = {
  SUITS,
  WINDS,
  DRAGONS,
  FLOWERS,
  createMahjongSet,
  isFlower,
  isHonor,
  tileKey,
  sameTile,
  sortTiles,
  allWinningTileTypes
};
