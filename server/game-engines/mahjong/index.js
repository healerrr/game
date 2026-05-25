const { Shan } = require('./shan');
const { sortTiles, tileKey, sameTile, isZhong } = require('./tiles');
const { addTile, removeTile, countTile, findAnGangOptions, findBuGangOptions, findPengOptions, findMingGangOptions, createMeld } = require('./shoupai');
const { canHu, getWaitTiles } = require('./hule');
const { evaluateFan } = require('./fan');

const SEAT_ORDER = ['south', 'west', 'north', 'east'];
const BASE_SCORE = 1; // 底分
const LIUJU_THRESHOLD = 4; // 牌山剩余<=4张时流局

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
      rank: tile.rank
    }));
  });
  state.tingInfo = tingInfo;
}

// 摸牌：简单从牌山取一张牌
function drawForPlayer(state, shan, playerId, meta = {}) {
  const drawn = shan.draw();
  if (!drawn) {
    // 牌山为空，流局
    state.phase = 'finished';
    state.finalWinner = null;
    state.winInfo = null;
    state.scoreInfo = { type: 'draw' };
    syncRemaining(state, shan);
    return null;
  }

  state.hands[playerId] = addTile(state.hands[playerId], drawn);
  state.lastDraw = { playerId, tile: drawn, ...meta };
  syncRemaining(state, shan);
  updateTingInfo(state);
  return drawn;
}

// 检查流局条件：牌山剩余牌数 <= LIUJU_THRESHOLD
function checkLiuju(state) {
  if (state.remainingTiles <= LIUJU_THRESHOLD) {
    state.phase = 'finished';
    state.finalWinner = null;
    state.winInfo = null;
    state.scoreInfo = { type: 'draw' };
    return true;
  }
  return false;
}

// 杠分即时结算
function settleGangScore(state, gangPlayerId, gangType, fromPlayerId) {
  const players = state.players;

  if (gangType === 'angang') {
    // 暗杠：三家各赔2倍
    for (const pid of players) {
      if (pid !== gangPlayerId) {
        state.scores[pid] -= BASE_SCORE * 2;
        state.scores[gangPlayerId] += BASE_SCORE * 2;
      }
    }
  } else if (gangType === 'bugang') {
    // 补杠：三家各赔1倍
    for (const pid of players) {
      if (pid !== gangPlayerId) {
        state.scores[pid] -= BASE_SCORE * 1;
        state.scores[gangPlayerId] += BASE_SCORE * 1;
      }
    }
  } else if (gangType === 'minggang') {
    // 明杠(点杠)：放杠者赔3倍
    state.scores[fromPlayerId] -= BASE_SCORE * 3;
    state.scores[gangPlayerId] += BASE_SCORE * 3;
  }
}

// 胡牌结算
function settleHuScore(state, winnerId, sourcePlayerId, winType, fan) {
  const players = state.players;

  if (winType === 'zimo' || winType === 'gangshanghua' || winType === 'sizhong') {
    // 自摸/杠上花/四红中：三家各赔 fan × 底分
    for (const pid of players) {
      if (pid !== winnerId) {
        state.scores[pid] -= fan * BASE_SCORE;
        state.scores[winnerId] += fan * BASE_SCORE;
      }
    }
  } else if (winType === 'qianggang') {
    // 抢杠胡：被抢杠者包赔 fan × 底分 × 3
    state.scores[sourcePlayerId] -= fan * BASE_SCORE * 3;
    state.scores[winnerId] += fan * BASE_SCORE * 3;
  } else {
    // 点炮：放炮者赔 fan × 底分 × 3
    state.scores[sourcePlayerId] -= fan * BASE_SCORE * 3;
    state.scores[winnerId] += fan * BASE_SCORE * 3;
  }
}

