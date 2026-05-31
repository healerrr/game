const test = require('node:test');
const assert = require('node:assert/strict');

const store = require('../store');

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
