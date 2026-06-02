import Phaser from 'phaser'

export class PhaserGameScene extends Phaser.Scene {
  constructor(config) {
    super(config)
    this.gameState = {}
    this.player = null
    this.roomPlayers = []
    this.onAction = null
  }

  init(data) {
    this.gameState = data.gs || {}
    this.player = data.player
    this.roomPlayers = data.roomPlayers || []
    this.onAction = data.onAction
  }

  emitAction(action) {
    if (this.onAction) {
      this.onAction(action)
    }
  }

  updateFromServer(newState) {
    this.gameState = { ...this.gameState, ...newState }
    this.onStateUpdate?.(newState)
  }
}

export function createPhaserGame(config) {
  const defaultConfig = {
    type: Phaser.AUTO,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 800,
      height: 600
    },
    backgroundColor: '#1a1a2e',
    scene: config.scene,
    physics: config.physics || undefined,
    render: {
      antialias: true,
      roundPixels: false
    }
  }

  return new Phaser.Game({ ...defaultConfig, ...config })
}

export class CardGraphics {
  static createCardTexture(scene, card, width = 80, height = 112) {
    const textureKey = `card_${card.rank}_${card.suit}`
    
    if (scene.textures.exists(textureKey)) {
      return textureKey
    }

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
    
    graphics.fillStyle(0xffffff, 1)
    graphics.fillRoundedRect(0, 0, width, height, 8)
    
    graphics.lineStyle(2, 0x333333, 1)
    graphics.strokeRoundedRect(0, 0, width, height, 8)
    
    const isRed = card.suit === 'heart' || card.suit === 'diamond'
    const color = isRed ? 0xd63031 : 0x1a1a2e
    
    graphics.fillStyle(color, 1)
    graphics.setFontFamily('Arial')
    graphics.setFontSize(20)
    graphics.setFontWeight('bold')
    graphics.fillText(card.rank, 8, 24)
    
    const suitIcons = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }
    graphics.setFontSize(28)
    graphics.fillText(suitIcons[card.suit], width / 2 - 14, height / 2 + 10)
    
    graphics.fillStyle(color, 1)
    graphics.setFontSize(16)
    graphics.fillText(card.rank, width - 24, height - 8)
    
    graphics.generateTexture(textureKey, width, height)
    graphics.destroy()
    
    return textureKey
  }

  static createCardBackTexture(scene, width = 80, height = 112) {
    const textureKey = 'card_back'
    
    if (scene.textures.exists(textureKey)) {
      return textureKey
    }

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
    
    graphics.fillStyle(0x2c3e50, 1)
    graphics.fillRoundedRect(0, 0, width, height, 8)
    
    graphics.lineStyle(3, 0x34495e, 1)
    graphics.strokeRoundedRect(4, 4, width - 8, height - 8, 6)
    
    graphics.fillStyle(0x34495e, 1)
    graphics.fillCircle(width / 2, height / 2, 20)
    
    graphics.generateTexture(textureKey, width, height)
    graphics.destroy()
    
    return textureKey
  }
}

export class BoardGraphics {
  static createGomokuBoardTexture(scene, size = 480, gridSize = 14) {
    const textureKey = 'gomoku_board'
    
    if (scene.textures.exists(textureKey)) {
      return textureKey
    }

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
    
    graphics.fillStyle(0xd4a574, 1)
    graphics.fillRect(0, 0, size, size)
    
    const cellSize = size / (gridSize - 1)
    graphics.lineStyle(1, 0x8B6914, 1)
    
    for (let i = 0; i < gridSize; i++) {
      const pos = i * cellSize
      graphics.lineBetween(pos, 0, pos, size)
      graphics.lineBetween(0, pos, size, pos)
    }
    
    const starPoints = [3, 10]
    graphics.fillStyle(0x8B6914, 1)
    for (const x of starPoints) {
      for (const y of starPoints) {
        graphics.fillCircle(x * cellSize, y * cellSize, 4)
      }
    }
    
    graphics.generateTexture(textureKey, size, size)
    graphics.destroy()
    
    return textureKey
  }

