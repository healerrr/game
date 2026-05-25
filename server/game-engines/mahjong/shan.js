const { shuffle } = require('../shared/cards');
const { createMahjongSet, isFlower } = require('./tiles');

class Shan {
  constructor(tiles = shuffle(createMahjongSet())) {
    this.tiles = [...tiles];
  }

  draw() {
    return this.tiles.pop() || null;
  }

  drawUntilPlayable() {
    const flowers = [];
    let tile = this.draw();
    while (tile && isFlower(tile)) {
      flowers.push(tile);
      tile = this.draw();
    }
    return { tile, flowers };
  }

  remaining() {
    return this.tiles.length;
  }

  snapshot() {
    return {
      tiles: [...this.tiles]
    };
  }

  static fromSnapshot(snapshot) {
    return new Shan(snapshot?.tiles || []);
  }
}

module.exports = { Shan };
