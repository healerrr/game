const { ZhaJinHuaEngine } = require('./zha-jin-hua');
const { GuandanEngine } = require('./guandan');
const { MahjongEngine } = require('./mahjong');

module.exports = {
  zha_jin_hua: new ZhaJinHuaEngine(),
  guandan: new GuandanEngine(),
  mahjong: new MahjongEngine()
};
