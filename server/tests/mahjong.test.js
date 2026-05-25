const test = require('node:test');
const assert = require('node:assert/strict');

const { canHu, getWaitTiles } = require('../game-engines/mahjong/hule');
const { evaluateFan } = require('../game-engines/mahjong/fan');

function tile(suit, rank) {
  return { suit, rank, id: `${suit}-${rank}-${Math.random()}` };
}

test('南京麻将标准胡牌判定成立', () => {
  const hand = [
    tile('wan', '1'), tile('wan', '1'), tile('wan', '1'),
    tile('wan', '2'), tile('wan', '3'), tile('wan', '4'),
    tile('wan', '5'), tile('wan', '6'), tile('wan', '7'),
    tile('tong', '2'), tile('tong', '3'), tile('tong', '4'),
    tile('dragon', 'red'), tile('dragon', 'red')
  ];
  assert.equal(canHu(hand, []).canHu, true);
});

test('南京麻将可计算听牌张', () => {
  const hand = [
    tile('wan', '1'), tile('wan', '1'),
    tile('wan', '2'), tile('wan', '3'), tile('wan', '4'),
    tile('wan', '5'), tile('wan', '6'), tile('wan', '7'),
    tile('tong', '2'), tile('tong', '3'), tile('tong', '4'),
    tile('dragon', 'red'), tile('dragon', 'red')
  ];
  const waits = getWaitTiles(hand, []);
  assert.equal(waits.length > 0, true);
});

test('南京麻将番种至少包含门清与无花', () => {
  const hand = [
    tile('wan', '1'), tile('wan', '1'), tile('wan', '1'),
    tile('wan', '2'), tile('wan', '3'), tile('wan', '4'),
    tile('wan', '5'), tile('wan', '6'), tile('wan', '7'),
    tile('tong', '2'), tile('tong', '3'), tile('tong', '4'),
    tile('dragon', 'red'), tile('dragon', 'red')
  ];
  const fan = evaluateFan(hand, [], [], { winType: 'zimo' });
  assert.equal(fan.totalFan >= 2, true);
});