// 胡牌处理
function resolveHu(state, winnerId, sourcePlayerId, winTile, winType) {
  const hand = state.hands[winnerId];
  const fulu = state.fulu[winnerId];
  const fanResult = evaluateFan(hand, fulu, winTile, winType);
  const fan = fanResult.fan;

  state.phase = 'finished';
  state.finalWinner = winnerId;
  state.winningPlayers = [winnerId];
  state.winInfo = {
    winnerId,
    sourcePlayerId,
    winTile,
    winType,
    fan: fan,
    detail: fanResult.detail
  };

  // 结算分数
  settleHuScore(state, winnerId, sourcePlayerId, winType, fan);

  state.scoreInfo = {
    type: winType === 'zimo' || winType === 'gangshanghua' || winType === 'sizhong' ? 'self_draw' : 'discard',
    payerIds: winType === 'zimo' || winType === 'gangshanghua' || winType === 'sizhong'
      ? state.players.filter((id) => id !== winnerId)
      : [sourcePlayerId]
  };

  if (state.dealer === winnerId) {
    state.dealerStays = true;
  }
  return true;
}

// 检查四红中
function checkSiZhong(state, playerId) {
  const hand = state.hands[playerId];
  const zhongCount = hand.filter(t => isZhong(t)).length;
  if (zhongCount >= 4) {
    resolveHu(state, playerId, null, null, 'sizhong');
    return true;
  }
  return false;
}

