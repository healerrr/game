const test = require('node:test');
const assert = require('node:assert/strict');

const { canHu, getWaitTiles, checkSevenPairs } = require('../game-engines/mahjong/hule');
const { evaluateFan } = require('../game-engines/mahjong/fan');
const { MahjongEngine } = require('../game-engines/mahjong/index');
const store = require('../store');
const { handleActionTimeout } = require('../index');

let nextId = 0;
function tile(suit, rank) {
  return { suit, rank, id: nextId++ };
}

// ============ 胡牌判定 ============

test('红中推倒胡 - 标准胡牌判定成立', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('zhong', 'zhong'), tile('zhong', 'zhong')
  ];
  assert.equal(canHu(hand, []), true);
});

test('红中推倒胡 - 红中作百搭胡牌', () => {
  // 红中替代一张万子完成面子
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('zhong', 'zhong'),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('tiao', 9), tile('tiao', 9)
  ];
  assert.equal(canHu(hand, []), true);
});

test('红中推倒胡 - 可计算听牌张', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('zhong', 'zhong'), tile('zhong', 'zhong')
  ];
  const waits = getWaitTiles(hand, []);
  assert.equal(waits.length > 0, true);
});

test('红中推倒胡 - 不能胡的牌判定为false', () => {
  const hand = [
    tile('wan', 1), tile('wan', 2), tile('wan', 3),
    tile('wan', 4), tile('wan', 5), tile('wan', 6),
    tile('tong', 1), tile('tong', 3), tile('tong', 5),
    tile('tong', 7), tile('tong', 9), tile('tiao', 1),
    tile('tiao', 3), tile('tiao', 5)
  ];
  assert.equal(canHu(hand, []), false);
});

// ============ 番型计算 ============

test('红中推倒胡 - 平胡自摸不额外加番', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('zhong', 'zhong'), tile('zhong', 'zhong')
  ];
  const result = evaluateFan(hand, [], tile('wan', 1), 'zimo');
  assert.equal(result.fan, 1);
  const names = result.detail.map(d => d.name);
  assert.equal(names.includes('平胡'), true);
});

test('红中推倒胡 - 清一色', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('wan', 8), tile('wan', 8), tile('wan', 8),
    tile('wan', 9), tile('wan', 9)
  ];
  const result = evaluateFan(hand, [], tile('wan', 9), 'dianpao');
  const names = result.detail.map(d => d.name);
  assert.equal(names.includes('清一色'), true);
  assert.equal(names.includes('杀鬼(无红中)'), true);
  assert.equal(result.fan, 6);
});

test('红中推倒胡 - 七对', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1),
    tile('wan', 3), tile('wan', 3),
    tile('wan', 5), tile('wan', 5),
    tile('tong', 2), tile('tong', 2),
    tile('tong', 7), tile('tong', 7),
    tile('tiao', 4), tile('tiao', 4),
    tile('tiao', 9), tile('tiao', 9)
  ];
  const result = evaluateFan(hand, [], tile('tiao', 9), 'zimo');
  const names = result.detail.map(d => d.name);
  assert.equal(names.includes('七对'), true);
  assert.equal(names.includes('杀鬼(无红中)'), true);
  assert.equal(result.fan, 6);
});

test('红中推倒胡 - 杀鬼(无红中胡)番数翻倍', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('tiao', 9), tile('tiao', 9)
  ];
  const result = evaluateFan(hand, [], tile('tiao', 9), 'dianpao');
  const names = result.detail.map(d => d.name);
  assert.equal(names.includes('杀鬼(无红中)'), true);
  assert.equal(result.fan, 2);
});

test('红中推倒胡 - 四红中', () => {
  // 手牌中有1张红中 + 副露中有3张红中 = 总共4张
  const fulu = [{ type: 'peng', tile: tile('zhong', 'zhong'), cards: [tile('zhong', 'zhong'), tile('zhong', 'zhong'), tile('zhong', 'zhong')], fromPlayerId: 'other' }];
  const smallHand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('zhong', 'zhong')
  ];
  const result = evaluateFan(smallHand, fulu, tile('tong', 2), 'zimo');
  const names = result.detail.map(d => d.name);
  assert.equal(names.includes('四红中'), true);
  assert.equal(result.fan, 4);
});

test('红中推倒胡 - 天胡和地胡番数', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('zhong', 'zhong'), tile('zhong', 'zhong')
  ];

  const tianhu = evaluateFan(hand, [], tile('zhong', 'zhong'), 'tianhu');
  const dihu = evaluateFan(hand, [], tile('zhong', 'zhong'), 'dihu');

  assert.equal(tianhu.fan, 5);
  assert.equal(tianhu.detail.map(d => d.name).includes('天胡'), true);
  assert.equal(dihu.fan, 4);
  assert.equal(dihu.detail.map(d => d.name).includes('地胡'), true);
});

// ============ 引擎流程 ============

