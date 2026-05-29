import Phaser from 'phaser'
import { PhaserGameScene, BoardGraphics, PieceGraphics, AnimationUtils } from './PhaserGameBase'

export class GomokuScene extends PhaserGameScene {
  constructor() {
    super({ key: 'GomokuScene' })
    this.boardSize = 15
    this.cellSize = 34
    this.boardOffset = { x: 0, y: 0 }
    this.pieces = []
    this.lastMoveIndicator = null
    this.hoverPiece = null
    this.topPlayerInfo = null
    this.bottomPlayerInfo = null
  }

  create() {
    this.cameras.main.setBackgroundColor('#f5f5f5')
    
    PieceGraphics.createGomokuPieceTexture(this, 'black', 16)
    PieceGraphics.createGomokuPieceTexture(this, 'white', 16)
    
    const boardWidth = (this.boardSize - 1) * this.cellSize
    const boardHeight = (this.boardSize - 1) * this.cellSize
    const boardX = 400 - boardWidth / 2
    const boardY = 140
    
    this.boardOffset = { x: boardX, y: boardY }
    
    this.drawBoardBackground(boardWidth, boardHeight)
    this.drawGridLines()
    
    this.createTopPlayerInfo()
    this.createBottomPlayerInfo()
    
    this.pieces = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null))
    
    this.renderBoard()
    
    this.input.on('gameobjectdown', (pointer, gameObject) => {
      if (gameObject.getData('cell') && this.isMyTurn) {
        const { x, y } = gameObject.getData('cell')
        this.emitAction({ type: 'place', x, y })
      }
    })
    
    this.input.on('pointermove', (pointer) => {
      this.handleHover(pointer)
    })
    
    this.input.on('pointerout', () => {
      this.hideHoverPiece()
    })
    
    if (this.gameState.board) {
      this.syncBoardFromState()
    }
  }

  drawBoardBackground(boardWidth, boardHeight) {
    const boardContainer = this.add.container(0, 0)
    boardContainer.setDepth(0)
    
    const shadow = this.add.rectangle(400, this.boardOffset.y + boardHeight / 2 + 4, boardWidth + 24, boardHeight + 24, 0x000000, 0.1)
    shadow.setOrigin(0.5)
    
    const boardBg = this.add.rectangle(400, this.boardOffset.y + boardHeight / 2, boardWidth + 20, boardHeight + 20, 0xf0d9a0)
    boardBg.setOrigin(0.5)
    
    const innerBg = this.add.rectangle(400, this.boardOffset.y + boardHeight / 2, boardWidth + 12, boardHeight + 12, 0xf5e6c8)
    innerBg.setOrigin(0.5)
    
    boardContainer.add([shadow, boardBg, innerBg])
  }

  drawGridLines() {
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x8B7355, 0.8)
    
    const cellSize = this.cellSize
    const offset = this.boardOffset
    
    for (let i = 0; i < this.boardSize; i++) {
      const pos = offset.x + i * cellSize
      graphics.lineBetween(pos, offset.y, pos, offset.y + (this.boardSize - 1) * cellSize)
      graphics.lineBetween(offset.x, offset.y + i * cellSize, offset.x + (this.boardSize - 1) * cellSize, offset.y + i * cellSize)
    }
    
    const starPoints = [3, 7, 11]
    graphics.fillStyle(0x8B7355, 0.8)
    for (const x of starPoints) {
      for (const y of starPoints) {
        graphics.fillCircle(offset.x + x * cellSize, offset.y + y * cellSize, 3)
      }
    }
    
    graphics.setDepth(1)
  }

  createTopPlayerInfo() {
    const oppName = this.getOpponentName()
    const oppColor = this.myIndex === 0 ? 'white' : 'black'
    const oppLabel = oppColor === 'white' ? '白棋' : '黑棋'
    
    this.topPlayerInfo = this.add.container(400, 60)
    this.topPlayerInfo.setDepth(100)
    
    const avatarBg = this.add.circle(-140, 0, 28, 0xffffff)
    avatarBg.setStrokeStyle(2, 0xe0e0e0)
    
    const avatarIcon = this.add.text(-140, 0, '', { fontSize: '28px' }).setOrigin(0.5)
    
    const colorBadge = this.add.circle(-100, 20, 12, oppColor === 'white' ? 0xffffff : 0x333333)
    colorBadge.setStrokeStyle(1, 0xcccccc)
    
    const colorText = this.add.text(-100, 20, oppLabel, { fontSize: '10px', color: '#666666' }).setOrigin(0.5)
    
    const nameText = this.add.text(-60, -5, `电脑[入门]`, { fontSize: '18px', color: '#999999' })
    
    this.topPlayerInfo.add([avatarBg, avatarIcon, colorBadge, colorText, nameText])
  }

  createBottomPlayerInfo() {
    const myName = this.player?.nickname || '我'
    const myColor = this.myIndex === 0 ? 'black' : 'white'
    const myLabel = myColor === 'black' ? '黑棋' : '白棋'
    
    this.bottomPlayerInfo = this.add.container(400, 620)
    this.bottomPlayerInfo.setDepth(100)
    
    const nameText = this.add.text(60, -5, myName, { fontSize: '18px', color: '#666666' })
    
    const pieceIcon = this.add.circle(120, 0, 14, myColor === 'black' ? 0x333333 : 0xffffff)
    pieceIcon.setStrokeStyle(1, 0xcccccc)
    
    const avatarBg = this.add.circle(160, 0, 28, 0xffffff)
    avatarBg.setStrokeStyle(2, 0xe0e0e0)
    
    const avatarIcon = this.add.text(160, 0, '😎', { fontSize: '28px' }).setOrigin(0.5)
    
    const colorBadge = this.add.circle(195, 20, 12, myColor === 'black' ? 0x333333 : 0xffffff)
    colorBadge.setStrokeStyle(1, 0xcccccc)
    
    const colorText = this.add.text(195, 20, myLabel, { fontSize: '10px', color: '#666666' }).setOrigin(0.5)
    
    this.bottomPlayerInfo.add([nameText, pieceIcon, avatarBg, avatarIcon, colorBadge, colorText])
  }

  renderBoard() {
    const cellSize = this.cellSize
    const offset = this.boardOffset
    
    for (let x = 0; x < this.boardSize; x++) {
      for (let y = 0; y < this.boardSize; y++) {
        const cellX = offset.x + x * cellSize
        const cellY = offset.y + y * cellSize
        
        const hitZone = this.add.rectangle(cellX, cellY, cellSize, cellSize, 0x000000, 0)
        hitZone.setInteractive()
        hitZone.setData('cell', { x, y })
        hitZone.setDepth(10)
      }
    }
  }

  syncBoardFromState() {
    const board = this.gameState.board
    if (!board) return
    
    for (let x = 0; x < this.boardSize; x++) {
      for (let y = 0; y < this.boardSize; y++) {
        if (board[x][y] !== 0 && !this.pieces[x][y]) {
          this.placePiece(x, y, board[x][y], false)
        }
      }
    }
    
    if (this.gameState.lastMove) {
      this.showLastMove(this.gameState.lastMove.x, this.gameState.lastMove.y)
    }
  }

  placePiece(x, y, player, animate = true) {
    if (this.pieces[x][y]) return
    
    const cellSize = this.cellSize
    const offset = this.boardOffset
    const pieceX = offset.x + x * cellSize
    const pieceY = offset.y + y * cellSize
    
    const color = player === 1 ? 'black' : 'white'
    const piece = this.add.image(pieceX, pieceY, `gomoku_piece_${color}`)
    piece.setDepth(20)
    piece.setScale(0)
    
    this.pieces[x][y] = piece
    
    if (animate) {
      AnimationUtils.tweenTo(this, piece, {
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut'
      })
      
      this.cameras.main.shake(100, 0.002)
    } else {
      piece.setScale(1)
    }
    
    this.showLastMove(x, y)
  }

  showLastMove(x, y) {
    if (this.lastMoveIndicator) {
      this.lastMoveIndicator.destroy()
    }
    
    const cellSize = this.cellSize
    const offset = this.boardOffset
    const pieceX = offset.x + x * cellSize
    const pieceY = offset.y + y * cellSize
    
    this.lastMoveIndicator = this.add.circle(pieceX, pieceY, 4, 0xff4444, 0.8)
    this.lastMoveIndicator.setDepth(25)
  }

  handleHover(pointer) {
    if (!this.isMyTurn) {
      this.hideHoverPiece()
      return
    }
    
    const cellSize = this.cellSize
    const offset = this.boardOffset
    
    const x = Math.round((pointer.x - offset.x) / cellSize)
    const y = Math.round((pointer.y - offset.y) / cellSize)
    
    if (x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize && !this.pieces[x][y]) {
      this.showHoverPiece(x, y)
    } else {
      this.hideHoverPiece()
    }
  }

  showHoverPiece(x, y) {
    if (this.hoverPiece) {
      this.hoverPiece.destroy()
    }
    
    const cellSize = this.cellSize
    const offset = this.boardOffset
    const pieceX = offset.x + x * cellSize
    const pieceY = offset.y + y * cellSize
    
    const myPlayer = this.myIndex === 0 ? 1 : 2
    const color = myPlayer === 1 ? 'black' : 'white'
    
    this.hoverPiece = this.add.image(pieceX, pieceY, `gomoku_piece_${color}`)
    this.hoverPiece.setAlpha(0.4)
    this.hoverPiece.setDepth(15)
    
    const crosshair = this.add.graphics()
    crosshair.lineStyle(2, 0x4ecdc4, 0.6)
    crosshair.lineBetween(pieceX - 8, pieceY, pieceX + 8, pieceY)
    crosshair.lineBetween(pieceX, pieceY - 8, pieceX, pieceY + 8)
    crosshair.setDepth(16)
    
    this.hoverPiece.setData('crosshair', crosshair)
  }

  hideHoverPiece() {
    if (this.hoverPiece) {
      const crosshair = this.hoverPiece.getData('crosshair')
      if (crosshair) crosshair.destroy()
      this.hoverPiece.destroy()
      this.hoverPiece = null
    }
  }

  updateStatusText() {
  }

  onStateUpdate(newState) {
    if (newState.board) {
      this.syncBoardFromState()
    }
  }

  get isMyTurn() {
    return this.gameState.phase === 'playing' && this.gameState.currentPlayer === this.player?.id
  }

  get myIndex() {
    if (!this.gameState.players || !this.player?.id) return 0
    const idx = this.gameState.players.indexOf(this.player.id)
    return idx >= 0 ? idx : 0
  }

  getOpponentName() {
    if (!this.gameState.players) return '对手'
    const oppId = this.gameState.players.find((id, i) => i !== this.myIndex)
    const opp = this.roomPlayers?.find(p => p.id === oppId)
    return opp?.nickname || '对手'
  }
}
