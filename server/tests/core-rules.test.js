const test = require('node:test');
const assert = require('node:assert/strict');

const { getEngine } = require('../game-engine');
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

test('猜数字达到最大次数后无人获胜', () => {
  const engine = getEngine('guess_number');
  const state = engine.init(null, ['p1', 'p2']);
  state.secret = 50;
  state.currentPlayer = 'p1';

  engine.update(state, { type: 'guess', guess: 101 }, 'p1');
  assert.equal(state.guesses.length, 0);

  for (const guess of [1, 99, 2, 98, 3, 97, 4, 96, 5, 95]) {
    engine.update(state, { type: 'guess', guess }, state.currentPlayer);
  }

  assert.equal(state.phase, 'finished');
  assert.equal(state.winner, null);
  assert.equal(state.finalWinner, null);
  assert.equal(state.guesses.length, 10);
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
