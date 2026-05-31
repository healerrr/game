const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ZhaJinHuaEngine,
  evaluateHand,
  compareHands,
  blindMultiplier,
  getRemainingBalance
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

test('炸金花房间准备完成后直接进入下注阶段', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  assert.equal(state.phase, 'bet');
  assert.equal(state.currentPlayer, 'p1');
  assert.deepEqual(state.actedThisRound, []);
});

test('炸金花开局前不能看牌', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init(null, ['p1', 'p2']);
  state.phase = 'look';

  engine.update(state, { type: 'peek' }, 'p1');

  assert.deepEqual(state.lookedPlayers, []);
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

test('炸金花跟注不能超过玩家剩余积分', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init({ playerBalances: { p1: 15, p2: 100 } }, ['p1', 'p2']);
  state.lookedPlayers = ['p1'];

  engine.update(state, { type: 'call' }, 'p1');
  assert.equal(state.playerBets.p1, 10);
  assert.equal(state.pot, 10);
  assert.equal(getRemainingBalance(state, 'p1'), 5);

  state.currentPlayer = 'p1';
  engine.update(state, { type: 'call' }, 'p1');
  assert.equal(state.playerBets.p1, 10);
  assert.equal(state.pot, 10);
  assert.equal(state.currentPlayer, 'p1');
});

test('炸金花加注不能超过玩家剩余积分', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init({ playerBalances: { p1: 15, p2: 100 } }, ['p1', 'p2']);
  state.lookedPlayers = ['p1', 'p2'];

  engine.update(state, { type: 'raise' }, 'p1');
  assert.equal(state.currentBet, 10);
  assert.equal(state.playerBets.p1, 0);
  assert.equal(state.pot, 0);
  assert.equal(state.currentPlayer, 'p1');
});

test('炸金花比牌不能超过玩家剩余积分', () => {
  const engine = new ZhaJinHuaEngine();
  const state = engine.init({ playerBalances: { p1: 25, p2: 100 } }, ['p1', 'p2']);
  state.lookedPlayers = ['p1', 'p2'];

  engine.update(state, { type: 'compare', targetId: 'p2' }, 'p1');
  assert.equal(state.playerBets.p1, 20);
  assert.equal(state.pot, 20);

  state.phase = 'bet';
  state.currentPlayer = 'p1';
  state.activePlayers = ['p1', 'p2'];
  engine.update(state, { type: 'compare', targetId: 'p2' }, 'p1');
  assert.equal(state.playerBets.p1, 20);
  assert.equal(state.pot, 20);
  assert.equal(state.currentPlayer, 'p1');
});
