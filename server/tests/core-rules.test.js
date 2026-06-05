const test = require('node:test');
const assert = require('node:assert/strict');

const { getEngine, getGameConfig } = require('../game-engine');
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
  assert.equal(state.timer, 1);

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
