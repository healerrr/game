const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GuandanEngine,
  identifyPattern,
  comparePattern,
  resolveRoundEnd,
  getLevelScore
} = require('../game-engines/guandan');

function card(rank, suit, value) {
  return { rank, suit, value, id: `${rank}-${suit}-${Math.random()}` };
}

test('掼蛋识别火箭和炸弹', () => {
  const rocket = identifyPattern([
    { rank: 'SJ', suit: 'joker', value: 16 },
    { rank: 'SJ', suit: 'joker', value: 16 },
    { rank: 'BJ', suit: 'joker', value: 17 },
    { rank: 'BJ', suit: 'joker', value: 17 }
  ], '2');
  const bomb = identifyPattern([
    card('7', 'spade', 7),
    card('7', 'heart', 7),
    card('7', 'club', 7),
    card('7', 'diamond', 7)
  ], '2');
  assert.equal(rocket.type, 'rocket');
  assert.equal(bomb.type, 'bomb');
  assert.equal(comparePattern(rocket, bomb) > 0, true);
});

test('掼蛋识别三带二', () => {
  const pattern = identifyPattern([
    card('8', 'spade', 8),
    card('8', 'heart', 8),
    card('8', 'club', 8),
    card('5', 'spade', 5),
    card('5', 'heart', 5)
  ], '2');
  assert.equal(pattern.type, 'triple_pair');
});

test('guandan ignores malformed played cards without throwing', () => {
  const engine = new GuandanEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  state.hands = {
    p1: [card('3', 'spade', 3)],
    p2: [card('4', 'spade', 4)],
    p3: [card('5', 'spade', 5)],
    p4: [card('6', 'spade', 6)]
  };
  state.handCounts = { p1: 1, p2: 1, p3: 1, p4: 1 };
  state.currentPlayer = 'p1';

  assert.equal(identifyPattern([null], '2'), null);
  assert.doesNotThrow(() => engine.update(state, { type: 'play', cards: [null] }, 'p1'));
  assert.equal(state.currentPlayer, 'p1');
  assert.equal(state.hands.p1.length, 1);
});

test('掼蛋升级结算支持双下', () => {
  const settlement = resolveRoundEnd(['p1', 'p3', 'p2', 'p4'], {
    south_north: ['p1', 'p3'],
    east_west: ['p2', 'p4']
  }, '2');
  assert.equal(settlement.levelUp, 3);
  assert.equal(settlement.nextLevel, '5');
});

test('掼蛋出完的玩家不再重新拿到回合', () => {
  const engine = new GuandanEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  state.hands = {
    p1: [card('3', 'spade', 3)],
    p2: [card('4', 'spade', 4), card('5', 'spade', 5)],
    p3: [card('6', 'spade', 6), card('7', 'spade', 7)],
    p4: [card('8', 'spade', 8), card('9', 'spade', 9)]
  };
  state.handCounts = Object.fromEntries(Object.entries(state.hands).map(([pid, hand]) => [pid, hand.length]));
  state.currentPlayer = 'p1';

  engine.update(state, { type: 'play', cards: [state.hands.p1[0]] }, 'p1');
  assert.deepEqual(state.finishedOrder, ['p1']);
  assert.equal(state.currentPlayer, 'p2');
  assert.equal(state.handCounts.p1, 0);

  engine.update(state, { type: 'pass' }, 'p2');
  engine.update(state, { type: 'pass' }, 'p3');
  engine.update(state, { type: 'pass' }, 'p4');

  assert.equal(state.currentPlayer, 'p2');
  assert.equal(state.lastPattern, null);
  assert.equal(state.lastLeadPlayer, null);
});

test('Guandan tracks team levels and only finishes after a team reaches 1', () => {
  const settlement = resolveRoundEnd(['p1', 'p2', 'p3', 'p4'], {
    south_north: ['p1', 'p3'],
    east_west: ['p2', 'p4']
  }, { south_north: '3', east_west: '2' });

  assert.equal(settlement.winnerTeam, 'south_north');
  assert.equal(settlement.levelUp, 2);
  assert.equal(settlement.nextLevel, '5');
  assert.equal(settlement.teamLevels.south_north, '5');
  assert.equal(settlement.teamLevels.east_west, '2');
  assert.equal(settlement.matchFinished, false);
});

test('Guandan reaches final level 1 and scores level difference from 1 as 13', () => {
  const settlement = resolveRoundEnd(['p1', 'p2', 'p3', 'p4'], {
    south_north: ['p1', 'p3'],
    east_west: ['p2', 'p4']
  }, { south_north: 'K', east_west: '3' });

  assert.equal(settlement.nextLevel, '1');
  assert.equal(settlement.matchFinished, true);
  assert.equal(getLevelScore(settlement.nextLevel) - getLevelScore('3'), 10);
});

test('Guandan hand end advances to next hand until final match settlement', () => {
  const engine = new GuandanEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  state.hands = {
    p1: [card('3', 'spade', 3)],
    p2: [card('4', 'spade', 4)],
    p3: [card('5', 'spade', 5)],
    p4: [card('6', 'spade', 6), card('7', 'spade', 7)]
  };
  state.currentPlayer = 'p1';
  state.handCounts = Object.fromEntries(Object.entries(state.hands).map(([pid, hand]) => [pid, hand.length]));

  engine.update(state, { type: 'play', cards: [state.hands.p1[0]] }, 'p1');
  engine.update(state, { type: 'play', cards: [state.hands.p2[0]] }, 'p2');
  engine.update(state, { type: 'play', cards: [state.hands.p3[0]] }, 'p3');

  assert.equal(state.phase, 'round_finished');
  assert.equal(state.teamLevels.south_north, '4');
  assert.deepEqual(state.winningPlayers, ['p1', 'p3']);

  const next = engine.nextRound(state);
  assert.equal(next.phase, 'play');
  assert.equal(next.level, '4');
  assert.equal(next.teamLevels.south_north, '4');
  assert.equal(next.round, 2);
});