  static createChessBoardTexture(scene, width = 450, height = 500) {
    const textureKey = 'chess_board'
    
    if (scene.textures.exists(textureKey)) {
      return textureKey
    }

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
    
    graphics.fillStyle(0xc89a56, 1)
    graphics.fillRect(0, 0, width, height)
    
    const cellWidth = width / 8
    const cellHeight = height / 9
    
    graphics.lineStyle(2, 0x6e461c, 1)
    
    for (let row = 0; row <= 9; row++) {
      const y = row * cellHeight
      graphics.lineBetween(cellWidth / 2, y, width - cellWidth / 2, y)
    }
    
    for (let col = 0; col <= 8; col++) {
      const x = col * cellWidth + cellWidth / 2
      graphics.lineBetween(x, cellHeight / 2, x, height * 4 / 9)
      graphics.lineBetween(x, height * 5 / 9, x, height - cellHeight / 2)
    }
    
    graphics.lineBetween(cellWidth / 2, cellHeight / 2, cellWidth / 2, height - cellHeight / 2)
    graphics.lineBetween(width - cellWidth / 2, cellHeight / 2, width - cellWidth / 2, height - cellHeight / 2)
    
    const palaceY1 = cellHeight / 2
    const palaceY2 = cellHeight * 3 / 2
    const palaceY3 = cellHeight * 7 / 2
    const palaceY4 = cellHeight * 9 / 2
    const palaceX1 = cellWidth * 3 / 2
    const palaceX2 = cellWidth * 5 / 2
    
    graphics.lineBetween(palaceX1, palaceY1, palaceX2, palaceY2)
    graphics.lineBetween(palaceX2, palaceY1, palaceX1, palaceY2)
    graphics.lineBetween(palaceX1, palaceY3, palaceX2, palaceY4)
    graphics.lineBetween(palaceX2, palaceY3, palaceX1, palaceY4)
    
    graphics.fillStyle(0x6e461c, 1)
    graphics.setFontFamily('KaiTi, STKaiti, serif')
    graphics.setFontSize(24)
    graphics.fillText('楚 河', width * 0.25, height / 2 + 8)
    graphics.fillText('汉 界', width * 0.65, height / 2 + 8)
    
    graphics.generateTexture(textureKey, width, height)
    graphics.destroy()
    
    return textureKey
  }
}

export class PieceGraphics {
  static createGomokuPieceTexture(scene, color, radius = 14) {
    const textureKey = `gomoku_piece_${color}`
    
    if (scene.textures.exists(textureKey)) {
      return textureKey
    }

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
    
    if (color === 'black') {
      graphics.fillStyle(0x000000, 1)
      graphics.fillCircle(radius, radius, radius)
      graphics.fillStyle(0x666666, 0.3)
      graphics.fillCircle(radius - 4, radius - 4, radius / 3)
    } else {
      graphics.fillStyle(0xffffff, 1)
      graphics.fillCircle(radius, radius, radius)
      graphics.lineStyle(1, 0xcccccc, 1)
      graphics.strokeCircle(radius, radius, radius)
    }
    
    graphics.generateTexture(textureKey, radius * 2, radius * 2)
    graphics.destroy()
    
    return textureKey
  }

  static createChessPieceTexture(scene, piece, radius = 24) {
    const textureKey = `chess_piece_${piece.color}_${piece.type}`
    
    if (scene.textures.exists(textureKey)) {
      return textureKey
    }

    const graphics = scene.make.graphics({ x: 0, y: 0, add: false })
    
    const bgColor = piece.color === 'red' ? 0xf5e2bf : 0xebd9b3
    const textColor = piece.color === 'red' ? 0xc0392b : 0x24324d
    
    graphics.fillStyle(bgColor, 1)
    graphics.fillCircle(radius, radius, radius)
    
    graphics.lineStyle(2, 0x5a3711, 0.5)
    graphics.strokeCircle(radius, radius, radius - 2)
    
    const pieceLabels = {
      red: { king: '帅', advisor: '仕', bishop: '相', rook: '车', knight: '马', cannon: '炮', pawn: '兵' },
      black: { king: '将', advisor: '士', bishop: '象', rook: '车', knight: '马', cannon: '炮', pawn: '卒' }
    }
    
    const label = pieceLabels[piece.color]?.[piece.type] || '?'
    graphics.fillStyle(textColor, 1)
    graphics.setFontFamily('KaiTi, STKaiti, serif')
    graphics.setFontSize(28)
    graphics.setFontWeight('bold')
    graphics.fillText(label, radius - 14, radius + 10)
    
    graphics.generateTexture(textureKey, radius * 2, radius * 2)
    graphics.destroy()
    
    return textureKey
  }
}

export class AnimationUtils {
  static tweenTo(scene, target, config) {
    return scene.tweens.add({
      targets: target,
      duration: config.duration || 300,
      ease: config.ease || 'Power2',
      ...config
    })
  }

  static dealCardAnimation(scene, card, fromX, fromY, toX, toY, delay = 0) {
    card.setPosition(fromX, fromY)
    card.setAlpha(0)
    
    scene.time.delayedCall(delay, () => {
      card.setAlpha(1)
      scene.tweens.add({
        targets: card,
        x: toX,
        y: toY,
        duration: 400,
        ease: 'Back.easeOut'
      })
    })
  }

  static flipCardAnimation(scene, card, onComplete) {
    scene.tweens.add({
      targets: card,
      scaleX: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        card.setScale(1, 1)
        onComplete?.()
        scene.tweens.add({
          targets: card,
          scaleX: 1,
          duration: 150,
          ease: 'Power2'
        })
      }
    })
  }

  static pulseAnimation(scene, target, duration = 1000) {
    return scene.tweens.add({
      targets: target,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: duration / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }
}
