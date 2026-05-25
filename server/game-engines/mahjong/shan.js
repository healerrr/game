'use strict';

const { shuffle } = require('../shared/cards');
const { createMahjongSet } = require('./tiles');

class Shan {
  constructor(tiles = shuffle(createMahjongSet())) {
    this.tiles = [...tiles];
  }

  // 从牌山顶摸一张牌
  draw() {
    if (this.tiles.length === 0) return null;
    return this.tiles.pop();
  }

  // 返回剩余牌数
  remaining() {
    return this.tiles.length;
  }

  // 是否还有牌可摸
  isEmpty() {
    return this.tiles.length === 0;
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
