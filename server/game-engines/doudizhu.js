const { createStandardDeck, shuffle } = require('./shared/cards');

const SEAT_ORDER = ['south', 'east', 'west'];
const BASE_SCORE = 50;
const RANK_VALUES = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 16,
  SJ: 17,
  BJ: 18
};

function buildSeats(players) {
  return players.map((playerId, index) => ({
    playerId,
    seat: SEAT_ORDER[index] || `seat_${index}`
  }));
}

function getSeatMap(players) {
  return Object.fromEntries(buildSeats(players).map((item) => [item.playerId, item.seat]));
}

function createDeck() {
  return shuffle(createStandardDeck({
    decks: 1,
    includeJokers: true,
    rankValues: RANK_VALUES
  }));
}

function rankPower(rank) {
  return RANK_VALUES[rank] || 0;
}

function suitPower(suit) {
  return { diamond: 0, club: 1, heart: 2, spade: 3, joker: 4 }[suit] ?? 0;
}

function isCardLike(card) {
  return Boolean(card && typeof card === 'object' && typeof card.suit === 'string' && card.rank !== undefined && card.rank !== null);
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const diff = rankPower(a.rank) - rankPower(b.rank);
    if (diff !== 0) return diff;
    return suitPower(a.suit) - suitPower(b.suit);
  });
}

function sortHandDesc(hand) {
  return [...hand].sort((a, b) => {
    const diff = rankPower(b.rank) - rankPower(a.rank);
    if (diff !== 0) return diff;
    return suitPower(b.suit) - suitPower(a.suit);
  });
}

function buildPattern(type, cards, mainValue, extras = {}) {
  return {
    type,
    cards: [...cards],
    mainValue,
    length: cards.length,
    ...extras
  };
}

function getValueCounts(cards) {
  const map = new Map();
  cards.forEach((card) => {
    const power = rankPower(card.rank);
    const entry = map.get(power) || { power, cards: [] };
    entry.cards.push(card);
    map.set(power, entry);
  });
  return [...map.values()].sort((a, b) => a.power - b.power);
}

