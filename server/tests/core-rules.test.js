const test = require('node:test');
const assert = require('node:assert/strict');

const { getEngine, getGameConfig } = require('../game-engine');
const store = require('../store');
const { handleActionTimeout, handleGameEnd } = require('../index');
const { GomokuEngine, EMPTY } = require('../game-engines/gomoku');
const {
  ChessEngine,
  ROWS,
  COLS,
  PIECE_TYPES,
  COLORS,
  getLegalMoves,
  isKingInCheck
} = require('../game-engines/chess');

function emptyChessBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function saveRoomPlayers(roomId, players, points = 1000) {
  players.forEach((id, index) => {
    store.savePlayer({
      id,
      nickname: id,
      busNumber: index + 1,
      points,
      totalGames: 0,
      wins: 0,
      winStreak: 0,
      lossStreak: 0,
      online: true,
      currentRoom: roomId
    });
  });
}

function cleanupRoomPlayers(roomId, players) {
  store.removeRoom(roomId);
  players.forEach(id => store.removePlayer(id));
}

test('剪刀石头布提交后不能重复改拳', () => {
  const engine = getEngine('rock_paper_scissors');
  const state = engine.init(null, ['p1', 'p2']);

  engine.update(state, { type: 'choose', choice: 'rock' }, 'p1');
  engine.update(state, { type: 'choose', choice: 'paper' }, 'p1');

  assert.equal(state.choices.p1, 'rock');
});

test('剪刀石头布平局会继续加赛而不是直接结算', () => {
  const engine = getEngine('rock_paper_scissors');
  const state = engine.init(null, ['p1', 'p2']);

  engine.update(state, { type: 'choose', choice: 'rock' }, 'p1');
  engine.update(state, { type: 'choose', choice: 'rock' }, 'p2');
  engine.nextRound(state);

  assert.equal(state.phase, 'choose');
  assert.deepEqual(state.choices, {});
  assert.equal(state.finalWinner, undefined);
});

test('剪刀石头布三局两胜先到2分才结算', () => {
  const engine = getEngine('rock_paper_scissors');
  const state = engine.init(null, ['p1', 'p2']);

  engine.update(state, { type: 'choose', choice: 'rock' }, 'p1');
  engine.update(state, { type: 'choose', choice: 'scissors' }, 'p2');

  assert.equal(state.phase, 'reveal');
  assert.equal(state.scores.p1, 1);
  assert.equal(state.finalWinner, undefined);
  assert.equal(state.timer, 3);

  engine.nextRound(state);
  engine.update(state, { type: 'choose', choice: 'paper' }, 'p1');
  engine.update(state, { type: 'choose', choice: 'rock' }, 'p2');

  assert.equal(state.phase, 'reveal');
  assert.equal(state.finalWinner, undefined);
  assert.equal(state.scores.p1, 2);

  engine.nextRound(state);

  assert.equal(state.phase, 'finished');
  assert.equal(state.finalWinner, 'p1');
  assert.deepEqual(state.winningPlayers, ['p1']);
  assert.equal(state.scores.p1, 2);
});

test('猜点数按开奖结果标记所有猜中玩家', () => {
  const engine = getEngine('guess_dice');
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  engine.update(state, { type: 'guess', guess: 1 }, 'p1');
  engine.update(state, { type: 'guess', guess: 2 }, 'p2');
  engine.update(state, { type: 'guess', guess: 3 }, 'p3');

  assert.equal(state.phase, 'finished');
  assert.ok(state.dice >= 1 && state.dice <= 6);
  assert.deepEqual(
    state.winningPlayers,
    state.players.filter(pid => state.guesses[pid].guess === state.dice)
  );
  assert.equal(state.finalWinner, state.winningPlayers[0] || null);
});

