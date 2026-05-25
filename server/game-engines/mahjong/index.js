const { Shan } = require('./shan');
const { sortTiles, tileKey, sameTile } = require('./tiles');
const { addTile, removeTile, countTile, findAnGangOptions, findBuGangOptions, createMeld } = require('./shoupai');
const { canHu, getWaitTiles } = require('./hule');
const { evaluateFan } = require('./fan');

const SEAT_ORDER = ['south', 'west', 'north', 'east'];

function buildSeats(players) {
  return players.map((playerId, index) => ({
    playerId,
    seat: SEAT_ORDER[index] || `seat_${index}`
  }));
}

function nextPlayer(players, playerId) {
  const index = players.indexOf(playerId);
  return players[(index + 1) % players.length];
}

function serializeShan(shan) {
  return shan.snapshot();
}

function hydrateShan(state) {
  return Shan.fromSnapshot(state.shan);
}

function syncRemaining(state, shan) {
  state.shan = serializeShan(shan);
  state.remainingTiles = shan.remaining();
}

function updateTingInfo(state) {
  const tingInfo = {};
  state.players.forEach((playerId) => {
    tingInfo[playerId] = getWaitTiles(state.hands[playerId], state.fulu[playerId]).map((tile) => ({
      suit: tile.suit,
      rank: tile.rank,
      label: tile.label
    }));
  });
  state.tingInfo = tingInfo;
}

function drawForPlayer(state, shan, playerId, meta = {}) {
  const flowers = [];
  let drawn = shan.draw();
  while (drawn && drawn.suit === 'flower') {
    flowers.push(drawn);
    state.flowers[playerId].push(drawn);
    drawn = shan.draw();
  }
  if (!drawn) {
    state.phase = 'finished';
    state.finalWinner = null;
    state.winInfo = null;
    state.scoreInfo = { type: 'draw' };
    syncRemaining(state, shan);
    return null;
  }

  state.hands[playerId] = addTile(state.hands[playerId], drawn);
  state.lastDraw = { playerId, tile: drawn, flowers, ...meta };
  syncRemaining(state, shan);
  updateTingInfo(state);
  return drawn;
}

function resolveHu(state, winnerId, sourcePlayerId, card, winType) {
  const tiles = state.hands[winnerId];
  const fanInfo = evaluateFan(tiles, state.fulu[winnerId], state.flowers[winnerId], { winType });
  if (fanInfo.totalFan <= 0) return false;

  state.phase = 'finished';
  state.finalWinner = winnerId;
  state.winningPlayers = [winnerId];
  state.winInfo = {
    winnerId,
    sourcePlayerId,
    card,
    winType,
    fanList: fanInfo.fanList,
    totalFan: fanInfo.totalFan,
    flowerFan: fanInfo.flowerFan
  };
  state.scoreInfo = {
    type: sourcePlayerId && sourcePlayerId !== winnerId ? 'discard' : 'self_draw',
    payerIds: sourcePlayerId && sourcePlayerId !== winnerId
      ? [sourcePlayerId]
      : state.players.filter((id) => id !== winnerId)
  };
  if (state.dealer === winnerId) {
    state.dealerStays = true;
  }
  return true;
}

function getDiscardResponses(state, playerId, card) {
  const orderedPlayers = state.players
    .filter((id) => id !== playerId)
    .sort((a, b) => state.players.indexOf(a) - state.players.indexOf(b));

  const queue = [];
  orderedPlayers.forEach((targetId) => {
    const hand = state.hands[targetId];
    const huCheck = canHu([...hand, card], state.fulu[targetId]);
    const fanInfo = huCheck.canHu
      ? evaluateFan([...hand, card], state.fulu[targetId], state.flowers[targetId], { winType: 'dianpao' })
      : { totalFan: 0 };

    if (huCheck.canHu && fanInfo.totalFan > 0) {
      queue.push({ playerId: targetId, action: 'hu', priority: 3 });
    }
    if (countTile(hand, card) >= 3) {
      queue.push({ playerId: targetId, action: 'gang', priority: 2 });
    }
    if (countTile(hand, card) >= 2) {
      queue.push({ playerId: targetId, action: 'peng', priority: 1 });
    }
  });

  return queue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return state.players.indexOf(a.playerId) - state.players.indexOf(b.playerId);
  });
}