function isConsecutive(values) {
  if (values.length < 2) return true;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function canSequence(values, minLength) {
  return values.length >= minLength &&
    values.every((value) => value >= 3 && value <= 14) &&
    new Set(values).size === values.length &&
    isConsecutive([...values].sort((a, b) => a - b));
}

function findTripleSequence(counts, sequenceLength) {
  const tripleValues = counts
    .filter((entry) => entry.cards.length >= 3 && entry.power <= 14)
    .map((entry) => entry.power)
    .sort((a, b) => a - b);

  for (let i = 0; i <= tripleValues.length - sequenceLength; i += 1) {
    const seq = tripleValues.slice(i, i + sequenceLength);
    if (isConsecutive(seq)) return seq;
  }
  return null;
}

function identifyAirplane(sorted, counts) {
  const size = sorted.length;

  if (size >= 6 && size % 3 === 0) {
    const sequenceLength = size / 3;
    if (counts.length === sequenceLength && counts.every((entry) => entry.cards.length === 3)) {
      const values = counts.map((entry) => entry.power);
      if (canSequence(values, 2)) {
        return buildPattern('airplane', sorted, values[values.length - 1], { sequenceLength });
      }
    }
  }

  if (size >= 8 && size % 4 === 0) {
    const sequenceLength = size / 4;
    const sequence = findTripleSequence(counts, sequenceLength);
    if (sequence) {
      const wingCount = size - sequenceLength * 3;
      if (wingCount === sequenceLength) {
        return buildPattern('airplane_single', sorted, sequence[sequence.length - 1], { sequenceLength });
      }
    }
  }

  if (size >= 10 && size % 5 === 0) {
    const sequenceLength = size / 5;
    const sequence = findTripleSequence(counts, sequenceLength);
    if (sequence) {
      const tripleSet = new Set(sequence);
      const wings = counts.filter((entry) => !tripleSet.has(entry.power));
      if (wings.length === sequenceLength && wings.every((entry) => entry.cards.length === 2)) {
        return buildPattern('airplane_pair', sorted, sequence[sequence.length - 1], { sequenceLength });
      }
    }
  }

  return null;
}

function identifyPattern(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  if (!cards.every(isCardLike)) return null;

  const sorted = sortHand(cards);
  const counts = getValueCounts(sorted);
  const values = counts.map((entry) => entry.power);
  const size = sorted.length;

  if (size === 1) return buildPattern('single', sorted, values[0]);

  if (size === 2) {
    if (sorted.every((card) => card.suit === 'joker') && new Set(sorted.map((card) => card.rank)).size === 2) {
      return buildPattern('rocket', sorted, 999);
    }
    if (counts.length === 1) return buildPattern('pair', sorted, values[0]);
  }

  if (size === 3 && counts.length === 1) return buildPattern('triple', sorted, values[0]);

  if (size === 4) {
    if (counts.length === 1) return buildPattern('bomb', sorted, values[0], { bombSize: 4 });
    const triple = counts.find((entry) => entry.cards.length === 3);
    if (triple) return buildPattern('triple_single', sorted, triple.power);
  }

  if (size === 5) {
    const triple = counts.find((entry) => entry.cards.length === 3);
    const pair = counts.find((entry) => entry.cards.length === 2);
    if (triple && pair) return buildPattern('triple_pair', sorted, triple.power);
  }

  if (size >= 5 && counts.every((entry) => entry.cards.length === 1) && canSequence(values, 5)) {
    return buildPattern('straight', sorted, values[values.length - 1], { sequenceLength: size });
  }

  if (size >= 6 && size % 2 === 0 && counts.every((entry) => entry.cards.length === 2) && canSequence(values, 3)) {
    return buildPattern('pair_straight', sorted, values[values.length - 1], { sequenceLength: size / 2 });
  }

  const airplane = identifyAirplane(sorted, counts);
  if (airplane) return airplane;

  if (size === 6) {
    const four = counts.find((entry) => entry.cards.length === 4);
    if (four) return buildPattern('four_two_singles', sorted, four.power);
  }

  if (size === 8) {
    const four = counts.find((entry) => entry.cards.length === 4);
    const pairs = counts.filter((entry) => entry.power !== four?.power && entry.cards.length === 2);
    if (four && pairs.length === 2) return buildPattern('four_two_pairs', sorted, four.power);
  }

  return buildPattern('invalid', sorted, 0);
}

function comparePattern(nextPattern, currentPattern) {
  if (!nextPattern || nextPattern.type === 'invalid') return -1;
  if (!currentPattern) return 1;

  if (nextPattern.type === 'rocket') return currentPattern.type === 'rocket' ? 0 : 1;
  if (currentPattern.type === 'rocket') return -1;

  if (nextPattern.type === 'bomb' && currentPattern.type !== 'bomb') return 1;
  if (currentPattern.type === 'bomb' && nextPattern.type !== 'bomb') return -1;

  if (nextPattern.type !== currentPattern.type) return -1;

  if (nextPattern.sequenceLength && nextPattern.sequenceLength !== currentPattern.sequenceLength) return -1;
  if (nextPattern.length !== currentPattern.length) return -1;

  return nextPattern.mainValue - currentPattern.mainValue;
}

function removeSelectedCards(hand, selected) {
  if (!Array.isArray(selected) || !selected.every(isCardLike)) return null;
  const nextHand = [...hand];
  const indexes = [];

  for (const card of selected) {
    const idx = nextHand.findIndex((item, index) => {
      if (indexes.includes(index)) return false;
      if (item.id && card.id) return item.id === card.id;
      return item.rank === card.rank && item.suit === card.suit;
    });
    if (idx === -1) return null;
    indexes.push(idx);
  }

  indexes.sort((a, b) => b - a).forEach((idx) => nextHand.splice(idx, 1));
  return nextHand;
}

function getNextPlayer(players, finishedSet, currentPlayer) {
  const alive = players.filter((playerId) => !finishedSet.has(playerId));
  if (alive.length === 0) return null;
  const currentIndex = players.indexOf(currentPlayer);
  if (currentIndex === -1) return alive[0];
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (!finishedSet.has(candidate)) return candidate;
  }
  return alive[0];
}