test('猜点数超时未选时无人猜中', () => {
  const engine = getEngine('guess_dice');
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  engine.nextRound(state);

  assert.equal(state.phase, 'finished');
  assert.deepEqual(state.winningPlayers, []);
  assert.equal(state.finalWinner, null);
  assert.equal(state.guesses.p1.timeout, true);
  assert.equal(state.guesses.p1.guess, null);
});

test('猜点数无人猜中时平局不扣分', async () => {
  const roomId = `room-guess-draw-${Date.now()}`;
  const players = ['guess-draw-p1', 'guess-draw-p2', 'guess-draw-p3'];
  players.forEach((id) => {
    store.savePlayer({
      id,
      nickname: id,
      busNumber: 1,
      points: 1000,
      totalGames: 0,
      wins: 0,
      winStreak: 0,
      lossStreak: 0,
      online: true,
      currentRoom: roomId
    });
  });

  const room = {
    id: roomId,
    gameType: 'guess_dice',
    status: 'playing',
    mode: 'normal',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: {
      phase: 'finished',
      players,
      dice: 6,
      guesses: {
        [players[0]]: { guess: 1 },
        [players[1]]: { guess: 2 },
        [players[2]]: { guess: 3 }
      },
      finalWinner: null,
      winningPlayers: []
    }
  };
  store.saveRoom(room);

  handleGameEnd(room);

  players.forEach((id) => {
    const player = store.getPlayer(id);
    assert.equal(player.points, 1000);
    assert.equal(player.totalGames, 1);
    assert.equal(player.wins, 0);
    assert.equal(player.winStreak, 0);
    assert.equal(player.lossStreak, 0);
  });

  const records = await store.getPlayerGameRecords(players[0], 1);
  assert.equal(records[0].result, 'draw');
  assert.equal(records[0].scoreDelta, 0);

  store.removeRoom(roomId);
  players.forEach(id => store.removePlayer(id));
});

test('21点支持2到4人并隐藏其他玩家手牌', () => {
  const config = getGameConfig('blackjack');
  assert.equal(config.minPlayers, 2);
  assert.equal(config.maxPlayers, 4);

  const engine = getEngine('blackjack');
  const state = engine.init(null, ['p1', 'p2', 'p3', 'p4']);
  const view = engine.getPlayerView(state, 'p1');

  assert.deepEqual(Object.keys(view.hands), ['p1']);
  assert.equal(view.hands.p1.length, 2);
  assert.deepEqual(view.handCounts, { p1: 2, p2: 2, p3: 2, p4: 2 });
  assert.equal(typeof view.deckCount, 'number');
  assert.equal(view.deck, undefined);
});

test('blackjack ignores unknown actions without advancing turn', () => {
  const engine = getEngine('blackjack');
  const state = engine.init(null, ['p1', 'p2', 'p3']);

  engine.update(state, { type: 'dance' }, 'p1');

  assert.equal(state.currentPlayer, 'p1');
  assert.deepEqual(state.finishedPlayers, []);
});

test('快问快答每局只有三道高难度题', () => {
  const engine = getEngine('quiz');
  const state = engine.init(null, ['p1', 'p2']);

  assert.equal(state.maxRounds, 3);
  assert.equal(state.questions.length, 3);
  assert.equal(state.currentQuestion.options.length, 4);
  assert.equal(new Set(state.questions.map(question => question.q)).size, 3);
  assert.ok(new Set(state.questions.map(question => question.category)).size >= 2);
  state.questions.forEach((question) => {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.ok(question.answer >= 0 && question.answer < question.options.length);
  });
});

test('五子棋忽略悔棋动作', () => {
  const engine = new GomokuEngine();
  const state = engine.init(null, ['p1', 'p2']);

  engine.update(state, { type: 'place', x: 7, y: 7 }, 'p1');
  engine.update(state, { type: 'undo' }, 'p2');

  assert.notEqual(state.board[7][7], EMPTY);
  assert.equal(state.moveHistory.length, 1);

  assert.equal(state.currentPlayer, 'p2');
});