function buildSelfOptions(state, playerId) {
  const options = [];
  const hand = state.hands[playerId];
  const huCheck = canHu(hand, state.fulu[playerId]);
  const fanInfo = huCheck.canHu
    ? evaluateFan(hand, state.fulu[playerId], state.flowers[playerId], {
      winType: state.lastDraw?.viaGang ? 'gangshanghua' : 'zimo'
    })
    : { totalFan: 0 };

  if (huCheck.canHu && fanInfo.totalFan > 0) {
    options.push({ action: 'hu' });
  }
  findAnGangOptions(hand).forEach((option) => options.push({ action: 'angang', ...option }));
  findBuGangOptions(hand, state.fulu[playerId]).forEach((option) => options.push({ action: 'bugang', ...option }));
  return options;
}

class MahjongEngine {
  init(room, players) {
    const shan = new Shan();
    const hands = {};
    const fulu = {};
    const flowers = {};

    players.forEach((playerId) => {
      hands[playerId] = [];
      fulu[playerId] = [];
      flowers[playerId] = [];
    });

    for (let round = 0; round < 13; round += 1) {
      players.forEach((playerId) => {
        drawForPlayer({
          players,
          hands,
          fulu,
          flowers,
          shan: shan.snapshot(),
          tingInfo: {}
        }, shan, playerId);
      });
    }

    const state = {
      phase: 'draw',
      players,
      seats: buildSeats(players),
      dealer: players[0],
      currentPlayer: players[0],
      hands,
      fulu,
      flowers,
      discards: Object.fromEntries(players.map((playerId) => [playerId, []])),
      shan: serializeShan(shan),
      remainingTiles: shan.remaining(),
      lastDraw: null,
      lastDiscard: null,
      pendingAction: null,
      winInfo: null,
      scoreInfo: null,
      tingInfo: {},
      timer: 30,
      timerStarted: Date.now()
    };

    updateTingInfo(state);
    return state;
  }

  update(state, action, playerId) {
    if (state.phase === 'finished') return state;

    if (state.phase === 'draw') {
      return this.handleDraw(state, action, playerId);
    }
    if (state.phase === 'discard') {
      return this.handleDiscard(state, action, playerId);
    }
    if (state.phase === 'response') {
      return this.handleResponse(state, action, playerId);
    }
    return state;
  }

  handleDraw(state, action, playerId) {
    if (playerId !== state.currentPlayer) return state;
    if (!['draw', 'draw_done'].includes(action.type)) return state;

    const shan = hydrateShan(state);
    const drawn = drawForPlayer(state, shan, playerId);
    if (!drawn) return state;

    const selfOptions = buildSelfOptions(state, playerId);
    if (selfOptions.length > 0) {
      state.phase = 'response';
      state.pendingAction = {
        type: 'self',
        playerId,
        options: selfOptions
      };
    } else {
      state.phase = 'discard';
      state.pendingAction = null;
    }
    state.timerStarted = Date.now();
    return state;
  }

  handleDiscard(state, action, playerId) {
    if (playerId !== state.currentPlayer || action.type !== 'discard') return state;

    const card = action.card;
    const nextHand = removeTile(state.hands[playerId], card);
    if (!nextHand) return state;

    state.hands[playerId] = nextHand;
    state.discards[playerId].push(card);
    state.lastDiscard = { playerId, card };
    updateTingInfo(state);

    const queue = getDiscardResponses(state, playerId, card);
    if (queue.length > 0) {
      state.phase = 'response';
      state.pendingAction = {
        type: 'claim',
        sourcePlayerId: playerId,
        card,
        queue
      };
      state.timerStarted = Date.now();
      return state;
    }

    state.currentPlayer = nextPlayer(state.players, playerId);
    state.phase = 'draw';
    state.pendingAction = null;
    state.timerStarted = Date.now();
    return state;
  }