function getHandCounts(state) {
  return Object.fromEntries((state.players || []).map((pid) => [
    pid,
    (state.hands?.[pid] || []).length
  ]));
}

function syncHandCounts(state) {
  state.handCounts = getHandCounts(state);
}

function getDoudizhuScoreUnit(state, baseScore = BASE_SCORE) {
  const base = Number(baseScore || BASE_SCORE);
  const bombCount = Math.max(0, Number(state?.bombCount || 0));
  return base + (base * bombCount);
}

function recordBombIfNeeded(state, pattern) {
  if (!['bomb', 'rocket'].includes(pattern?.type)) return;
  state.bombCount = Number(state.bombCount || 0) + 1;
  state.scoreUnit = getDoudizhuScoreUnit(state, state.baseScore || BASE_SCORE);
}

function createBiddingDeal(players, round = 1, redealCount = 0) {
  const deck = createDeck();
  const hands = {};

  players.forEach((playerId) => {
    hands[playerId] = sortHand(deck.splice(0, 17));
  });

  return {
    phase: 'bid',
    stage: 'bid',
    gameMode: 'doudizhu',
    round,
    redealCount,
    players,
    seats: buildSeats(players),
    seatMap: getSeatMap(players),
    landlord: null,
    landlordSeat: null,
    farmers: [],
    bottomCards: sortHand(deck.splice(0, 3)),
    hands,
    currentPlayer: players[0],
    currentBid: 0,
    currentBidder: null,
    baseScore: BASE_SCORE,
    bombCount: 0,
    scoreUnit: BASE_SCORE,
    bidHistory: [],
    bidTurnCount: 0,
    consecutivePasses: 0,
    lastPlay: null,
    lastPattern: null,
    lastLeadPlayer: null,
    passedPlayers: [],
    finishedOrder: [],
    roundWinner: null,
    winningPlayers: [],
    timer: 30,
    timerStarted: Date.now(),
    handCounts: Object.fromEntries(players.map((pid) => [pid, hands[pid].length])),
    currentHints: []
  };
}

function resetBiddingDeal(state) {
  const next = createBiddingDeal(state.players || [], state.round || 1, Number(state.redealCount || 0) + 1);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, next);
  return state;
}

function getNextSeatPlayer(players, currentPlayer) {
  if (!players.length) return null;
  const currentIndex = players.indexOf(currentPlayer);
  if (currentIndex === -1) return players[0];
  return players[(currentIndex + 1) % players.length];
}

function finishBidding(state) {
  const landlord = state.currentBidder || state.players?.[0];
  state.phase = 'play';
  state.stage = 'play';
  state.landlord = landlord;
  state.landlordSeat = state.seatMap?.[landlord] || null;
  state.farmers = (state.players || []).filter((playerId) => playerId !== landlord);
  state.hands[landlord] = sortHand([...(state.hands[landlord] || []), ...(state.bottomCards || [])]);
  state.currentPlayer = landlord;
  state.lastPlay = null;
  state.lastPattern = null;
  state.lastLeadPlayer = null;
  state.passedPlayers = [];
  state.timerStarted = Date.now();
  syncHandCounts(state);
  return state;
}

function getWinningPlayers(state, winnerId) {
  if (!winnerId) return [];
  if (winnerId === state.landlord) return [winnerId];
  return state.farmers || (state.players || []).filter((pid) => pid !== state.landlord);
}

