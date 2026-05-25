const test = require('node:test');
const assert = require('node:assert/strict');

const { canHu, getWaitTiles, checkSevenPairs } = require('../game-engines/mahjong/hule');
const { evaluateFan } = require('../game-engines/mahjong/fan');
const { MahjongEngine } = require('../game-engines/mahjong/index');

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

test('红中推倒胡 - 平胡+自摸', () => {
  const hand = [
    tile('wan', 1), tile('wan', 1), tile('wan', 1),
    tile('wan', 2), tile('wan', 3), tile('wan', 4),
    tile('wan', 5), tile('wan', 6), tile('wan', 7),
    tile('tong', 2), tile('tong', 3), tile('tong', 4),
    tile('zhong', 'zhong'), tile('zhong', 'zhong')
  ];
  const result = evaluateFan(hand, [], tile('wan', 1), 'zimo');
  assert.equal(result.fan >= 2, true);
  const names = result.detail.map(d => d.name);
  assert.equal(names.includes('平胡'), true);
  assert.equal(names.includes('自摸'), true);
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
  // 平胡基础=1, 杀鬼翻倍 => 至少=2
  assert.equal(result.fan >= 2, true);
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
});

// ============ 引擎流程 ============

test('红中推倒胡 - 引擎初始化正确', () => {
  const engine = new MahjongEngine();
  const state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  assert.equal(state.phase, 'draw');
  assert.equal(state.players.length, 4);
  assert.equal(state.hands['p1'].length, 13);
  assert.equal(state.hands['p2'].length, 13);
  assert.equal(state.remainingTiles, 60);
  assert.equal(state.currentPlayer, 'p1');
});

test('红中推倒胡 - 摸牌后手牌增加', () => {
  const engine = new MahjongEngine();
  let state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  state = engine.update(state, { type: 'draw' }, 'p1');
  assert.equal(state.hands['p1'].length, 14);
  assert.equal(state.remainingTiles, 59);
});

test('红中推倒胡 - 出牌后手牌减少', () => {
  const engine = new MahjongEngine();
  let state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  state = engine.update(state, { type: 'draw' }, 'p1');
  if (state.phase === 'response' && state.pendingAction?.type === 'self') {
    state = engine.update(state, { type: 'pass' }, 'p1');
  }
  const card = state.hands['p1'][0];
  state = engine.update(state, { type: 'discard', card }, 'p1');
  assert.equal(state.hands['p1'].length, 13);
  assert.equal(state.discards['p1'].length, 1);
});
