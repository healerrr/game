const { createStandardDeck, shuffle, DEFAULT_RANK_VALUES } = require('./shared/cards');
const store = require('../store');

const BASE_BET = 20;
const RAISE_STEP = 20;
const BLIND_BET_LIMIT = 50;
const LOOKED_BET_LIMIT = 100;

function buildSeats(players) {
  return players.map((playerId, index) => ({
    playerId,
    seat: index
  }));
}

function createDeck() {
  return shuffle(createStandardDeck({ rankValues: DEFAULT_RANK_VALUES }));
}

function createHands(players) {
  const deck = createDeck();
  const hands = {};
  players.forEach((playerId) => {
    hands[playerId] = [deck.pop(), deck.pop(), deck.pop()];
  });
  return hands;
}

function isLooked(state, playerId) {
  return state.lookedPlayers.includes(playerId);
}

function blindMultiplier(state, playerId) {
  return isLooked(state, playerId) ? 2 : 1;
}

function evaluateHand(hand) {
  if (!Array.isArray(hand) || hand.length !== 3) {
    return {
      typeKey: 'unknown',
      typeLabel: '未知',
      typeValue: 0,
      values: [],
      tieBreaker: []
    };
  }

  const sorted = [...hand].sort((a, b) => b.value - a.value);
  const values = sorted.map((card) => card.value);
  const suits = sorted.map((card) => card.suit);
  const isThree = values[0] === values[1] && values[1] === values[2];
  const isPair = values[0] === values[1] || values[1] === values[2];
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  const isWheel = values[0] === 14 && values[1] === 3 && values[2] === 2;
  const isStraight = isWheel || (values[0] - values[1] === 1 && values[1] - values[2] === 1);

  if (isThree) {
    return {
      typeKey: 'leizi',
      typeLabel: '豹子',
      typeValue: 6,
      values,
      tieBreaker: [values[0]]
    };
  }

  if (isFlush && isStraight) {
    return {
      typeKey: 'tonghuashun',
      typeLabel: '同花顺',
      typeValue: 5,
      values,
      tieBreaker: [isWheel ? 3 : values[0]]
    };
  }

  if (isFlush) {
    return {
      typeKey: 'tonghua',
      typeLabel: '同花',
      typeValue: 4,
      values,
      tieBreaker: values
    };
  }

  if (isStraight) {
    return {
      typeKey: 'shunzi',
      typeLabel: '顺子',
      typeValue: 3,
      values,
      tieBreaker: [isWheel ? 3 : values[0]]
    };
  }

  if (isPair) {
    const pairValue = values[0] === values[1] ? values[0] : values[1];
    const kicker = values[0] === values[1] ? values[2] : values[0];
    return {
      typeKey: 'duizi',
      typeLabel: '对子',
      typeValue: 2,
      values,
      tieBreaker: [pairValue, kicker]
    };
  }

  return {
    typeKey: 'danzhang',
    typeLabel: '单张',
    typeValue: 1,
    values,
    tieBreaker: values
  };
}