test('gomoku ignores invalid coordinates without throwing', () => {
  const engine = new GomokuEngine();
  const state = engine.init(null, ['p1', 'p2']);

  assert.doesNotThrow(() => {
    engine.update(state, { type: 'place', x: undefined, y: 1 }, 'p1');
    engine.update(state, { type: 'place', x: 100, y: 1 }, 'p1');
  });
  assert.equal(state.currentPlayer, 'p1');
  assert.equal(state.moveHistory.length, 0);
});

test('五子棋当前玩家30秒未落子自动判负', () => {
  const roomId = `room-gomoku-timeout-${Date.now()}`;
  const players = ['gomoku-timeout-p1', 'gomoku-timeout-p2'];
  saveRoomPlayers(roomId, players);
  const engine = new GomokuEngine();
  const room = {
    id: roomId,
    gameType: 'gomoku',
    status: 'playing',
    mode: 'normal',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: engine.init(null, players)
  };
  room.gameState.timerStarted = Date.now() - 31000;
  store.saveRoom(room);

  handleActionTimeout(room);

  assert.equal(room.status, 'finished');
  assert.equal(room.gameState.phase, 'finished');
  assert.equal(room.gameState.finalWinner, players[1]);
  assert.equal(room.gameState.winner, players[1]);
  assert.deepEqual(room.gameState.winningPlayers, [players[1]]);
  assert.deepEqual(room.gameState.forfeit, { playerId: players[0], reason: 'action_timeout' });
  assert.equal(store.getPlayer(players[0]).points, 970);
  assert.equal(store.getPlayer(players[1]).points, 1030);

  cleanupRoomPlayers(roomId, players);
});

test('象棋将帅照面会被视为将军并阻止露将移动', () => {
  const board = emptyChessBoard();
  board[0][4] = { type: PIECE_TYPES.KING, color: COLORS.BLACK };
  board[9][4] = { type: PIECE_TYPES.KING, color: COLORS.RED };

  assert.equal(isKingInCheck(board, COLORS.RED), true);

  board[5][4] = { type: PIECE_TYPES.ROOK, color: COLORS.RED };
  assert.equal(isKingInCheck(board, COLORS.RED), false);

  const moves = getLegalMoves(board, 5, 4);
  assert.equal(moves.some(move => move.row === 5 && move.col === 5), false);
});

test('chess ignores invalid coordinates without throwing', () => {
  const engine = new ChessEngine();
  const state = engine.init(null, ['p1', 'p2']);

  assert.doesNotThrow(() => {
    engine.update(state, { type: 'select', row: undefined, col: 0 }, 'p1');
    engine.update(state, { type: 'move', fromRow: 100, fromCol: 0, row: 5, col: 0 }, 'p1');
    getLegalMoves(state.board, undefined, 0);
  });
  assert.equal(state.currentPlayer, COLORS.RED);
  assert.equal(state.moveHistory.length, 0);
});

test('象棋忽略悔棋动作', () => {
  const engine = new ChessEngine();
  const state = engine.init(null, ['p1', 'p2']);

  engine.update(state, { type: 'move', fromRow: 6, fromCol: 0, row: 5, col: 0 }, 'p1');
  engine.update(state, { type: 'undo' }, 'p2');

  assert.equal(state.board[5][0]?.type, PIECE_TYPES.PAWN);
  assert.equal(state.moveHistory.length, 1);
  assert.equal(state.currentPlayer, COLORS.BLACK);

  engine.update(state, { type: 'undo' }, 'p1');

  assert.equal(state.board[5][0]?.type, PIECE_TYPES.PAWN);
  assert.equal(state.board[6][0], null);
  assert.equal(state.moveHistory.length, 1);
  assert.equal(state.currentPlayer, COLORS.BLACK);
});