  handleResponse(state, action, playerId) {
    const pending = state.pendingAction;
    if (!pending) return state;

    if (pending.type === 'self') {
      if (playerId !== pending.playerId) return state;

      if (action.type === 'hu') {
        resolveHu(state, playerId, playerId, state.lastDraw?.tile || null, state.lastDraw?.viaGang ? 'gangshanghua' : 'zimo');
        return state;
      }

      if (action.type === 'angang') {
        const option = findAnGangOptions(state.hands[playerId]).find((item) => tileKey(item.tile) === tileKey(action.tile || item.tile));
        if (!option) return state;
        let hand = [...state.hands[playerId]];
        option.cards.forEach((tile) => {
          hand = removeTile(hand, tile);
        });
        state.hands[playerId] = hand;
        state.fulu[playerId].push(createMeld('angang', option.cards, playerId));
        state.phase = 'draw';
        state.pendingAction = null;
        state.timerStarted = Date.now();
        const shan = hydrateShan(state);
        drawForPlayer(state, shan, playerId, { viaGang: true });
        const selfOptions = buildSelfOptions(state, playerId);
        if (selfOptions.length > 0) {
          state.phase = 'response';
          state.pendingAction = { type: 'self', playerId, options: selfOptions };
        } else {
          state.phase = 'discard';
        }
        return state;
      }

      if (action.type === 'bugang') {
        const option = findBuGangOptions(state.hands[playerId], state.fulu[playerId]).find((item) => tileKey(item.tile) === tileKey(action.tile || item.tile));
        if (!option) return state;
        const hand = removeTile(state.hands[playerId], option.cards[0]);
        if (!hand) return state;
        state.hands[playerId] = hand;
        const pengIndex = state.fulu[playerId].findIndex((meld) => meld.type === 'peng' && tileKey(meld.tile) === tileKey(option.tile));
        if (pengIndex >= 0) {
          state.fulu[playerId][pengIndex] = createMeld('bugang', [...state.fulu[playerId][pengIndex].cards, option.cards[0]], playerId);
        }
        const shan = hydrateShan(state);
        drawForPlayer(state, shan, playerId, { viaGang: true });
        const selfOptions = buildSelfOptions(state, playerId);
        if (selfOptions.length > 0) {
          state.phase = 'response';
          state.pendingAction = { type: 'self', playerId, options: selfOptions };
        } else {
          state.phase = 'discard';
          state.pendingAction = null;
        }
        state.timerStarted = Date.now();
        return state;
      }

      if (action.type === 'pass' || action.type === 'discard_ready') {
        state.phase = 'discard';
        state.pendingAction = null;
        state.timerStarted = Date.now();
      }
      return state;
    }

    if (pending.type === 'claim') {
      const current = pending.queue[0];
      if (!current || current.playerId !== playerId) return state;
      const card = pending.card;

      if (action.type === 'hu' && current.action === 'hu') {
        state.hands[playerId] = addTile(state.hands[playerId], card);
        resolveHu(state, playerId, pending.sourcePlayerId, card, 'dianpao');
        return state;
      }

      if (action.type === 'gang' && current.action === 'gang') {
        let hand = [...state.hands[playerId]];
        const removed = [];
        for (let i = 0; i < 3; i += 1) {
          const tile = hand.find((item) => tileKey(item) === tileKey(card));
          if (!tile) return state;
          hand = removeTile(hand, tile);
          removed.push(tile);
        }
        state.hands[playerId] = hand;
        state.fulu[playerId].push(createMeld('minggang', [...removed, card], pending.sourcePlayerId));
        state.currentPlayer = playerId;
        state.phase = 'draw';
        state.pendingAction = null;
        const shan = hydrateShan(state);
        drawForPlayer(state, shan, playerId, { viaGang: true });
        const selfOptions = buildSelfOptions(state, playerId);
        if (selfOptions.length > 0) {
          state.phase = 'response';
          state.pendingAction = { type: 'self', playerId, options: selfOptions };
        } else {
          state.phase = 'discard';
        }
        state.timerStarted = Date.now();
        return state;
      }

      if (action.type === 'peng' && current.action === 'peng') {
        let hand = [...state.hands[playerId]];
        const removed = [];
        for (let i = 0; i < 2; i += 1) {
          const tile = hand.find((item) => tileKey(item) === tileKey(card));
          if (!tile) return state;
          hand = removeTile(hand, tile);
          removed.push(tile);
        }
        state.hands[playerId] = hand;
        state.fulu[playerId].push(createMeld('peng', [...removed, card], pending.sourcePlayerId));
        state.currentPlayer = playerId;
        state.phase = 'discard';
        state.pendingAction = null;
        state.timerStarted = Date.now();
        return state;
      }

      pending.queue.shift();
      if (pending.queue.length === 0) {
        state.currentPlayer = nextPlayer(state.players, pending.sourcePlayerId);
        state.phase = 'draw';
        state.pendingAction = null;
      }
      state.timerStarted = Date.now();
      return state;
    }

    return state;
  }

  nextRound(state) {
    const players = state.players;
    const dealer = state.dealerStays ? state.dealer : nextPlayer(players, state.dealer);
    const nextState = this.init(null, players);
    nextState.dealer = dealer;
    nextState.currentPlayer = dealer;
    return nextState;
  }
}

module.exports = {
  MahjongEngine
};
