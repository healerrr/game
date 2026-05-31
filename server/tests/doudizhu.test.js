const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DoudizhuEngine,
  comparePattern,
  identifyPattern,
  getDoudizhuScoreUnit
} = require('../game-engines/doudizhu');
const { getGameConfig } = require('../game-engine');

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

test('斗地主门票为50分', () => {
  assert.equal(getGameConfig('doudizhu').entryFee, 50);
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

test('斗地主初始化为三人发牌并保留三张底牌', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  assert.equal(state.players.length, 3);
  assert.equal(state.phase, 'bid');
  assert.equal(state.landlord, null);
  assert.equal(state.bottomCards.length, 3);
  assert.equal(state.hands.p1.length, 17);
  assert.equal(state.hands.p2.length, 17);
  assert.equal(state.hands.p3.length, 17);
  assert.equal(state.currentPlayer, 'p1');
});

test('斗地主抢地主成功后地主获得三张底牌并先出', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  engine.update(state, { type: 'bid', score: 1 }, 'p1');
  engine.update(state, { type: 'bid', score: 2 }, 'p2');
  engine.update(state, { type: 'pass' }, 'p3');
  engine.update(state, { type: 'pass' }, 'p1');

  assert.equal(state.phase, 'play');
  assert.equal(state.landlord, 'p2');
  assert.deepEqual(state.farmers, ['p1', 'p3']);
  assert.equal(state.bottomCards.length, 3);
  assert.equal(state.hands.p2.length, 20);
  assert.equal(state.hands.p1.length, 17);
  assert.equal(state.hands.p3.length, 17);
  assert.equal(state.currentPlayer, 'p2');
});

test('斗地主叫三分立即成为地主', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  engine.update(state, { type: 'bid', score: 3 }, 'p1');

  assert.equal(state.phase, 'play');
  assert.equal(state.landlord, 'p1');
  assert.equal(state.hands.p1.length, 20);
  assert.equal(state.currentPlayer, 'p1');
});

test('斗地主三家不叫时重新发牌继续抢地主', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  engine.update(state, { type: 'pass' }, 'p1');
  engine.update(state, { type: 'pass' }, 'p2');
  engine.update(state, { type: 'pass' }, 'p3');

  assert.equal(state.phase, 'bid');
  assert.equal(state.redealCount, 1);
  assert.equal(state.landlord, null);
  assert.equal(state.bottomCards.length, 3);
  assert.equal(state.hands.p1.length, 17);
  assert.equal(state.hands.p2.length, 17);
  assert.equal(state.hands.p3.length, 17);
  assert.equal(state.currentPlayer, 'p1');
});

test('斗地主地主先出完时只有地主获胜', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);
  state.phase = 'play';
  state.stage = 'play';
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

test('斗地主每个炸弹和王炸都会把结算底分加50', () => {
  const engine = new DoudizhuEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3']);
  state.phase = 'play';
  state.stage = 'play';
  state.landlord = 'p1';
  state.farmers = ['p2', 'p3'];
  state.hands = {
    p1: [
      card('7', 'spade'), card('7', 'heart'), card('7', 'club'), card('7', 'diamond'),
      card('3', 'spade')
    ],
    p2: [
      card('8', 'spade'), card('8', 'heart'), card('8', 'club'), card('8', 'diamond'),
      card('4', 'spade')
    ],
    p3: [
      card('SJ', 'joker'), card('BJ', 'joker'),
      card('5', 'spade')
    ]
  };
  state.handCounts = { p1: 5, p2: 5, p3: 3 };
  state.currentPlayer = 'p1';
  state.lastPattern = null;
  state.finishedOrder = [];
  state.bombCount = 0;
  state.scoreUnit = 50;

  engine.update(state, { type: 'play', cards: state.hands.p1.slice(0, 4) }, 'p1');
  engine.update(state, { type: 'play', cards: state.hands.p2.slice(0, 4) }, 'p2');
  engine.update(state, { type: 'play', cards: state.hands.p3.slice(0, 2) }, 'p3');

  assert.equal(state.bombCount, 3);
  assert.equal(state.scoreUnit, 200);
  assert.equal(getDoudizhuScoreUnit(state, 50), 200);
});
