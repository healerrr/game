const test = require('node:test');
const assert = require('node:assert/strict');

const { getEngine } = require('../game-engine');

test('dice_roll finishes as a draw when every active player times out', () => {
  const engine = getEngine('dice_roll');
  const state = engine.init(null, ['p1', 'p2']);

  engine.nextRound(state);

  assert.equal(state.phase, 'finished');
  assert.equal(state.finalWinner, null);
  assert.equal(state.winner, 'draw');
  assert.deepEqual(state.winningPlayers, []);
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].rolls.p1.timeout, true);
  assert.equal(state.history[0].rolls.p2.timeout, true);
});