test('chess draw offer finishes as draw when opponent accepts', () => {
  const engine = new ChessEngine();
  const state = engine.init(null, ['p1', 'p2']);

  engine.update(state, { type: 'offer_draw' }, 'p1');

  assert.equal(state.phase, 'playing');
  assert.equal(state.drawOffer.playerId, 'p1');
  assert.equal(state.drawOffer.color, COLORS.RED);

  engine.update(state, { type: 'offer_draw' }, 'p2');

  assert.equal(state.phase, 'finished');
  assert.equal(state.winner, 'draw');
  assert.equal(state.finalWinner, 'draw');
  assert.deepEqual(state.winningPlayers, []);
  assert.equal(state.drawOffer, null);
});

test('chess winner keeps color display and player id settlement winner', () => {
  const engine = new ChessEngine();
  const state = engine.init(null, ['p1', 'p2']);
  state.board = emptyChessBoard();
  state.board[9][4] = { type: PIECE_TYPES.KING, color: COLORS.RED };
  state.board[1][4] = { type: PIECE_TYPES.ROOK, color: COLORS.RED };
  state.board[0][4] = { type: PIECE_TYPES.KING, color: COLORS.BLACK };
  state.currentPlayer = COLORS.RED;

  engine.update(state, { type: 'move', fromRow: 1, fromCol: 4, row: 0, col: 4 }, 'p1');

  assert.equal(state.phase, 'finished');
  assert.equal(state.winner, COLORS.RED);
  assert.equal(state.finalWinner, 'p1');
  assert.deepEqual(state.winningPlayers, ['p1']);
});

test('象棋当前玩家60秒未行棋自动判负', () => {
  const roomId = `room-chess-timeout-${Date.now()}`;
  const players = ['chess-timeout-p1', 'chess-timeout-p2'];
  saveRoomPlayers(roomId, players);
  const engine = new ChessEngine();
  const room = {
    id: roomId,
    gameType: 'chess',
    status: 'playing',
    mode: 'normal',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: engine.init(null, players)
  };
  room.gameState.timerStarted = Date.now() - 61000;
  store.saveRoom(room);

  handleActionTimeout(room);

  assert.equal(room.status, 'finished');
  assert.equal(room.gameState.phase, 'finished');
  assert.equal(room.gameState.finalWinner, players[1]);
  assert.equal(room.gameState.winner, COLORS.BLACK);
  assert.deepEqual(room.gameState.winningPlayers, [players[1]]);
  assert.deepEqual(room.gameState.forfeit, { playerId: players[0], reason: 'action_timeout' });
  assert.equal(store.getPlayer(players[0]).points, 950);
  assert.equal(store.getPlayer(players[1]).points, 1050);

  cleanupRoomPlayers(roomId, players);
});

test('象棋当前玩家未超60秒时不会被45秒掉线宽限提前判负', () => {
  const roomId = `room-chess-offline-grace-${Date.now()}`;
  const players = ['chess-grace-p1', 'chess-grace-p2'];
  saveRoomPlayers(roomId, players);
  const engine = new ChessEngine();
  const room = {
    id: roomId,
    gameType: 'chess',
    status: 'playing',
    mode: 'normal',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: engine.init(null, players)
  };
  room.gameState.timerStarted = Date.now() - 46000;
  room.seatStates[players[0]] = { ready: true, connection: 'offline', intent: 'active', disconnectedAt: Date.now() - 46000 };
  const p1 = store.getPlayer(players[0]);
  p1.online = false;
  p1.currentRoom = roomId;
  store.savePlayer(p1);
  store.saveRoom(room);

  handleActionTimeout(room);

  assert.equal(room.status, 'playing');
  assert.equal(room.gameState.phase, 'playing');
  assert.equal(room.gameState.finalWinner, null);
  assert.equal(store.getPlayer(players[0]).points, 1000);
  assert.equal(store.getPlayer(players[1]).points, 1000);

  cleanupRoomPlayers(roomId, players);
});
