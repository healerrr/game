const ROWS = 10;
const COLS = 9;

const PIECE_TYPES = {
  KING: 'king',       // 将/帅
  ADVISOR: 'advisor', // 士/仕
  BISHOP: 'bishop',   // 象/相
  ROOK: 'rook',       // 车
  KNIGHT: 'knight',   // 马
  CANNON: 'cannon',   // 炮
  PAWN: 'pawn'        // 卒/兵
};

const COLORS = {
  RED: 'red',
  BLACK: 'black'
};

const PIECE_VALUES = {
  [PIECE_TYPES.KING]: 10000,
  [PIECE_TYPES.ROOK]: 900,
  [PIECE_TYPES.CANNON]: 450,
  [PIECE_TYPES.KNIGHT]: 400,
  [PIECE_TYPES.BISHOP]: 200,
  [PIECE_TYPES.ADVISOR]: 200,
  [PIECE_TYPES.PAWN]: 100
};

function createPiece(type, color) {
  return { type, color };
}

function initBoard() {
  const board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  
  // Black pieces (top)
  board[0][0] = createPiece(PIECE_TYPES.ROOK, COLORS.BLACK);
  board[0][1] = createPiece(PIECE_TYPES.KNIGHT, COLORS.BLACK);
  board[0][2] = createPiece(PIECE_TYPES.BISHOP, COLORS.BLACK);
  board[0][3] = createPiece(PIECE_TYPES.ADVISOR, COLORS.BLACK);
  board[0][4] = createPiece(PIECE_TYPES.KING, COLORS.BLACK);
  board[0][5] = createPiece(PIECE_TYPES.ADVISOR, COLORS.BLACK);
  board[0][6] = createPiece(PIECE_TYPES.BISHOP, COLORS.BLACK);
  board[0][7] = createPiece(PIECE_TYPES.KNIGHT, COLORS.BLACK);
  board[0][8] = createPiece(PIECE_TYPES.ROOK, COLORS.BLACK);
  board[2][1] = createPiece(PIECE_TYPES.CANNON, COLORS.BLACK);
  board[2][7] = createPiece(PIECE_TYPES.CANNON, COLORS.BLACK);
  for (let i = 0; i < 9; i += 2) {
    board[3][i] = createPiece(PIECE_TYPES.PAWN, COLORS.BLACK);
  }
  
  // Red pieces (bottom)
  board[9][0] = createPiece(PIECE_TYPES.ROOK, COLORS.RED);
  board[9][1] = createPiece(PIECE_TYPES.KNIGHT, COLORS.RED);
  board[9][2] = createPiece(PIECE_TYPES.BISHOP, COLORS.RED);
  board[9][3] = createPiece(PIECE_TYPES.ADVISOR, COLORS.RED);
  board[9][4] = createPiece(PIECE_TYPES.KING, COLORS.RED);
  board[9][5] = createPiece(PIECE_TYPES.ADVISOR, COLORS.RED);
  board[9][6] = createPiece(PIECE_TYPES.BISHOP, COLORS.RED);
  board[9][7] = createPiece(PIECE_TYPES.KNIGHT, COLORS.RED);
  board[9][8] = createPiece(PIECE_TYPES.ROOK, COLORS.RED);
  board[7][1] = createPiece(PIECE_TYPES.CANNON, COLORS.RED);
  board[7][7] = createPiece(PIECE_TYPES.CANNON, COLORS.RED);
  for (let i = 0; i < 9; i += 2) {
    board[6][i] = createPiece(PIECE_TYPES.PAWN, COLORS.RED);
  }
  
  return board;
}

function isInPalace(row, col, color) {
  if (col < 3 || col > 5) return false;
  if (color === COLORS.BLACK) return row >= 0 && row <= 2;
  return row >= 7 && row <= 9;
}

function isOwnSide(row, color) {
  if (color === COLORS.BLACK) return row <= 4;
  return row >= 5;
}

function getValidMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  
  const moves = [];
  const { type, color } = piece;
  
  const addMove = (r, c) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    const target = board[r][c];
    if (!target || target.color !== color) {
      moves.push({ row: r, col: c });
    }
  };
  
  switch (type) {
    case PIECE_TYPES.KING:
      // Move one step orthogonally within palace
      [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
        const nr = row + dr, nc = col + dc;
        if (isInPalace(nr, nc, color)) addMove(nr, nc);
      });
      break;
      
    case PIECE_TYPES.ADVISOR:
      // Move one step diagonally within palace
      [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr, dc]) => {
        const nr = row + dr, nc = col + dc;
        if (isInPalace(nr, nc, color)) addMove(nr, nc);
      });
      break;
      
    case PIECE_TYPES.BISHOP:
      // Move two steps diagonally, cannot cross river, check eye
      [[2,2],[2,-2],[-2,2],[-2,-2]].forEach(([dr, dc]) => {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && 
            isOwnSide(nr, color) && !board[row + dr/2][col + dc/2]) {
          addMove(nr, nc);
        }
      });
      break;
      
    case PIECE_TYPES.ROOK:
      // Move any distance orthogonally
      [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
        let nr = row + dr, nc = col + dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          if (!board[nr][nc]) {
            moves.push({ row: nr, col: nc });
          } else {
            if (board[nr][nc].color !== color) moves.push({ row: nr, col: nc });
            break;
          }
          nr += dr;
          nc += dc;
        }
      });
      break;
      
    case PIECE_TYPES.KNIGHT:
      // Move in L shape, check hobbling leg
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const legR = row + (Math.abs(dr) === 2 ? dr/2 : 0);
          const legC = col + (Math.abs(dc) === 2 ? dc/2 : 0);
          if (!board[legR][legC]) addMove(nr, nc);
        }
      });
      break;
      
    case PIECE_TYPES.CANNON:
      // Move like rook, capture by jumping one piece
      [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
        let nr = row + dr, nc = col + dc;
        let jumped = false;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          if (!jumped) {
            if (!board[nr][nc]) {
              moves.push({ row: nr, col: nc });
            } else {
              jumped = true;
            }
          } else {
            if (board[nr][nc]) {
              if (board[nr][nc].color !== color) moves.push({ row: nr, col: nc });
              break;
            }
          }
          nr += dr;
          nc += dc;
        }
      });
      break;
      
    case PIECE_TYPES.PAWN:
      const forward = color === COLORS.RED ? -1 : 1;
      // Forward
      addMove(row + forward, col);
      // Sideways after crossing river
      if (!isOwnSide(row, color)) {
        addMove(row, col - 1);
        addMove(row, col + 1);
      }
      break;
  }
  
  return moves;
}

function findKing(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].type === PIECE_TYPES.KING && board[r][c].color === color) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function kingsFace(board) {
  const redKing = findKing(board, COLORS.RED);
  const blackKing = findKing(board, COLORS.BLACK);
  if (!redKing || !blackKing) return false;
  if (redKing.col !== blackKing.col) return false;

  const start = Math.min(redKing.row, blackKing.row) + 1;
  const end = Math.max(redKing.row, blackKing.row);
  for (let row = start; row < end; row++) {
    if (board[row][redKing.col]) return false;
  }
  return true;
}

function isKingInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return true;
  if (kingsFace(board)) return true;
  
  const opponent = color === COLORS.RED ? COLORS.BLACK : COLORS.RED;
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].color === opponent) {
        const moves = getValidMoves(board, r, c);
        if (moves.some(m => m.row === king.row && m.col === king.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

function simulateMove(board, fromRow, fromCol, toRow, toCol) {
  const newBoard = board.map(row => [...row]);
  newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
  newBoard[fromRow][fromCol] = null;
  return newBoard;
}

function getLegalMoves(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  
  const validMoves = getValidMoves(board, row, col);
  return validMoves.filter(move => {
    const newBoard = simulateMove(board, row, col, move.row, move.col);
    return !isKingInCheck(newBoard, piece.color);
  });
}

function hasAnyLegalMove(board, color) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c].color === color) {
        if (getLegalMoves(board, r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function evaluateBoard(board) {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (piece) {
        const value = PIECE_VALUES[piece.type] || 0;
        score += piece.color === COLORS.RED ? value : -value;
      }
    }
  }
  return score;
}

class ChessEngine {
  init(room, players) {
    return {
      phase: 'playing',
      board: initBoard(),
      players,
      currentPlayer: COLORS.RED, // Red goes first
      selectedPiece: null,
      lastMove: null,
      capturedPieces: { [COLORS.RED]: [], [COLORS.BLACK]: [] },
      winner: null,
      finalWinner: null,
      winningPlayers: [],
      drawOffer: null,
      drawAgreed: null,
      moveHistory: [],
      timer: 60,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (state.phase !== 'playing') return state;
    
    // Determine if player is red or black
    const playerIndex = state.players.indexOf(playerId);
    if (playerIndex === -1) return state;
    const playerColor = playerIndex === 0 ? COLORS.RED : COLORS.BLACK;

    if (action.type === 'offer_draw') {
      if (state.drawOffer?.playerId && state.drawOffer.playerId !== playerId) {
        state.phase = 'finished';
        state.winner = 'draw';
        state.finalWinner = 'draw';
        state.winningPlayers = [];
        state.drawAgreed = {
          offeredBy: state.drawOffer.playerId,
          offeredColor: state.drawOffer.color,
          acceptedBy: playerId,
          acceptedColor: playerColor,
          acceptedAt: Date.now()
        };
        state.drawOffer = null;
        state.selectedPiece = null;
      } else {
        state.drawOffer = { playerId, color: playerColor, offeredAt: Date.now() };
      }
      return state;
    }

    if (action.type === 'decline_draw') {
      if (state.drawOffer?.playerId && state.drawOffer.playerId !== playerId) {
        state.drawOffer = null;
      }
      return state;
    }

    // Only allow current player's color to move
    if (state.currentPlayer !== playerColor) return state;

    if (action.type === 'select') {
      const { row, col } = action;
      const piece = state.board[row][col];
      if (piece && piece.color === playerColor) {
        state.selectedPiece = { row, col };
      }
    }

    if (action.type === 'move') {
      let fromRow, fromCol;
      
      if (action.fromRow !== undefined && action.fromCol !== undefined) {
        fromRow = action.fromRow;
        fromCol = action.fromCol;
      } else if (state.selectedPiece) {
        fromRow = state.selectedPiece.row;
        fromCol = state.selectedPiece.col;
      } else {
        return state;
      }
      
      const { row: toRow, col: toCol } = action;
      
      const legalMoves = getLegalMoves(state.board, fromRow, fromCol);
      if (!legalMoves.some(m => m.row === toRow && m.col === toCol)) {
        return state;
      }
      
      const captured = state.board[toRow][toCol];
      if (captured) {
        state.capturedPieces[playerColor].push(captured);
        if (captured.type === PIECE_TYPES.KING) {
          state.phase = 'finished';
          state.winner = playerColor;
          state.finalWinner = playerId;
          state.winningPlayers = [playerId];
        }
      }
      
      state.board[toRow][toCol] = state.board[fromRow][fromCol];
      state.board[fromRow][fromCol] = null;
      state.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
      state.moveHistory.push({
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        captured,
        player: playerId,
        color: playerColor
      });
      state.selectedPiece = null;
      state.drawOffer = null;
      
      if (state.phase === 'playing') {
        state.currentPlayer = playerColor === COLORS.RED ? COLORS.BLACK : COLORS.RED;
        
        if (!hasAnyLegalMove(state.board, state.currentPlayer)) {
          state.phase = 'finished';
          state.winner = playerColor;
          state.finalWinner = playerId;
          state.winningPlayers = [playerId];
        }
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
  ChessEngine,
  ROWS,
  COLS,
  PIECE_TYPES,
  COLORS,
  PIECE_VALUES,
  initBoard,
  getValidMoves,
  getLegalMoves,
  isKingInCheck,
  kingsFace,
  evaluateBoard,
  hasAnyLegalMove
};
