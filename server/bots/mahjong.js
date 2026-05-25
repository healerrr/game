const { getWaitTiles } = require('../game-engines/mahjong/hule');
const { sameTile, isHonor } = require('../game-engines/mahjong/tiles');

function tileScore(tile, hand) {
  let score = 0;
  const sameCount = hand.filter((item) => sameTile(item, tile)).length;
  score += sameCount * 2;
  if (!isHonor(tile)) {
    const rank = Number(tile.rank);
    const left1 = hand.some((item) => item.suit === tile.suit && Number(item.rank) === rank - 1);
    const right1 = hand.some((item) => item.suit === tile.suit && Number(item.rank) === rank + 1);
    const left2 = hand.some((item) => item.suit === tile.suit && Number(item.rank) === rank - 2);
    const right2 = hand.some((item) => item.suit === tile.suit && Number(item.rank) === rank + 2);
    if (left1 || right1) score += 2;
    if (left2 || right2) score += 1;
  }
  return score;
}

function chooseDiscard(hand, fulu) {
  const options = hand.map((tile, index) => {
    const nextHand = [...hand];
    nextHand.splice(index, 1);
    const waits = getWaitTiles(nextHand, fulu);
    return {
      tile,
      waits: waits.length,
      score: tileScore(tile, hand)
    };
  });

  return options.sort((a, b) => {
    if (a.waits !== b.waits) return b.waits - a.waits;
    return a.score - b.score;
  })[0]?.tile || hand[0];
}

function mahjongStrategy(state, botId) {
  if (state.phase === 'draw' && state.currentPlayer === botId) {
    return { type: 'draw' };
  }

  if (state.phase === 'discard' && state.currentPlayer === botId) {
    const hand = state.hands[botId] || [];
    if (!hand.length) return null;
    return { type: 'discard', card: chooseDiscard(hand, state.fulu[botId] || []) };
  }

  if (state.phase === 'response') {
    const pending = state.pendingAction;
    if (!pending) return null;
    if (pending.type === 'self' && pending.playerId === botId) {
      if (pending.options.some((item) => item.action === 'hu')) return { type: 'hu' };
      return { type: 'pass' };
    }
    const current = pending.queue?.[0];
    if (current?.playerId === botId) {
      if (current.action === 'hu') return { type: 'hu' };
      if (current.action === 'gang') return { type: 'gang' };
      if (current.action === 'peng') return { type: 'pass' };
    }
  }

  return null;
}

module.exports = { mahjongStrategy, chooseDiscard };
