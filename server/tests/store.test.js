const test = require('node:test');
const assert = require('node:assert/strict');

const store = require('../store');
const { getBlockingRoom } = require('../index');

test('同名玩家再次注册会复用已有账号', () => {
  const nickname = `重复玩家 ${Date.now()}`;
  const player = store.createPlayer(nickname, 1);
  player.points = 1666;
  store.savePlayer(player);

  const loggedIn = store.createPlayer(`  ${nickname.toLocaleUpperCase()}  `, 2);

  assert.equal(loggedIn.id, player.id);
  assert.equal(loggedIn.points, 1666);
  assert.equal(loggedIn.busNumber, 1);
  assert.equal(store.findPlayerByNickname(nickname)?.id, player.id);

  store.removePlayer(player.id);
});

test('同一局战绩重复写入时只保留一条', async () => {
  const player = store.createPlayer(`战绩去重玩家 ${Date.now()}`, 1);
  const baseRecord = {
    playerId: player.id,
    roomId: `room_${Date.now()}`,
    gameType: 'gomoku',
    gameName: '五子棋',
    result: 'win',
    opponents: [],
    teammates: [],
    createdAt: Date.now()
  };

  store.recordGameRecord({
    ...baseRecord,
    scoreDelta: 30,
    pointsBefore: 1000,
    pointsAfter: 1030
  });
  store.recordGameRecord({
    ...baseRecord,
    scoreDelta: 30,
    pointsBefore: 1000,
    pointsAfter: 1030,
    createdAt: Date.now() + 1000
  });

  const records = await store.getPlayerGameRecords(player.id, 10);
  const matching = records.filter((record) => (
    record.roomId === baseRecord.roomId &&
    record.playerId === player.id &&
    record.gameType === baseRecord.gameType
  ));

  assert.equal(matching.length, 1);
  store.removePlayer(player.id);
});

test('settled stale rooms do not keep players blocked', () => {
  const player = store.createPlayer(`stale-room-player-${Date.now()}`, 1);
  const opponent = store.createPlayer(`stale-room-opponent-${Date.now()}`, 1);
  const room = store.createRoom('gomoku', [player, opponent], { status: 'playing' });

  room.gameState = {
    phase: 'finished',
    finalWinner: player.id,
    winningPlayers: [player.id]
  };
  room.settlementApplied = true;
  store.saveRoom(room);

  assert.equal(getBlockingRoom(player.id), null);
  assert.equal(store.getPlayer(player.id).currentRoom, null);
  assert.equal(store.getRoom(room.id).status, 'finished');

  store.removeRoom(room.id);
  store.removePlayer(player.id);
  store.removePlayer(opponent.id);
});

test('missing current room pointer is cleared instead of blocking the player', () => {
  const player = store.createPlayer(`missing-room-player-${Date.now()}`, 1);
  player.currentRoom = `missing-room-${Date.now()}`;
  store.savePlayer(player);

  assert.equal(getBlockingRoom(player.id), null);
  assert.equal(store.getPlayer(player.id).currentRoom, null);

  store.removePlayer(player.id);
});

test('finished room status clears stale player currentRoom pointers', () => {
  const player = store.createPlayer(`finished-room-player-${Date.now()}`, 1);
  const opponent = store.createPlayer(`finished-room-opponent-${Date.now()}`, 1);
  const room = store.createRoom('gomoku', [player, opponent], { status: 'playing' });

  room.status = 'finished';
  room.gameState = { phase: 'finished', finalWinner: player.id, winningPlayers: [player.id] };
  store.saveRoom(room);

  assert.equal(getBlockingRoom(player.id), null);
  assert.equal(store.getPlayer(player.id).currentRoom, null);
  assert.equal(store.getPlayer(opponent.id).currentRoom, null);

  store.removeRoom(room.id);
  store.removePlayer(player.id);
  store.removePlayer(opponent.id);
});

test('idle ready rooms expire instead of blocking new games', () => {
  const player = store.createPlayer(`idle-ready-player-${Date.now()}`, 1);
  const room = store.createRoom('reaction_race', [player], {
    mode: 'quick',
    visibility: 'public'
  });

  room.updatedAt = Date.now() - (11 * 60 * 1000);
  room.createdAt = room.updatedAt;
  store.saveRoom(room);

  assert.equal(getBlockingRoom(player.id), null);
  assert.equal(store.getPlayer(player.id).currentRoom, null);
  assert.equal(store.getRoom(room.id), undefined);

  store.removePlayer(player.id);
});
