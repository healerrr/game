const { ZhaJinHuaEngine } = require('./zha-jin-hua');
const { GuandanEngine } = require('./guandan');
const { DoudizhuEngine } = require('./doudizhu');
const { MahjongEngine } = require('./mahjong');

module.exports = {
  zha_jin_hua: new ZhaJinHuaEngine(),
  guandan: new GuandanEngine(),
  doudizhu: new DoudizhuEngine(),
  mahjong: new MahjongEngine()
};