function getDiscardResponses(state, playerId, card) {
  const orderedPlayers = state.players
    .filter((id) => id !== playerId)
    .sort((a, b) => state.players.indexOf(a) - state.players.indexOf(b));

  const queue = [];
  orderedPlayers.forEach((targetId) => {
    const hand = state.hands[targetId];
    const fulu = state.fulu[targetId];

    // canHu 返回 boolean
    if (canHu([...hand, card], fulu)) {
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
  const fulu = state.fulu[playerId];

  // canHu 返回 boolean
  if (canHu(hand, fulu)) {
    options.push({ action: 'hu' });
  }
  findAnGangOptions(hand).forEach((option) => options.push({ action: 'angang', ...option }));
  findBuGangOptions(hand, fulu).forEach((option) => options.push({ action: 'bugang', ...option }));
  return options;
}

class MahjongEngine {
  init(room, players) {
    const shan = new Shan();
    const hands = {};
    const fulu = {};
    const scores = {};

    players.forEach((playerId) => {
      hands[playerId] = [];
      fulu[playerId] = [];
      scores[playerId] = 0;
    });

    // 每人发13张
    for (let round = 0; round < 13; round += 1) {
      players.forEach((playerId) => {
        const tile = shan.draw();
        if (tile) {
          hands[playerId] = addTile(hands[playerId], tile);
        }
      });
    }

    const state = {
      phase: 'draw',
      players,
      playerOrder: players,
      seats: buildSeats(players),
      dealer: players[0],
      currentPlayer: players[0],
      hands,
      fulu,
      scores,
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

    // 检查流局
    if (checkLiuju(state)) return state;

    const shan = hydrateShan(state);
    const drawn = drawForPlayer(state, shan, playerId);
    if (!drawn) return state;

    // 检查四红中
    if (checkSiZhong(state, playerId)) return state;

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
        const winType = state.lastDraw?.viaGang ? 'gangshanghua' : 'zimo';
        resolveHu(state, playerId, playerId, state.lastDraw?.tile || null, winType);
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

        // 暗杠即时结算
        settleGangScore(state, playerId, 'angang', null);

        // 杠后摸牌
        const shan = hydrateShan(state);
        const drawn = drawForPlayer(state, shan, playerId, { viaGang: true });
        if (!drawn) return state;

        // 检查四红中
        if (checkSiZhong(state, playerId)) return state;

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

      if (action.type === 'bugang') {
        const option = findBuGangOptions(state.hands[playerId], state.fulu[playerId]).find((item) => tileKey(item.tile) === tileKey(action.tile || item.tile));
        if (!option) return state;
        const hand = removeTile(state.hands[playerId], option.cards[0]);
        if (!hand) return state;
        state.hands[playerId] = hand;

        const bugangTile = option.tile;

        // 检查其他三家是否能抢杠胡
        const otherPlayerIds = state.players.filter(id => id !== playerId);
        const qianggangResponders = [];
        for (const otherId of otherPlayerIds) {
          const otherHand = state.hands[otherId];
          const otherFulu = state.fulu[otherId];
          if (canHu([...otherHand, bugangTile], otherFulu)) {
            qianggangResponders.push(otherId);
          }
        }

        if (qianggangResponders.length > 0) {
          // 进入抢杠胡等待阶段
          state.phase = 'response';
          state.pendingAction = {
            type: 'qianggang',
            sourcePlayerId: playerId,
            tile: bugangTile,
            option: option,
            queue: qianggangResponders.map(id => ({
              playerId: id,
              action: 'hu',
              priority: 3
            }))
          };
          state.timerStarted = Date.now();
          return state;
        }

        // 无人能抢杠，完成补杠
        this.completeBugang(state, playerId, option, bugangTile);
        return state;
      }

      if (action.type === 'pass' || action.type === 'discard_ready') {
        state.phase = 'discard';
        state.pendingAction = null;
        state.timerStarted = Date.now();
      }
      return state;
    }

    if (pending.type === 'qianggang') {
      // 抢杠胡响应
      const current = pending.queue[0];
      if (!current || current.playerId !== playerId) return state;

      if (action.type === 'hu') {
        // 抢杠胡成功
        const winnerId = playerId;
        const bugangTile = pending.tile;
        state.hands[winnerId] = addTile(state.hands[winnerId], bugangTile);
        resolveHu(state, winnerId, pending.sourcePlayerId, bugangTile, 'qianggang');
        return state;
      }

      // pass - 跳过该玩家
      pending.queue.shift();
      if (pending.queue.length === 0) {
        // 所有人都pass，完成补杠
        this.completeBugang(state, pending.sourcePlayerId, pending.option, pending.tile);
      }
      state.timerStarted = Date.now();
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

        // 明杠即时结算
        settleGangScore(state, playerId, 'minggang', pending.sourcePlayerId);

        // 杠后摸牌
        const shan = hydrateShan(state);
        const drawn = drawForPlayer(state, shan, playerId, { viaGang: true });
        if (!drawn) return state;

        // 检查四红中
        if (checkSiZhong(state, playerId)) return state;

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

  // 完成补杠操作
  completeBugang(state, playerId, option, bugangTile) {
    const pengIndex = state.fulu[playerId].findIndex((meld) => meld.type === 'peng' && tileKey(meld.tile) === tileKey(bugangTile));
    if (pengIndex >= 0) {
      state.fulu[playerId][pengIndex] = createMeld('bugang', [...state.fulu[playerId][pengIndex].cards, option.cards[0]], playerId);
    }

    // 补杠即时结算
    settleGangScore(state, playerId, 'bugang', null);

    // 杠后摸牌
    const shan = hydrateShan(state);
    const drawn = drawForPlayer(state, shan, playerId, { viaGang: true });
    if (!drawn) return;

    // 检查四红中
    if (checkSiZhong(state, playerId)) return;

    const selfOptions = buildSelfOptions(state, playerId);
    if (selfOptions.length > 0) {
      state.phase = 'response';
      state.pendingAction = { type: 'self', playerId, options: selfOptions };
    } else {
      state.phase = 'discard';
      state.pendingAction = null;
    }
    state.timerStarted = Date.now();
  }

  nextRound(state) {
    const players = state.players;
    const dealer = state.dealerStays ? state.dealer : nextPlayer(players, state.dealer);
    const nextState = this.init(null, players);
    nextState.dealer = dealer;
    nextState.currentPlayer = dealer;
    // 保留累计分数
    if (state.scores) {
      nextState.scores = { ...state.scores };
    }
    return nextState;
  }
}

module.exports = {
  MahjongEngine
};
