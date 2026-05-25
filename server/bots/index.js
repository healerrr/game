const { zhaJinHuaStrategy } = require('./zha-jin-hua');
const { guandanStrategy } = require('./guandan');
const { mahjongStrategy } = require('./mahjong');

module.exports = {
  zha_jin_hua: zhaJinHuaStrategy,
  guandan: guandanStrategy,
  mahjong: mahjongStrategy
};
