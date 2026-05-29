const { evaluateHand, getCallAmount, getCompareAmount } = require('../game-engines/zha-jin-hua');

function zhaJinHuaStrategy(state, botId) {
  if (state.phase === 'look') {
    if (state.actedThisRound?.includes(botId)) return null;
    return { type: 'ready' };
  }

  if (state.phase !== 'bet' || state.currentPlayer !== botId) return null;

  const looked = state.lookedPlayers?.includes(botId);
  const rank = evaluateHand(state.hands?.[botId] || []);
  const activeOpponents = (state.activePlayers || []).filter((playerId) => playerId !== botId);
  const compareTarget = activeOpponents[0];
  const callCost = getCallAmount(state, botId);
  const compareCost = getCompareAmount(state, botId);

  if (!looked && Math.random() < 0.2) {
    return { type: 'peek' };
  }

  if (rank.typeValue >= 5) {
    if (compareTarget && activeOpponents.length === 1 && Math.random() < 0.45) {
      return { type: 'compare', targetId: compareTarget };
    }
    return Math.random() < 0.55 ? { type: 'raise' } : { type: 'call' };
  }

  if (rank.typeValue >= 3) {
    if (compareTarget && activeOpponents.length === 1 && compareCost <= callCost * 3 && Math.random() < 0.25) {
      return { type: 'compare', targetId: compareTarget };
    }
    return Math.random() < 0.35 ? { type: 'raise' } : { type: 'call' };
  }

  if (rank.typeValue === 2) {
    if (looked && callCost > state.currentBet * 2 && Math.random() < 0.3) {
      return { type: 'fold' };
    }
    return Math.random() < 0.2 ? { type: 'raise' } : { type: 'call' };
  }

  if (looked && Math.random() < 0.45) return { type: 'fold' };
  return Math.random() < 0.15 ? { type: 'raise' } : { type: 'call' };
}

module.exports = { zhaJinHuaStrategy };
