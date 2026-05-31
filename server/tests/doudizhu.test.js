const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DoudizhuEngine,
  comparePattern,
  identifyPattern
} = require('../game-engines/doudizhu');

function card(rank, suit = 'spade') {
  return { rank, suit, value: rank === 'SJ' ? 17 : rank === 'BJ' ? 18 : 0, id: `${rank}-${suit}-${Math.random()}` };
}

test('斗地主识别王炸和普通炸弹', () => {
  const rocket = identifyPattern([
    card('SJ', 'joker'),
    card('BJ', 'joker')
  ]);
  const bomb = identifyPattern([
    card('7', 'spade'),
    card('7', 'heart'),
    card('7', 'club'),
    card('7', 'diamond')
  ]);

  assert.equal(rocket.type, 'rocket');
  assert.equal(bomb.type, 'bomb');
  assert.equal(comparePattern(rocket, bomb) > 0, true);
});

test('斗地主识别三带一、顺子和飞机带对', () => {
  assert.equal(identifyPattern([
    card('8', 'spade'),
    card('8', 'heart'),
    card('8', 'club'),
    card('K', 'spade')
  ]).type, 'triple_single');

  assert.equal(identifyPattern([
    card('3', 'spade'),
    card('4', 'heart'),
    card('5', 'club'),
    card('6', 'diamond'),
    card('7', 'spade')
  ]).type, 'straight');

  assert.equal(identifyPattern([
    card('6', 'spade'),
    card('6', 'heart'),
    card('6', 'club'),
    card('7', 'spade'),
    card('7', 'heart'),
    card('7', 'club'),
    card('9', 'spade'),
    card('9', 'heart'),
    card('J', 'spade'),
    card('J', 'heart')
  ]).type, 'airplane_pair');
});

test('斗地主初始化为三人发牌，地主拿到底牌', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  assert.equal(state.players.length, 3);
  assert.equal(state.landlord, 'p1');
  assert.equal(state.bottomCards.length, 3);
  assert.equal(state.hands.p1.length, 20);
  assert.equal(state.hands.p2.length, 17);
  assert.equal(state.hands.p3.length, 17);
  assert.equal(state.currentPlayer, 'p1');
});

test('斗地主地主先出完时只有地主获胜', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);
  state.landlord = 'p1';
  state.farmers = ['p2', 'p3'];
  state.hands = {
    p1: [card('3', 'spade')],
    p2: [card('4', 'spade')],
    p3: [card('5', 'spade')]
  };
  state.handCounts = { p1: 1, p2: 1, p3: 1 };
  state.currentPlayer = 'p1';

  engine.update(state, { type: 'play', cards: [state.hands.p1[0]] }, 'p1');

  assert.equal(state.phase, 'finished');
  assert.deepEqual(state.winningPlayers, ['p1']);
});
