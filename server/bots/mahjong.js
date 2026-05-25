const { canHu, getWaitTiles } = require('../game-engines/mahjong/hule');
const { sameTile, isZhong, isNumberTile } = require('../game-engines/mahjong/tiles');

function tileScore(tile, hand) {
  // 红中永远不主动打出（除非只剩红中），百搭万能牌价值最高
  if (isZhong(tile)) return 999;

  let score = 0;
  const sameCount = hand.filter((item) => sameTile(item, tile)).length;
  score += sameCount * 2;

  if (isNumberTile(tile)) {
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
  // 如果只剩红中，只能打红中
  const nonZhong = hand.filter(t => !isZhong(t));
  if (nonZhong.length === 0) {
    return hand[0]; // 只剩红中，被迫打出
  }

  const options = hand.map((tile, index) => {
    // 红中永远不打出（除非只剩红中）
    if (isZhong(tile)) return { tile, waits: -1, score: 999 };

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
    // 红中排最后（不打出）
    if (isZhong(a.tile) && !isZhong(b.tile)) return 1;
    if (!isZhong(a.tile) && isZhong(b.tile)) return -1;
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
      // 暗杠和补杠也执行
      const angangOpt = pending.options.find((item) => item.action === 'angang');
      if (angangOpt) return { type: 'angang', tile: angangOpt.tile };
      const bugangOpt = pending.options.find((item) => item.action === 'bugang');
      if (bugangOpt) return { type: 'bugang', tile: bugangOpt.tile };
      return { type: 'pass' };
    }

    if (pending.type === 'qianggang') {
      const current = pending.queue?.[0];
      if (current?.playerId === botId) {
        // 能抢杠胡就抢
        return { type: 'hu' };
      }
    }

    if (pending.type === 'claim') {
      const current = pending.queue?.[0];
      if (current?.playerId === botId) {
        if (current.action === 'hu') return { type: 'hu' };
        if (current.action === 'gang') return { type: 'gang' };
        if (current.action === 'peng') return { type: 'peng' };
      }
    }
  }

  return null;
}

module.exports = { mahjongStrategy, chooseDiscard };