test('红中推倒胡 - 引擎初始化正确', () => {
  const engine = new MahjongEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  assert.equal(['discard', 'response', 'finished'].includes(state.phase), true);
  assert.equal(state.players.length, 4);
  assert.equal(state.hands['p1'].length, 14);
  assert.equal(state.hands['p2'].length, 13);
  assert.equal(state.remainingTiles, 59);
  assert.equal(state.currentPlayer, 'p1');
});

test('红中推倒胡 - 轮到玩家时自动摸牌', () => {
  const engine = new MahjongEngine();
  let state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  const remaining = state.remainingTiles;
  state = engine.update(state, { type: 'draw' }, 'p1');
  assert.equal(state.hands['p1'].length, 14);
  assert.equal(state.remainingTiles, remaining);
});

test('红中推倒胡 - 出牌后手牌减少', () => {
  const engine = new MahjongEngine();
  let state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  if (state.phase === 'response' && state.pendingAction?.type === 'self') {
    state = engine.update(state, { type: 'pass' }, 'p1');
  }
  const card = state.hands['p1'][0];
  state = engine.update(state, { type: 'discard', card }, 'p1');
  assert.equal(state.hands['p1'].length, 13);
  assert.equal(state.discards['p1'].length, 1);
});

test('红中推倒胡 - 无红中杠上开花清一色按固定50分结算', () => {
  const engine = new MahjongEngine();
  let state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  state.phase = 'response';
  state.currentPlayer = 'p1';
  state.dealer = 'p1';
  state.scores = { p1: 0, p2: 0, p3: 0, p4: 0 };
  state.fulu = { p1: [], p2: [], p3: [], p4: [] };
  state.hands.p1 = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('wan', 7), tile('wan', 8), tile('wan', 9),
    tile('wan', 9), tile('wan', 9)
  ];
  state.lastDraw = { playerId: 'p1', tile: state.hands.p1[13], viaGang: true };
  state.pendingAction = {
    type: 'self',
    playerId: 'p1',
    options: [{ action: 'hu' }]
  };

  state = engine.update(state, { type: 'hu' }, 'p1');

  assert.equal(state.winInfo.winType, 'gangshanghua');
  assert.equal(state.winInfo.fan, 12);
  assert.equal(state.scores.p1, 150);
  assert.equal(state.scores.p2, -50);
  assert.equal(state.scores.p3, -50);
  assert.equal(state.scores.p4, -50);
});

test('mahjong response ignores unknown actions without passing', () => {
  const engine = new MahjongEngine();
  let state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  const claimCard = tile('wan', 1);
  state.phase = 'response';
  state.pendingAction = {
    type: 'claim',
    sourcePlayerId: 'p1',
    card: claimCard,
    queue: [{ playerId: 'p2', action: 'peng', priority: 1 }]
  };

  engine.update(state, { type: 'dance' }, 'p2');

  assert.equal(state.phase, 'response');
  assert.equal(state.pendingAction.queue.length, 1);
  assert.equal(state.pendingAction.queue[0].playerId, 'p2');

  state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  const bugangTile = tile('wan', 2);
  state.phase = 'response';
  state.pendingAction = {
    type: 'qianggang',
    sourcePlayerId: 'p1',
    tile: bugangTile,
    option: { tile: bugangTile, cards: [bugangTile] },
    queue: [{ playerId: 'p2', action: 'hu', priority: 3 }]
  };

  engine.update(state, { type: 'dance' }, 'p2');

  assert.equal(state.phase, 'response');
  assert.equal(state.pendingAction.queue.length, 1);
  assert.equal(state.pendingAction.queue[0].playerId, 'p2');
});

test('mahjong draw settlement records draw instead of losses', async () => {
  const roomId = `room-mahjong-draw-${Date.now()}`;
  const players = ['mahjong-draw-p1', 'mahjong-draw-p2', 'mahjong-draw-p3', 'mahjong-draw-p4'];
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
    gameType: 'mahjong',
    status: 'playing',
    mode: 'normal',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: {
      phase: 'draw',
      players,
      dealer: players[0],
      currentPlayer: players[0],
      hands: Object.fromEntries(players.map(pid => [pid, []])),
      fulu: Object.fromEntries(players.map(pid => [pid, []])),
      scores: Object.fromEntries(players.map(pid => [pid, 0])),
      discards: Object.fromEntries(players.map(pid => [pid, []])),
      shan: { tiles: [] },
      remainingTiles: 4,
      lastDraw: null,
      lastDiscard: null,
      discardCount: 0,
      pendingAction: null,
      winInfo: null,
      scoreInfo: null,
      tingInfo: {},
      timer: 1,
      timerStarted: Date.now() - 2000
    }
  };
  store.saveRoom(room);

  handleActionTimeout(room);

  assert.equal(room.status, 'finished');
  assert.equal(room.gameState.finalWinner, null);
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