function rankGroups(hand) {
  return getValueCounts(hand).sort((a, b) => a.power - b.power);
}

function pushCandidate(candidates, cards) {
  const pattern = identifyPattern(cards);
  if (pattern && pattern.type !== 'invalid') candidates.push({ cards, pattern });
}

function getHints(hand, lastPattern = null) {
  if (!Array.isArray(hand) || hand.length === 0) return [];

  const candidates = [];
  const sorted = sortHand(hand);
  const groups = rankGroups(sorted);

  sorted.forEach((card) => pushCandidate(candidates, [card]));
  groups.forEach((group) => {
    if (group.cards.length >= 2) pushCandidate(candidates, group.cards.slice(0, 2));
    if (group.cards.length >= 3) pushCandidate(candidates, group.cards.slice(0, 3));
    if (group.cards.length === 4) pushCandidate(candidates, group.cards.slice(0, 4));
  });

  groups.forEach((group) => {
    if (group.cards.length < 3) return;
    const single = sorted.find((card) => rankPower(card.rank) !== group.power);
    if (single) pushCandidate(candidates, [...group.cards.slice(0, 3), single]);
    const pair = groups.find((entry) => entry.power !== group.power && entry.cards.length >= 2);
    if (pair) pushCandidate(candidates, [...group.cards.slice(0, 3), ...pair.cards.slice(0, 2)]);
  });

  const jokers = sorted.filter((card) => card.suit === 'joker');
  if (jokers.length === 2) pushCandidate(candidates, jokers);

  const unique = new Map();
  candidates.forEach((item) => {
    if (lastPattern && comparePattern(item.pattern, lastPattern) <= 0) return;
    const key = item.cards.map((card) => card.id || `${card.suit}-${card.rank}`).sort().join('|');
    if (!unique.has(key)) unique.set(key, item);
  });

  return [...unique.values()].sort((a, b) => {
    const aPower = ['bomb', 'rocket'].includes(a.pattern.type) ? 1000 + a.pattern.mainValue : a.pattern.mainValue;
    const bPower = ['bomb', 'rocket'].includes(b.pattern.type) ? 1000 + b.pattern.mainValue : b.pattern.mainValue;
    return aPower - bPower || a.cards.length - b.cards.length;
  });
}

class DoudizhuEngine {
  init(room, players) {
    return createBiddingDeal(players);
  }

