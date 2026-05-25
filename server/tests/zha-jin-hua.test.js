const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ZhaJinHuaEngine,
  evaluateHand,
  compareHands,
  blindMultiplier
} = require('../game-engines/zha-jin-hua');

function card(rank, suit, value) {
  return { rank, suit, value };
}

test('炸金花牌型比较按豹子高于同花顺', () => {
  const leopard = evaluateHand([card('A', 'spade', 14), card('A', 'heart', 14), card('A', 'club', 14)]);
  const straightFlush = evaluateHand([card('A', 'spade', 14), card('K', 'spade', 13), card('Q', 'spade', 12)]);
  assert.equal(compareHands(leopard, straightFlush) > 0, true);
});

test('炸金花暗牌倍率为 2，明牌倍率为 1', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init(null, ['p1', 'p2']);
  assert.equal(blindMultiplier(state, 'p1'), 2);
  state.lookedPlayers.push('p1');
  assert.equal(blindMultiplier(state, 'p1'), 1);
});

test('炸金花比牌会淘汰失败玩家并结束', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init(null, ['p1', 'p2']);
  state.phase = 'bet';
  state.lookedPlayers = ['p1', 'p2'];
  state.hands.p1 = [card('A', 'spade', 14), card('A', 'heart', 14), card('A', 'club', 14)];
  state.hands.p2 = [card('K', 'spade', 13), card('Q', 'spade', 12), card('J', 'spade', 11)];
  const next = engine.update(state, { type: 'compare', targetId: 'p2' }, 'p1');
  assert.equal(next.phase, 'finished');
  assert.equal(next.finalWinner, 'p1');
  assert.deepEqual(next.activePlayers, ['p1']);
});
