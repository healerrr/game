import Phaser from 'phaser'
import { PhaserGameScene, BoardGraphics, PieceGraphics, AnimationUtils } from './PhaserGameBase'

export class ChessScene extends PhaserGameScene {
  constructor() {
    super({ key: 'ChessScene' })
    this.rows = 10
    this.cols = 9
    this.cellWidth = 52
    this.cellHeight = 52
    this.boardOffset = { x: 0, y: 0 }
    this.pieces = []
    this.selectedPiece = null
    this.legalMoves = []
    this.lastMoveFrom = null
    this.lastMoveTo = null
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d1222')
    
    BoardGraphics.createChessBoardTexture(this, 450, 500)
    
    const boardWidth = (this.cols - 1) * this.cellWidth
    const boardHeight = (this.rows - 1) * this.cellHeight
    const boardX = 400 - boardWidth / 2
    const boardY = 80
    
    this.boardOffset = { x: boardX, y: boardY }
    
    const boardBg = this.add.rectangle(400, boardY + boardHeight / 2, boardWidth + 40, boardHeight + 40, 0xc89a56)
    boardBg.setDepth(0)
    
    this.drawBoardGrid()
    
    this.createUI()
    
    this.pieces = Array.from({ length: this.rows }, () => Array(this.cols).fill(null))
    
    this.renderBoard()
    
    this.input.on('gameobjectdown', (pointer, gameObject) => {
      if (gameObject.getData('cell')) {
        const { row, col } = gameObject.getData('cell')
        this.onCellClick(row, col)
      }
    })
    
    if (this.gameState.board) {
      this.syncBoardFromState()
    }
  }

  drawBoardGrid() {
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0x6e461c, 1)
    
    const offset = this.boardOffset
    const cellWidth = this.cellWidth
    const cellHeight = this.cellHeight
    
    for (let row = 0; row <= this.rows; row++) {
      const y = offset.y + row * cellHeight
      graphics.lineBetween(offset.x + cellWidth / 2, y, offset.x + (this.cols - 0.5) * cellWidth, y)
    }
    
    for (let col = 0; col < this.cols; col++) {
      const x = offset.x + (col + 0.5) * cellWidth
      graphics.lineBetween(x, offset.y + cellHeight / 2, x, offset.y + 4.5 * cellHeight)
      graphics.lineBetween(x, offset.y + 5.5 * cellHeight, x, offset.y + (this.rows - 0.5) * cellHeight)
    }
    
    graphics.lineBetween(offset.x + cellWidth / 2, offset.y + cellHeight / 2, offset.x + cellWidth / 2, offset.y + (this.rows - 0.5) * cellHeight)
    graphics.lineBetween(offset.x + (this.cols - 0.5) * cellWidth, offset.y + cellHeight / 2, offset.x + (this.cols - 0.5) * cellWidth, offset.y + (this.rows - 0.5) * cellHeight)
    
    const palaceX1 = offset.x + 3.5 * cellWidth
    const palaceX2 = offset.x + 5.5 * cellWidth
    const palaceY1 = offset.y + 0.5 * cellHeight
    const palaceY2 = offset.y + 2.5 * cellHeight
    const palaceY3 = offset.y + 7.5 * cellHeight
    const palaceY4 = offset.y + 9.5 * cellHeight
    
    graphics.lineBetween(palaceX1, palaceY1, palaceX2, palaceY2)
    graphics.lineBetween(palaceX2, palaceY1, palaceX1, palaceY2)
    graphics.lineBetween(palaceX1, palaceY3, palaceX2, palaceY4)
    graphics.lineBetween(palaceX2, palaceY3, palaceX1, palaceY4)
    
    graphics.fillStyle(0x6e461c, 1)
    graphics.setFontFamily('KaiTi, STKaiti, serif')
    graphics.setFontSize(28)
    graphics.fillText('楚 河', offset.x + 1.5 * cellWidth, offset.y + 5 * cellHeight + 10)
    graphics.fillText('汉 界', offset.x + 5.5 * cellWidth, offset.y + 5 * cellHeight + 10)
    