  update(state, action, playerId) {
    if (!action) return state;

    if (state.phase === 'bid') {
      if (playerId !== state.currentPlayer) return state;

      const score = action.type === 'bid' ? Number(action.score) : action.type === 'pass' ? 0 : null;
      if (score === null || !Number.isInteger(score) || score < 0 || score > 3) return state;
      if (score > 0 && score <= Number(state.currentBid || 0)) return state;

      state.bidHistory = Array.isArray(state.bidHistory) ? state.bidHistory : [];
      state.bidHistory.push({
        playerId,
        score,
        action: score > 0 ? (state.currentBid > 0 ? 'rob' : 'bid') : 'pass'
      });
      state.bidTurnCount = Number(state.bidTurnCount || 0) + 1;

      if (score > 0) {
        state.currentBid = score;
        state.currentBidder = playerId;
        state.consecutivePasses = 0;
      } else {
        state.consecutivePasses = Number(state.consecutivePasses || 0) + 1;
      }

      if (score === 3) {
        finishBidding(state);
        this._updateHints(state);
        return state;
      }

      if (!state.currentBidder && state.bidTurnCount >= state.players.length) {
        resetBiddingDeal(state);
        return state;
      }

      if (
        state.currentBidder &&
        state.bidTurnCount >= state.players.length &&
        Number(state.consecutivePasses || 0) >= state.players.length - 1
      ) {
        finishBidding(state);
        this._updateHints(state);
        return state;
      }

      state.currentPlayer = getNextSeatPlayer(state.players || [], playerId);
      state.timerStarted = Date.now();
      state.currentHints = [];
      syncHandCounts(state);
      return state;
    }

    if (state.phase !== 'play' || playerId !== state.currentPlayer) return state;
    if (state.finishedOrder.includes(playerId)) return state;

    if (action.type === 'play') {
      const selected = Array.isArray(action.cards) ? action.cards : [];
      const pattern = identifyPattern(selected);
      if (!pattern || pattern.type === 'invalid') return state;
      if (state.lastPattern && comparePattern(pattern, state.lastPattern) <= 0) return state;

      const nextHand = removeSelectedCards(state.hands[playerId] || [], selected);
      if (!nextHand) return state;

      state.hands[playerId] = sortHand(nextHand);
      recordBombIfNeeded(state, pattern);
      state.lastPlay = { playerId, cards: selected, pattern };
      state.lastPattern = pattern;
      state.lastLeadPlayer = playerId;
      state.passedPlayers = [];

      if (state.hands[playerId].length === 0 && !state.finishedOrder.includes(playerId)) {
        state.finishedOrder.push(playerId);
      }
      syncHandCounts(state);

      if (state.hands[playerId].length === 0) {
        state.phase = 'finished';
        state.stage = 'settlement';
        state.roundWinner = playerId;
        state.finalWinner = playerId;
        state.winningPlayers = getWinningPlayers(state, playerId);
        state.currentHints = [];
        return state;
      }

      const finishedSet = new Set(state.finishedOrder);
      state.currentPlayer = getNextPlayer(state.players, finishedSet, playerId);
      state.timerStarted = Date.now();
      this._updateHints(state);
      return state;
    }

    if (action.type === 'pass') {
      if (!state.lastPattern || state.lastLeadPlayer === playerId) return state;
      if (!state.passedPlayers.includes(playerId)) state.passedPlayers.push(playerId);

      const finishedSet = new Set(state.finishedOrder);
      const aliveOthers = state.players.filter((id) => !finishedSet.has(id) && id !== state.lastLeadPlayer);
      if (aliveOthers.every((id) => state.passedPlayers.includes(id))) {
        state.currentPlayer = finishedSet.has(state.lastLeadPlayer)
          ? getNextPlayer(state.players, finishedSet, state.lastLeadPlayer || playerId)
          : state.lastLeadPlayer;
        state.lastPlay = null;
        state.lastPattern = null;
        state.lastLeadPlayer = null;
        state.passedPlayers = [];
      } else {
        state.currentPlayer = getNextPlayer(state.players, finishedSet, playerId);
      }

      state.timerStarted = Date.now();
      syncHandCounts(state);
      this._updateHints(state);
      return state;
    }

    return state;
  }

  _updateHints(state) {
    if (state.phase !== 'play' || !state.currentPlayer) {
      state.currentHints = [];
      return;
    }
    state.currentHints = getHints(state.hands[state.currentPlayer] || [], state.lastPattern);
  }

  getPlayerView(state, playerId) {
    const view = {
      ...state,
      handCounts: getHandCounts(state),
      bottomCards: state.phase === 'bid' ? [] : (state.bottomCards || []),
      hands: {
        [playerId]: state.hands?.[playerId] || []
      }
    };
    if (playerId !== state.currentPlayer) view.currentHints = [];
    return view;
  }

  getPublicView(state) {
    return {
      ...state,
      handCounts: getHandCounts(state),
      bottomCards: state.phase === 'bid' ? [] : (state.bottomCards || []),
      hands: {},
      currentHints: []
    };
  }

  nextRound(state) {
    const nextState = this.init(null, state.players);
    nextState.round = Number(state.round || 1) + 1;
    return nextState;
  }
}

module.exports = {
  DoudizhuEngine,
  SEAT_ORDER,
  RANK_VALUES,
  rankPower,
  sortHand,
  sortHandDesc,
  identifyPattern,
  comparePattern,
  getHints,
  getDoudizhuScoreUnit
};