function compareHands(rankA, rankB) {
  if (rankA.typeValue !== rankB.typeValue) {
    return rankA.typeValue - rankB.typeValue;
  }

  const len = Math.max(rankA.tieBreaker.length, rankB.tieBreaker.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (rankA.tieBreaker[i] || 0) - (rankB.tieBreaker[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function buildShowdownResult(state, winner) {
  const hands = {};
  const rankings = {};
  state.players.forEach((playerId) => {
    hands[playerId] = state.hands[playerId];
    rankings[playerId] = evaluateHand(state.hands[playerId]);
  });
  return {
    hands,
    rankings,
    winner,
    compareResult: state.compareResult || null
  };
}

function getNextActivePlayer(state, playerId) {
  const active = state.activePlayers;
  if (!active.length) return null;
  const idx = active.indexOf(playerId);
  if (idx >= 0) return active[(idx + 1) % active.length];
  return active[0];
}

function getCallAmount(state, playerId) {
  return (state.currentBet || BASE_BET) * blindMultiplier(state, playerId);
}

function getRaiseAmount(state, playerId) {
  const nextBet = (state.currentBet || BASE_BET) + (state.raiseStep || RAISE_STEP);
  return nextBet * blindMultiplier(state, playerId);
}

function getCompareAmount(state, playerId) {
  return getCallAmount(state, playerId) * 2;
}

function getBetLimit(state, playerId) {
  return isLooked(state, playerId) ? LOOKED_BET_LIMIT : BLIND_BET_LIMIT;
}

function isWithinBetLimit(state, playerId, amount) {
  return Number(amount) <= getBetLimit(state, playerId);
}

function getInitialBalance(room, playerId) {
  const explicit = room?.playerBalances?.[playerId];
  const playerPoints = store.getPlayer(playerId)?.points;
  const balance = Number(explicit ?? playerPoints);
  return Number.isFinite(balance) && balance >= 0 ? balance : Number.MAX_SAFE_INTEGER;
}

function getRemainingBalance(state, playerId) {
  const balance = Number(state.playerBalances?.[playerId]);
  if (!Number.isFinite(balance)) return Number.MAX_SAFE_INTEGER;
  const committed = Number(state.playerBets?.[playerId] || 0);
  return Math.max(0, balance - committed);
}

function canAfford(state, playerId, amount) {
  return Number(amount) <= getRemainingBalance(state, playerId);
}

function canPayBet(state, playerId, amount) {
  return isWithinBetLimit(state, playerId, amount) && canAfford(state, playerId, amount);
}

function applyCost(state, playerId, amount) {
  if (!canAfford(state, playerId, amount)) return false;
  state.playerBets[playerId] = (state.playerBets[playerId] || 0) + amount;
  state.pot += amount;
  return true;
}

function foldPlayer(state, playerId) {
  if (!state.foldedPlayers.includes(playerId)) {
    state.foldedPlayers.push(playerId);
  }
  state.activePlayers = state.activePlayers.filter((id) => id !== playerId);
}

function recordAction(state, payload) {
  state.lastAction = payload;
  state.actionLog = [...state.actionLog.slice(-11), payload];
}

function finishRound(state, winnerId, reason) {
  state.phase = 'finished';
  state.finalWinner = winnerId;
  state.finishReason = reason;
  state.currentPlayer = null;
  state.showdownResult = buildShowdownResult(state, winnerId);
  return state;
}

class ZhaJinHuaEngine {
  init(room, players) {
    const hands = createHands(players);
    return {
      phase: 'bet',
      players,
      seats: buildSeats(players),
      round: 1,
      hands,
      activePlayers: [...players],
      foldedPlayers: [],
      lookedPlayers: [],
      currentPlayer: players[0],
      currentBet: BASE_BET,
      baseBet: BASE_BET,
      baseScore: BASE_BET,
      raiseStep: RAISE_STEP,
      blindBetLimit: BLIND_BET_LIMIT,
      lookedBetLimit: LOOKED_BET_LIMIT,
      pot: 0,
      playerBalances: Object.fromEntries(players.map((playerId) => [playerId, getInitialBalance(room, playerId)])),
      playerBets: Object.fromEntries(players.map((playerId) => [playerId, 0])),
      actedThisRound: [],
      lastAction: null,
      actionLog: [],
      compareResult: null,
      showdownResult: null,
      finishReason: null,
      timer: 25,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (!state.players.includes(playerId) || state.phase === 'finished') {
      return state;
    }

    if (state.phase === 'look') {
      return this.handleLookPhase(state, action, playerId);
    }

    if (state.phase === 'bet') {
      return this.handleBetPhase(state, action, playerId);
    }

    return state;
  }

  handleLookPhase(state, action, playerId) {
    if (!state.activePlayers.includes(playerId)) return state;

    if (action.type !== 'ready' || state.actedThisRound.includes(playerId)) {
      return state;
    }

    state.actedThisRound.push(playerId);
    recordAction(state, { type: 'ready', playerId });
    if (state.actedThisRound.length >= state.activePlayers.length) {
      state.phase = 'bet';
      state.actedThisRound = [];
      state.currentPlayer = state.activePlayers[0];
      state.compareResult = null;
    }
    state.timerStarted = Date.now();
    return state;
  }

  handleBetPhase(state, action, playerId) {
    if (playerId !== state.currentPlayer || !state.activePlayers.includes(playerId)) {
      return state;
    }

    if (action.type === 'peek' && !isLooked(state, playerId)) {
      state.lookedPlayers.push(playerId);
      recordAction(state, { type: 'peek', playerId });
      state.timerStarted = Date.now();
      return state;
    }

    if (action.type === 'fold') {
      foldPlayer(state, playerId);
      state.actedThisRound = state.actedThisRound.filter((id) => state.activePlayers.includes(id));
      recordAction(state, { type: 'fold', playerId });
      if (state.activePlayers.length === 1) {
        return finishRound(state, state.activePlayers[0], 'fold');
      }
    } else if (action.type === 'call') {
      const amount = getCallAmount(state, playerId);
      if (!canPayBet(state, playerId, amount)) return state;
      applyCost(state, playerId, amount);
      if (!state.actedThisRound.includes(playerId)) {
        state.actedThisRound.push(playerId);
      }
      recordAction(state, { type: 'call', playerId, amount });
    } else if (action.type === 'raise') {
      const amount = getRaiseAmount(state, playerId);
      if (!canPayBet(state, playerId, amount)) return state;
      state.currentBet += state.raiseStep;
      applyCost(state, playerId, amount);
      state.actedThisRound = [playerId];
      recordAction(state, { type: 'raise', playerId, amount, currentBet: state.currentBet });
    } else if (action.type === 'compare') {
      const targetId = action.targetId;
      if (!targetId || targetId === playerId || !state.activePlayers.includes(targetId)) {
        return state;
      }

      const amount = getCompareAmount(state, playerId);
      if (!applyCost(state, playerId, amount)) return state;
      const challengerRank = evaluateHand(state.hands[playerId]);
      const targetRank = evaluateHand(state.hands[targetId]);
      const diff = compareHands(challengerRank, targetRank);
      const winner = diff > 0 ? playerId : targetId;
      const loser = winner === playerId ? targetId : playerId;

      foldPlayer(state, loser);
      state.compareResult = {
        challenger: playerId,
        targetId,
        winner,
        loser,
        amount,
        challengerRank,
        targetRank
      };
      recordAction(state, {
        type: 'compare',
        playerId,
        targetId,
        winner,
        loser,
        amount
      });
      if (state.activePlayers.length === 1) {
        return finishRound(state, winner, 'compare');
      }
      state.currentPlayer = getNextActivePlayer(state, loser);
      state.round += 1;
      state.actedThisRound = [];
      state.timerStarted = Date.now();
      return state;
    } else if (action.type === 'showdown') {
      return finishRound(state, this.getShowdownWinner(state), 'showdown');
    } else {
      return state;
    }

    state.currentPlayer = getNextActivePlayer(state, playerId);
    if (state.actedThisRound.length >= state.activePlayers.length) {
      state.round += 1;
      state.actedThisRound = [];
    }
    state.timerStarted = Date.now();
    return state;
  }

  getShowdownWinner(state) {
    let bestPlayer = state.activePlayers[0];
    let bestRank = evaluateHand(state.hands[bestPlayer]);
    for (let i = 1; i < state.activePlayers.length; i += 1) {
      const currentPlayer = state.activePlayers[i];
      const currentRank = evaluateHand(state.hands[currentPlayer]);
      if (compareHands(currentRank, bestRank) > 0) {
        bestPlayer = currentPlayer;
        bestRank = currentRank;
      }
    }
    return bestPlayer;
  }

  nextRound(state) {
    return this.init(null, state.players);
  }
}

module.exports = {
  ZhaJinHuaEngine,
  evaluateHand,
  compareHands,
  blindMultiplier,
  getCallAmount,
  getRaiseAmount,
  getCompareAmount,
  getBetLimit,
  isWithinBetLimit,
  getRemainingBalance,
  canAfford,
  canPayBet
};
