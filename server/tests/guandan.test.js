const test = require('node:test');
const assert = require('node:assert/strict');

const {
  identifyPattern,
  comparePattern,
  resolveRoundEnd
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

test('掼蛋升级结算支持双下', () => {
  const settlement = resolveRoundEnd(['p1', 'p3', 'p2', 'p4'], {
    south_north: ['p1', 'p3'],
    east_west: ['p2', 'p4']
  }, '2');
  assert.equal(settlement.levelUp, 3);
  assert.equal(settlement.nextLevel, '5');
});
