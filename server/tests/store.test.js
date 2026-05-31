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
