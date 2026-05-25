const { BOARD_SIZE, EMPTY, BLACK, WHITE, checkWin } = require('../game-engines/gomoku');

// Score patterns for AI evaluation
const SCORES = {
  FIVE: 100000,
  LIVE_FOUR: 10000,
  DEAD_FOUR: 1000,
  LIVE_THREE: 1000,
  DEAD_THREE: 100,
  LIVE_TWO: 100,
  DEAD_TWO: 10
};

function evaluatePosition(board, x, y, player) {
  const opponent = player === BLACK ? WHITE : BLACK;
  let score = 0;
  
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    let count = 1;
    let blocked = 0;
    let emptyEnds = 0;
    
    // Check positive direction
    let i = 1;
    while (i < 5) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
        blocked++;
        break;
      }
      if (board[nx][ny] === player) {
        count++;
      } else if (board[nx][ny] === EMPTY) {
        emptyEnds++;
        break;
      } else {
        blocked++;
        break;
      }
      i++;
    }
    
    // Check negative direction
    i = 1;
    while (i < 5) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
        blocked++;
        break;
      }
      if (board[nx][ny] === player) {
        count++;
      } else if (board[nx][ny] === EMPTY) {
        emptyEnds++;
        break;
      } else {
        blocked++;
        break;
      }
      i++;
    }
    
    // Score based on pattern
    if (count >= 5) {
      score += SCORES.FIVE;
    } else if (count === 4) {
      if (blocked === 0) score += SCORES.LIVE_FOUR;
      else if (blocked === 1) score += SCORES.DEAD_FOUR;
    } else if (count === 3) {
      if (blocked === 0) score += SCORES.LIVE_THREE;
      else if (blocked === 1) score += SCORES.DEAD_THREE;
    } else if (count === 2) {
      if (blocked === 0) score += SCORES.LIVE_TWO;
      else if (blocked === 1) score += SCORES.DEAD_TWO;
    }
  }
  
  return score;
}

function getBestMove(board, aiPlayer) {
  const opponent = aiPlayer === BLACK ? WHITE : BLACK;
  let bestScore = -Infinity;
  let bestMoves = [];
  
  // Only check positions near existing pieces
  const candidates = new Set();
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] !== EMPTY) {
        for (let di = -2; di <= 2; di++) {
          for (let dj = -2; dj <= 2; dj++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < BOARD_SIZE && nj >= 0 && nj < BOARD_SIZE && board[ni][nj] === EMPTY) {
              candidates.add(`${ni},${nj}`);
            }
          }
        }
      }
    }
  }
  
  // If board is empty, play center
  if (candidates.size === 0) {
    return { x: 7, y: 7 };
  }
  
  for (const pos of candidates) {
    const [x, y] = pos.split(',').map(Number);
    
    // Evaluate attack score (AI's perspective)
    board[x][y] = aiPlayer;
    const attackScore = evaluatePosition(board, x, y, aiPlayer);
    board[x][y] = EMPTY;
    
    // Evaluate defense score (opponent's perspective)
    board[x][y] = opponent;
    const defenseScore = evaluatePosition(board, x, y, opponent);
    board[x][y] = EMPTY;
    
    // Combined score with slight preference for attack
    const score = attackScore + defenseScore * 0.9;
    
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [{ x, y }];
    } else if (score === bestScore) {
      bestMoves.push({ x, y });
    }
  }
  
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function gomokuStrategy(state, botId) {
  if (state.phase !== 'playing') return null;
  if (state.currentPlayer !== botId) return null;
  
  const playerIndex = state.players.indexOf(botId);
  const aiPlayer = playerIndex === 0 ? BLACK : WHITE;
  
  const move = getBestMove(state.board, aiPlayer);
  if (!move) return null;
  
  return { type: 'place', x: move.x, y: move.y };
}

module.exports = { gomokuStrategy };
