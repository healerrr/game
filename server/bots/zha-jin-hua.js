const {
  evaluateHand,
  getCallAmount,
  getRaiseAmount,
  getCompareAmount,
  canAfford,
  canPayBet
} = require('../game-engines/zha-jin-hua');

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
  const raiseCost = getRaiseAmount(state, botId);
  const compareCost = getCompareAmount(state, botId);
  const canCall = canPayBet(state, botId, callCost);
  const canRaise = canPayBet(state, botId, raiseCost);
  const canCompare = canAfford(state, botId, compareCost);

  if (!canCall) return { type: 'fold' };

  const betAction = (raiseChance) => (canRaise && Math.random() < raiseChance ? { type: 'raise' } : { type: 'call' });

  if (!looked && Math.random() < 0.2) {
    return { type: 'peek' };
  }

  if (rank.typeValue >= 5) {
    if (canCompare && compareTarget && activeOpponents.length === 1 && Math.random() < 0.45) {
      return { type: 'compare', targetId: compareTarget };
    }
    return betAction(0.55);
  }

  if (rank.typeValue >= 3) {
    if (canCompare && compareTarget && activeOpponents.length === 1 && compareCost <= callCost * 3 && Math.random() < 0.25) {
      return { type: 'compare', targetId: compareTarget };
    }
    return betAction(0.35);
  }

  if (rank.typeValue === 2) {
    if (looked && callCost > state.currentBet * 2 && Math.random() < 0.3) {
      return { type: 'fold' };
    }
    return betAction(0.2);
  }

  if (looked && Math.random() < 0.45) return { type: 'fold' };
  return betAction(0.15);
}

module.exports = { zhaJinHuaStrategy };
