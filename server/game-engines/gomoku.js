const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const DIRECTIONS = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diagonal
  [1, -1]   // anti-diagonal
];

function createBoard() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
}

function checkWin(board, x, y, player) {
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    
    // positive direction
    for (let i = 1; i < 5; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && board[nx][ny] === player) {
        count++;
      } else {
        break;
      }
    }
    
    // negative direction
    for (let i = 1; i < 5; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && board[nx][ny] === player) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 5) return true;
  }
  return false;
}

function isBoardFull(board) {
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (board[i][j] === EMPTY) return false;
    }
  }
  return true;
}

class GomokuEngine {
  init(room, players) {
    return {
      phase: 'playing',
      board: createBoard(),
      players,
      currentPlayer: players[0],
      lastMove: null,
      winner: null,
      moveHistory: [],
      timer: 30,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (state.phase !== 'playing') return state;

    if (action.type === 'undo') {
      const lastMove = state.moveHistory[state.moveHistory.length - 1];
      if (!lastMove || lastMove.player !== playerId) return state;

      state.moveHistory.pop();
      state.board[lastMove.x][lastMove.y] = EMPTY;
      state.currentPlayer = lastMove.player;
      state.lastMove = state.moveHistory.length > 0 
        ? state.moveHistory[state.moveHistory.length - 1] 
        : null;
      state.timerStarted = Date.now();
      return state;
    }

    if (playerId !== state.currentPlayer) return state;

    if (action.type === 'place') {
      const { x, y } = action;
      if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return state;
      if (state.board[x][y] !== EMPTY) return state;

      const playerIndex = state.players.indexOf(playerId);
      const piece = playerIndex === 0 ? BLACK : WHITE;

      state.board[x][y] = piece;
      state.lastMove = { x, y };
      state.moveHistory.push({ x, y, player: playerId });

      if (checkWin(state.board, x, y, piece)) {
        state.phase = 'finished';
        state.winner = playerId;
      } else if (isBoardFull(state.board)) {
        state.phase = 'finished';
        state.winner = 'draw';
      } else {
        const nextIndex = (playerIndex + 1) % state.players.length;
        state.currentPlayer = state.players[nextIndex];
      }

      state.timerStarted = Date.now();
    }

    return state;
  }

  nextRound(state) {
    return this.init(null, state.players);
  }
}

module.exports = {
  GomokuEngine,
  BOARD_SIZE,
  EMPTY,
  BLACK,
  WHITE,
  checkWin,
  isBoardFull
};