    graphics.setDepth(1)
  }

  createUI() {
    this.playerInfoContainer = this.add.container(0, 0)
    this.playerInfoContainer.setDepth(100)
    
    const boardHeight = (this.rows - 1) * this.cellHeight
    const boardY = this.boardOffset.y
    
    const myColor = this.myColor
    const myName = this.player?.nickname || '我'
    const oppName = this.getOpponentName()
    
    const myInfo = this.createPlayerCard(40, boardY - 30, myName, myColor === 'red' ? '红方' : '黑方', true)
    const oppInfo = this.createPlayerCard(720, boardY - 30, oppName, myColor === 'red' ? '黑方' : '红方', false)
    
    this.playerInfoContainer.add([myInfo, oppInfo])
    
    this.statusText = this.add.text(400, boardY + boardHeight + 30, '', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100)
    
    this.updateStatusText()
  }

  createPlayerCard(x, y, name, role, isMine) {
    const container = this.add.container(x, y)
    
    const bgColor = isMine ? 0x667eea : 0x764ba2
    const bg = this.add.rectangle(0, 0, 140, 50, 0x000000, 0.6)
    bg.setOrigin(0.5)
    
    const mark = this.add.rectangle(-50, 0, 36, 36, bgColor)
    mark.setOrigin(0.5)
    
    const markText = this.add.text(-50, 0, role === '红方' ? '红' : '黑', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    
    const nameText = this.add.text(-20, -10, name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    
    const roleText = this.add.text(-20, 10, isMine ? '我方' : '对手', {
      fontSize: '12px',
      color: '#aaaaaa'
    })
    
    container.add([bg, mark, markText, nameText, roleText])
    
    return container
  }

  renderBoard() {
    const offset = this.boardOffset
    const cellWidth = this.cellWidth
    const cellHeight = this.cellHeight
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cellX = offset.x + (col + 0.5) * cellWidth
        const cellY = offset.y + (row + 0.5) * cellHeight
        
        const hitZone = this.add.rectangle(cellX, cellY, cellWidth, cellHeight, 0x000000, 0)
        hitZone.setInteractive()
        hitZone.setData('cell', { row, col })
        hitZone.setDepth(10)
      }
    }
  }

  syncBoardFromState() {
    const board = this.gameState.board
    if (!board) return
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const piece = board[row]?.[col]
        if (piece && !this.pieces[row][col]) {
          this.placePiece(row, col, piece, false)
        } else if (!piece && this.pieces[row][col]) {
          this.pieces[row][col].destroy()
          this.pieces[row][col] = null
        } else if (piece && this.pieces[row][col]) {
          this.pieces[row][col].setData('piece', piece)
        }
      }
    }
    
    if (this.gameState.lastMove) {
      this.lastMoveFrom = this.gameState.lastMove.from
      this.lastMoveTo = this.gameState.lastMove.to
      this.highlightLastMove()
    }
  }

  placePiece(row, col, piece, animate = true) {
    if (this.pieces[row][col]) {
      this.pieces[row][col].destroy()
    }
    
    const offset = this.boardOffset
    const cellWidth = this.cellWidth
    const cellHeight = this.cellHeight
    const pieceX = offset.x + (col + 0.5) * cellWidth
    const pieceY = offset.y + (row + 0.5) * cellHeight
    
    PieceGraphics.createChessPieceTexture(this, piece, 24)
    
    const pieceObj = this.add.image(pieceX, pieceY, `chess_piece_${piece.color}_${piece.type}`)
    pieceObj.setDepth(20)
    pieceObj.setData('piece', piece)
    pieceObj.setData('cell', { row, col })
    pieceObj.setScale(0)
    
    this.pieces[row][col] = pieceObj
    
    if (animate) {
      AnimationUtils.tweenTo(this, pieceObj, {
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut'
      })
    } else {
      pieceObj.setScale(1)
    }
  }

  highlightLastMove() {
    this.clearHighlights()
    
    const offset = this.boardOffset
    const cellWidth = this.cellWidth
    const cellHeight = this.cellHeight
    
    if (this.lastMoveFrom) {
      const fromX = offset.x + (this.lastMoveFrom.col + 0.5) * cellWidth
      const fromY = offset.y + (this.lastMoveFrom.row + 0.5) * cellHeight
      const fromHighlight = this.add.rectangle(fromX, fromY, cellWidth - 4, cellHeight - 4, 0x5a4215, 0.3)
      fromHighlight.setDepth(15)
      this.lastMoveFromHighlight = fromHighlight
    }
    
    if (this.lastMoveTo) {
      const toX = offset.x + (this.lastMoveTo.col + 0.5) * cellWidth
      const toY = offset.y + (this.lastMoveTo.row + 0.5) * cellHeight
      const toHighlight = this.add.rectangle(toX, toY, cellWidth - 4, cellHeight - 4, 0xff5858, 0.3)
      toHighlight.setDepth(15)
      this.lastMoveToHighlight = toHighlight
    }
  }

  clearHighlights() {
    if (this.lastMoveFromHighlight) {
      this.lastMoveFromHighlight.destroy()
      this.lastMoveFromHighlight = null
    }
    if (this.lastMoveToHighlight) {
      this.lastMoveToHighlight.destroy()
      this.lastMoveToHighlight = null
    }
    if (this.selectedHighlight) {
      this.selectedHighlight.destroy()
      this.selectedHighlight = null
    }
    this.legalMoves.forEach(m => {
      if (m.indicator) m.indicator.destroy()
    })
    this.legalMoves = []
  }

  onCellClick(row, col) {
    if (!this.isMyTurn || this.gameState.phase !== 'playing') return
    
    const piece = this.gameState.board?.[row]?.[col]
    
    if (piece && piece.color === this.myColor) {
      this.selectPiece(row, col)
      this.emitAction({ type: 'select', row, col })
    } else if (this.selectedPiece && this.isLegalMove(row, col)) {
      this.emitAction({ type: 'move', row, col })
      this.selectedPiece = null
      this.clearHighlights()
    }
  }

  selectPiece(row, col) {
    this.clearHighlights()
    this.selectedPiece = { row, col }
    
    const offset = this.boardOffset
    const cellWidth = this.cellWidth
    const cellHeight = this.cellHeight
    const cellX = offset.x + (col + 0.5) * cellWidth
    const cellY = offset.y + (row + 0.5) * cellHeight
    
    this.selectedHighlight = this.add.rectangle(cellX, cellY, cellWidth - 2, cellHeight - 2, 0xff7253, 0.4)
    this.selectedHighlight.setDepth(15)
    
    const moves = this.getLegalMovesFromState(row, col)
    this.legalMoves = moves
    
    moves.forEach(move => {
      const moveX = offset.x + (move.col + 0.5) * cellWidth
      const moveY = offset.y + (move.row + 0.5) * cellHeight
      
      const targetPiece = this.gameState.board?.[move.row]?.[move.col]
      if (targetPiece) {
        const captureIndicator = this.add.rectangle(moveX, moveY, cellWidth - 4, cellHeight - 4, 0x2cb9eb, 0.3)
        captureIndicator.setDepth(15)
        move.indicator = captureIndicator
      } else {
        const dot = this.add.circle(moveX, moveY, 6, 0x2cb9eb, 0.7)
        dot.setDepth(15)
        move.indicator = dot
      }
    })
  }

  isLegalMove(row, col) {
    return this.legalMoves.some(m => m.row === row && m.col === col)
  }

  getLegalMovesFromState(row, col) {
    const piece = this.gameState.board?.[row]?.[col]
    if (!piece || piece.color !== this.myColor) return []
    
    return this.calculateLegalMoves(this.gameState.board, row, col)
  }

  calculateLegalMoves(board, row, col) {
    const piece = board[row]?.[col]
    if (!piece) return []
    
    const moves = []
    const { type, color } = piece
    
    const addMove = (r, c) => {
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return
      const target = board[r]?.[c]
      if (!target || target.color !== color) {
        moves.push({ row: r, col: c })
      }
    }
    
    const isInPalace = (r, c, clr) => {
      if (c < 3 || c > 5) return false
      if (clr === 'black') return r >= 0 && r <= 2
      return r >= 7 && r <= 9
    }
    
    const isOwnSide = (r, clr) => {
      if (clr === 'black') return r <= 4
      return r >= 5
    }
    
    switch (type) {
      case 'king':
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
          const nr = row + dr
          const nc = col + dc
          if (isInPalace(nr, nc, color)) addMove(nr, nc)
        })
        break
        
      case 'advisor':
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
          const nr = row + dr
          const nc = col + dc
          if (isInPalace(nr, nc, color)) addMove(nr, nc)
        })
        break
        
      case 'bishop':
        [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
          const nr = row + dr
          const nc = col + dc
          const eyeR = row + dr / 2
          const eyeC = col + dc / 2
          if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && 
              isOwnSide(nr, color) && !board[eyeR]?.[eyeC]) {
            addMove(nr, nc)
          }
        })
        break
        
      case 'rook':
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
          let nr = row + dr
          let nc = col + dc
          while (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            if (!board[nr]?.[nc]) {
              moves.push({ row: nr, col: nc })
            } else {
              if (board[nr][nc].color !== color) {
                moves.push({ row: nr, col: nc })
              }
              break
            }
            nr += dr
            nc += dc
          }
        })
        break
        
      case 'knight':
        [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => {
          const nr = row + dr
          const nc = col + dc
          if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) return
          const legR = row + (Math.abs(dr) === 2 ? dr / 2 : 0)
          const legC = col + (Math.abs(dc) === 2 ? dc / 2 : 0)
          if (!board[legR]?.[legC]) addMove(nr, nc)
        })
        break
        
      case 'cannon':
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
          let nr = row + dr
          let nc = col + dc
          let jumped = false
          while (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
            if (!jumped) {
              if (!board[nr]?.[nc]) {
                moves.push({ row: nr, col: nc })
              } else {
                jumped = true
              }
            } else if (board[nr]?.[nc]) {
              if (board[nr][nc].color !== color) {
                moves.push({ row: nr, col: nc })
              }
              break
            }
            nr += dr
            nc += dc
          }
        })
        break
        
      case 'pawn':
        const forward = color === 'red' ? -1 : 1
        addMove(row + forward, col)
        if (!isOwnSide(row, color)) {
          addMove(row, col - 1)
          addMove(row, col + 1)
        }
        break
    }
    
    return moves
  }

  updateStatusText() {
    if (this.gameState.phase === 'finished') {
      if (this.gameState.winner === this.myColor) {
        this.statusText.setText('🎉 这局拿下')
        this.statusText.setColor('#ffd700')
      } else {
        this.statusText.setText('😔 对局结束')
        this.statusText.setColor('#ff6b6b')
      }
    } else if (this.isMyTurn) {
      this.statusText.setText('轮到你了')
      this.statusText.setColor('#4ecdc4')
    } else {
      this.statusText.setText('等待对手落子')
      this.statusText.setColor('#aaaaaa')
    }
  }

  onStateUpdate(newState) {
    if (newState.board) {
      this.syncBoardFromState()
    }
    
    if (newState.phase) {
      this.updateStatusText()
    }
    
    if (newState.lastMove) {
      this.lastMoveFrom = newState.lastMove.from
      this.lastMoveTo = newState.lastMove.to
      this.highlightLastMove()
    }
  }

  get isMyTurn() {
    return this.gameState.phase === 'playing' && this.gameState.currentPlayer === this.myColor
  }

  get myColor() {
    if (!this.player?.id) return 'red'
    const blackId = this.gameState.players?.[1]
    return blackId === this.player.id ? 'black' : 'red'
  }

  getOpponentName() {
    if (!this.gameState.players) return '对手'
    const oppIdx = this.myColor === 'red' ? 1 : 0
    const oppId = this.gameState.players[oppIdx]
    const opp = this.roomPlayers?.find(p => p.id === oppId)
    return opp?.nickname || '对手'
  }
}
