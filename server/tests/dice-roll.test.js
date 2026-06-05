const test = require('node:test');
const assert = require('node:assert/strict');

const { getEngine } = require('../game-engine');
const store = require('../store');
const { handleActionTimeout } = require('../index');

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

test('dice_roll multiplayer draw settlement does not charge every player', async () => {
  const engine = getEngine('dice_roll');
  const roomId = `room-dice-draw-${Date.now()}`;
  const players = ['dice-draw-p1', 'dice-draw-p2', 'dice-draw-p3'];

  players.forEach((id) => {
    store.savePlayer({
      id,
      nickname: id,
      busNumber: 1,
      points: 1000,
      totalGames: 0,
      wins: 0,
      winStreak: 0,
      lossStreak: 0,
      online: true,
      currentRoom: roomId
    });
  });

  const room = {
    id: roomId,
    gameType: 'dice_roll',
    status: 'playing',
    mode: 'quick',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: engine.init(null, players)
  };
  room.gameState.timer = 1;
  room.gameState.timerStarted = Date.now() - 2000;
  store.saveRoom(room);

  handleActionTimeout(room);

  assert.equal(room.status, 'finished');
  assert.equal(room.gameState.winner, 'draw');
  players.forEach((id) => {
    const player = store.getPlayer(id);
    assert.equal(player.points, 1000);
    assert.equal(player.totalGames, 1);
    assert.equal(player.wins, 0);
    assert.equal(player.winStreak, 0);
    assert.equal(player.lossStreak, 0);
  });

  const records = await store.getPlayerGameRecords(players[0], 1);
  assert.equal(records[0].result, 'draw');
  assert.equal(records[0].scoreDelta, 0);

  store.removeRoom(roomId);
  players.forEach(id => store.removePlayer(id));
});
