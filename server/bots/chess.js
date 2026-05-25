const { 
  COLORS, 
  PIECE_VALUES, 
  getLegalMoves, 
  evaluateBoard,
  ROWS,
  COLS
} = require('../game-engines/chess');

const DEPTH = 2;

function minimax(board, depth, alpha, beta, isMaximizing, aiColor) {
  if (depth === 0) {
    return evaluateBoard(board);
  }
  
  const currentColor = isMaximizing ? aiColor : (aiColor === COLORS.RED ? COLORS.BLACK : COLORS.RED);
  let bestScore = isMaximizing ? -Infinity : Infinity;
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.color === currentColor) {
        const moves = getLegalMoves(board, r, c);
        for (const move of moves) {
          // Make move
          const captured = board[move.row][move.col];
          board[move.row][move.col] = piece;
          board[r][c] = null;
          
          const score = minimax(board, depth - 1, alpha, beta, !isMaximizing, aiColor);
          
          // Undo move
          board[r][c] = piece;
          board[move.row][move.col] = captured;
          
          if (isMaximizing) {
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);
          } else {
            bestScore = Math.min(bestScore, score);
            beta = Math.min(beta, score);
          }
          
          if (beta <= alpha) break;
        }
      }
    }
  }
  
  return bestScore;
}

function getBestMove(board, aiColor) {
  let bestScore = -Infinity;
  let bestMove = null;
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece && piece.color === aiColor) {
        const moves = getLegalMoves(board, r, c);
        for (const move of moves) {
          // Make move
          const captured = board[move.row][move.col];
          board[move.row][move.col] = piece;
          board[r][c] = null;
          
          const score = minimax(board, DEPTH - 1, -Infinity, Infinity, false, aiColor);
          
          // Undo move
          board[r][c] = piece;
          board[move.row][move.col] = captured;
          
          if (score > bestScore) {
            bestScore = score;
            bestMove = { from: { row: r, col: c }, to: move };
          }
        }
      }
    }
  }
  
  return bestMove;
}

function chessStrategy(state, botId) {
  if (state.phase !== 'playing') return null;
  
  const playerIndex = state.players.indexOf(botId);
  const aiColor = playerIndex === 0 ? COLORS.RED : COLORS.BLACK;
  
  if (state.currentPlayer !== aiColor) return null;
  
  const move = getBestMove(state.board, aiColor);
  if (!move) return null;
  
  return { 
    type: 'move', 
    row: move.to.row, 
    col: move.to.col,
    fromRow: move.from.row,
    fromCol: move.from.col
  };
}

module.exports = { chessStrategy };
