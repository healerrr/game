<template>
  <section class="chess-board">
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载象棋棋盘...</p>
    </div>

    <template v-else>
      <header class="versus-panel">
        <div class="player-card">
          <div class="avatar">{{ myName.slice(0, 1) }}</div>
          <div>
            <strong>{{ myName }}</strong>
            <span>{{ myColor === 'red' ? '红方' : '黑方' }}</span>
          </div>
        </div>
        <div class="vs-word">VS</div>
        <div class="player-card opponent">
          <div>
            <strong>{{ opponentName }}</strong>
            <span>{{ myColor === 'red' ? '黑方' : '红方' }}</span>
          </div>
          <div class="avatar ghost">{{ opponentName.slice(0, 1) }}</div>
        </div>
      </header>

      <div class="status-banner">{{ phaseLabel }}</div>

      <div class="board-shell" ref="boardWrapper">
        <canvas
          ref="boardCanvas"
          class="board-canvas"
          @click="handleCanvasClick"
          @mousemove="handleCanvasMove"
          @mouseleave="hideHoverPiece"
          @touchstart.prevent="handleTouchStart"
          @touchmove.prevent="handleTouchMove"
          @touchend.prevent="handleTouchEnd"
          @touchcancel.prevent="handleTouchEnd"
        ></canvas>
      </div>

      <div class="action-strip">
        <button class="action-card orange" @click="showToast('当前版本暂未开放悔棋')">
          <span>↩</span>
          <strong>悔棋</strong>
        </button>
        <button class="action-card gold" @click="showToast('求和功能稍后开放')">
          <span>🤝</span>
          <strong>求和</strong>
        </button>
        <button class="action-card blue" @click="$emit('rematch')">
          <span>🔄</span>
          <strong>重新开始</strong>
        </button>
        <button class="action-card cream" @click="showToast('游戏规则面板稍后补齐')">
          <span>📘</span>
          <strong>游戏规则</strong>
        </button>
      </div>

      <div class="info-strip">
        <div class="info-item">
          <span>当前回合</span>
          <strong>{{ turnLabel }}</strong>
        </div>
        <div class="info-item">
          <span>已走步数</span>
          <strong>{{ moveCount }}</strong>
        </div>
      </div>

      <div class="bottom-banner">轻松互动，欢乐同行 · 团队合作 共创精彩</div>
    </template>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <transition name="fade">
      <div v-if="gamePhase === 'finished'" class="result-panel">
        <div class="result-content">
          <div class="result-badge" :class="winnerClass">{{ gs.winner === myColor ? '胜' : '负' }}</div>
          <h2>{{ resultText }}</h2>
          <p>{{ resultDetail }}</p>
          <div class="result-actions">
            <button class="primary-btn" @click="$emit('rematch')">再来一局</button>
            <button class="secondary-btn" @click="$emit('back')">返回大厅</button>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

const boardCanvas = ref(null)
const boardWrapper = ref(null)
const hoverPos = ref({ row: -1, col: -1 })
const toast = ref('')

const ROWS = 10
const COLS = 9
const PIECE_RADIUS = 20
const PADDING = PIECE_RADIUS + 8

let cellWidth = 44
let cellHeight = 44
let canvasWidth = 0
let canvasHeight = 0
let displayScale = 1

const PIECE_TYPES = {
  KING: 'king',
  ADVISOR: 'advisor',
  BISHOP: 'bishop',
  ROOK: 'rook',
  KNIGHT: 'knight',
  CANNON: 'cannon',
  PAWN: 'pawn'
}

const COLORS = {
  RED: 'red',
  BLACK: 'black'
}

const pieceLabels = {
  red: {
    [PIECE_TYPES.KING]: '帅',
    [PIECE_TYPES.ADVISOR]: '仕',
    [PIECE_TYPES.BISHOP]: '相',
    [PIECE_TYPES.ROOK]: '车',
    [PIECE_TYPES.KNIGHT]: '马',
    [PIECE_TYPES.CANNON]: '炮',
    [PIECE_TYPES.PAWN]: '兵'
  },
  black: {
    [PIECE_TYPES.KING]: '将',
    [PIECE_TYPES.ADVISOR]: '士',
    [PIECE_TYPES.BISHOP]: '象',
    [PIECE_TYPES.ROOK]: '车',
    [PIECE_TYPES.KNIGHT]: '马',
    [PIECE_TYPES.CANNON]: '炮',
    [PIECE_TYPES.PAWN]: '卒'
  }
}

const board = computed(() => {
  if (!props.gs || !props.gs.board) {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  }
  return props.gs.board
})

const isReady = computed(() => props.gs && props.gs.board && props.gs.players)
const myId = computed(() => props.player?.id || '')
const redId = computed(() => props.gs?.players?.[0] || '')
const blackId = computed(() => props.gs?.players?.[1] || '')

const myColor = computed(() => {
  if (!myId.value) return COLORS.RED
  return blackId.value === myId.value ? COLORS.BLACK : COLORS.RED
})

const currentColor = computed(() => props.gs?.currentPlayer || COLORS.RED)
const gamePhase = computed(() => props.gs?.phase || 'waiting')
const moveCount = computed(() => props.gs?.moveHistory?.length || 0)
const myName = computed(() => props.player?.nickname || '我方')

const opponentName = computed(() => {
  const opponentId = myColor.value === COLORS.RED ? blackId.value : redId.value
  const opponent = props.roomPlayers?.find((item) => item.id === opponentId)
  return opponent?.nickname || '对手'
})

const isMyTurn = computed(() => gamePhase.value === 'playing' && currentColor.value === myColor.value)
const turnLabel = computed(() => currentColor.value === COLORS.RED ? '红方' : '黑方')

const phaseLabel = computed(() => {
  if (gamePhase.value === 'finished') return '本局已结束'
  return isMyTurn.value ? '轮到你操作' : `等待 ${opponentName.value} 行棋`
})

const selectedCell = computed(() => {
  if (props.gs?.selectedPiece && typeof props.gs.selectedPiece.row === 'number') {
    return props.gs.selectedPiece
  }
  return null
})

const selectedPiece = computed(() => {
  const selected = selectedCell.value
  if (!selected) return null
  return board.value[selected.row]?.[selected.col] || null
})

const legalMoves = computed(() => {
  const selected = selectedCell.value
  const piece = selectedPiece.value
  if (!selected || !piece || piece.color !== myColor.value) return []
  return getLegalMoves(board.value, selected.row, selected.col)
})

const lastMoveFrom = computed(() => props.gs?.lastMove?.from || null)
const lastMoveTo = computed(() => props.gs?.lastMove?.to || null)

const winnerClass = computed(() => (props.gs.winner === myColor.value ? 'winner' : 'loser'))
const resultText = computed(() => (props.gs.winner === myColor.value ? '恭喜获胜' : '本局失利'))
const resultDetail = computed(() => (props.gs.winner === myColor.value ? '你完成了将杀，拿下这一局。' : `${opponentName.value} 率先完成将杀。`))

function showToast(text) {
  toast.value = text
  setTimeout(() => {
    if (toast.value === text) toast.value = ''
  }, 1800)
}

function calculateDimensions() {
  const wrapper = boardWrapper.value
  if (!wrapper) return

  const containerWidth = wrapper.clientWidth
  const maxWidth = Math.min(containerWidth - 24, 560)
  const gridWidth = (COLS - 1) * cellWidth
  const gridHeight = (ROWS - 1) * cellHeight

  canvasWidth = gridWidth + PADDING * 2
  canvasHeight = gridHeight + PADDING * 2
  displayScale = Math.min(1, maxWidth / canvasWidth)
}

function drawBoard() {
  const canvas = boardCanvas.value
  if (!canvas) return

  calculateDimensions()
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1

  canvas.width = canvasWidth * dpr
  canvas.height = canvasHeight * dpr
  canvas.style.width = `${canvasWidth * displayScale}px`
  canvas.style.height = `${canvasHeight * displayScale}px`
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#f3d39b'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.strokeStyle = '#8f5d25'
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.82

  for (let row = 0; row < ROWS; row += 1) {
    const y = PADDING + row * cellHeight
    ctx.beginPath()
    ctx.moveTo(PADDING, y)
    ctx.lineTo(PADDING + (COLS - 1) * cellWidth, y)
    ctx.stroke()
  }

  for (let col = 0; col < COLS; col += 1) {
    const x = PADDING + col * cellWidth

    ctx.beginPath()
    ctx.moveTo(x, PADDING)
    ctx.lineTo(x, PADDING + 4 * cellHeight)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(x, PADDING + 5 * cellHeight)
    ctx.lineTo(x, PADDING + 9 * cellHeight)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(PADDING, PADDING + 4 * cellHeight)
  ctx.lineTo(PADDING, PADDING + 5 * cellHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(PADDING + (COLS - 1) * cellWidth, PADDING + 4 * cellHeight)
  ctx.lineTo(PADDING + (COLS - 1) * cellWidth, PADDING + 5 * cellHeight)
  ctx.stroke()

  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING + 3 * cellWidth, PADDING)
  ctx.lineTo(PADDING + 5 * cellWidth, PADDING + 2 * cellHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(PADDING + 5 * cellWidth, PADDING)
  ctx.lineTo(PADDING + 3 * cellWidth, PADDING + 2 * cellHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(PADDING + 3 * cellWidth, PADDING + 7 * cellHeight)
  ctx.lineTo(PADDING + 5 * cellWidth, PADDING + 9 * cellHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(PADDING + 5 * cellWidth, PADDING + 7 * cellHeight)
  ctx.lineTo(PADDING + 3 * cellWidth, PADDING + 9 * cellHeight)
  ctx.stroke()

  ctx.globalAlpha = 0.48
  ctx.fillStyle = '#9f6c31'
  ctx.font = '18px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('楚 河', PADDING + 2 * cellWidth, PADDING + 4.5 * cellHeight)
  ctx.fillText('汉 界', PADDING + 6 * cellWidth, PADDING + 4.5 * cellHeight)

  ctx.globalAlpha = 0.6
  drawPositionMarks(ctx)

  ctx.globalAlpha = 1
  if (lastMoveFrom.value) drawLastMoveMark(ctx, lastMoveFrom.value.row, lastMoveFrom.value.col, 'from')
  if (lastMoveTo.value) drawLastMoveMark(ctx, lastMoveTo.value.row, lastMoveTo.value.col, 'to')
  if (selectedCell.value) drawSelectedMark(ctx, selectedCell.value.row, selectedCell.value.col)
  if (isMyTurn.value && selectedCell.value) {
    legalMoves.value.forEach((move) => drawLegalMoveMark(ctx, move.row, move.col))
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board.value[row][col]) drawPiece(ctx, row, col, board.value[row][col])
    }
  }

  if (hoverPos.value.row >= 0 && hoverPos.value.col >= 0 && isMyTurn.value) {
    const piece = board.value[hoverPos.value.row][hoverPos.value.col]
    if (!piece || piece.color !== myColor.value) drawHoverPiece(ctx, hoverPos.value.row, hoverPos.value.col)
  }
}

function drawPositionMarks(ctx) {
  const marks = [
    { row: 2, col: 1 }, { row: 2, col: 7 },
    { row: 7, col: 1 }, { row: 7, col: 7 },
    { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 3, col: 8 },
    { row: 6, col: 0 }, { row: 6, col: 2 }, { row: 6, col: 4 }, { row: 6, col: 6 }, { row: 6, col: 8 }
  ]

  marks.forEach(({ row, col }) => {
    const x = PADDING + col * cellWidth
    const y = PADDING + row * cellHeight
    const size = 5

    if (col > 0) {
      ctx.beginPath()
      ctx.moveTo(x - size, y - size - 2)
      ctx.lineTo(x - size, y - size)
      ctx.lineTo(x - size - 2, y - size)
      ctx.stroke()
    }
    if (col < COLS - 1) {
      ctx.beginPath()
      ctx.moveTo(x + size, y - size - 2)
      ctx.lineTo(x + size, y - size)
      ctx.lineTo(x + size + 2, y - size)
      ctx.stroke()
    }
    if (col > 0) {
      ctx.beginPath()
      ctx.moveTo(x - size, y + size + 2)
      ctx.lineTo(x - size, y + size)
      ctx.lineTo(x - size - 2, y + size)
      ctx.stroke()
    }
    if (col < COLS - 1) {
      ctx.beginPath()
      ctx.moveTo(x + size, y + size + 2)
      ctx.lineTo(x + size, y + size)
      ctx.lineTo(x + size + 2, y + size)
      ctx.stroke()
    }
  })
}

function drawLastMoveMark(ctx, row, col, type) {
  const x = PADDING + col * cellWidth
  const y = PADDING + row * cellHeight
  ctx.fillStyle = type === 'from' ? 'rgba(100, 100, 100, 0.28)' : 'rgba(255, 92, 92, 0.4)'
  ctx.beginPath()
  ctx.arc(x, y, 18, 0, Math.PI * 2)
  ctx.fill()
}

function drawSelectedMark(ctx, row, col) {
  const x = PADDING + col * cellWidth
  const y = PADDING + row * cellHeight
  ctx.strokeStyle = '#ff7a2b'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, 22, 0, Math.PI * 2)
  ctx.stroke()
}

function drawLegalMoveMark(ctx, row, col) {
  const x = PADDING + col * cellWidth
  const y = PADDING + row * cellHeight
  const piece = board.value[row][col]

  if (piece) {
    ctx.strokeStyle = '#ff4e4e'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 22, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    ctx.fillStyle = 'rgba(76, 198, 255, 0.72)'
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPiece(ctx, row, col, piece) {
  const x = PADDING + col * cellWidth
  const y = PADDING + row * cellHeight
  const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, PIECE_RADIUS)

  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2

  ctx.beginPath()
  ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2)

  if (piece.color === COLORS.RED) {
    gradient.addColorStop(0, '#fff8f0')
    gradient.addColorStop(1, '#f1d1a5')
  } else {
    gradient.addColorStop(0, '#fff8f0')
    gradient.addColorStop(1, '#e6d1aa')
  }

  ctx.fillStyle = gradient
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = piece.color === COLORS.RED ? '#c0392b' : '#223d69'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, PIECE_RADIUS - 3, 0, Math.PI * 2)
  ctx.strokeStyle = piece.color === COLORS.RED ? 'rgba(192, 57, 43, 0.3)' : 'rgba(34, 61, 105, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = piece.color === COLORS.RED ? '#c0392b' : '#223d69'
  ctx.font = 'bold 18px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(pieceLabels[piece.color][piece.type], x, y + 1)
}

function drawHoverPiece(ctx, row, col) {
  const x = PADDING + col * cellWidth
  const y = PADDING + row * cellHeight
  const gradient = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, PIECE_RADIUS)
  ctx.globalAlpha = 0.4

  ctx.beginPath()
  ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2)

  if (myColor.value === COLORS.RED) {
    gradient.addColorStop(0, '#fff8f0')
    gradient.addColorStop(1, '#f1d1a5')
  } else {
    gradient.addColorStop(0, '#fff8f0')
    gradient.addColorStop(1, '#e6d1aa')
  }

  ctx.fillStyle = gradient
  ctx.fill()
  ctx.strokeStyle = myColor.value === COLORS.RED ? '#c0392b' : '#223d69'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.globalAlpha = 1
}

function getCellFromPosition(px, py) {
  const col = Math.round((px - PADDING) / cellWidth)
  const row = Math.round((py - PADDING) / cellHeight)
  if (row >= 0 && row < ROWS && col >= 0 && col < COLS) return { row, col }
  return null
}

function handleBoardInteraction(px, py) {
  if (!isMyTurn.value || gamePhase.value !== 'playing') return
  const cell = getCellFromPosition(px, py)
  if (!cell) return

  const piece = board.value[cell.row][cell.col]
  if (piece && piece.color === myColor.value) {
    emit('action', { type: 'select', row: cell.row, col: cell.col })
    return
  }
  if (selectedCell.value && legalMoves.value.some((move) => move.row === cell.row && move.col === cell.col)) {
    emit('action', { type: 'move', row: cell.row, col: cell.col })
  }
}

function handleBoardHover(px, py) {
  if (!isMyTurn.value) {
    hideHoverPiece()
    return
  }
  const cell = getCellFromPosition(px, py)
  if (cell) {
    const piece = board.value[cell.row][cell.col]
    if (!piece || piece.color !== myColor.value) {
      hoverPos.value = cell
      return
    }
  }
  hideHoverPiece()
}

function getCanvasPoint(clientX, clientY) {
  const rect = boardCanvas.value.getBoundingClientRect()
  return {
    px: (clientX - rect.left) / displayScale,
    py: (clientY - rect.top) / displayScale
  }
}

function handleCanvasClick(event) {
  const { px, py } = getCanvasPoint(event.clientX, event.clientY)
  handleBoardInteraction(px, py)
}

function handleCanvasMove(event) {
  const { px, py } = getCanvasPoint(event.clientX, event.clientY)
  handleBoardHover(px, py)
}

function handleTouchStart(event) {
  if (!event.touches || event.touches.length === 0) return
  const touch = event.touches[0]
  const { px, py } = getCanvasPoint(touch.clientX, touch.clientY)
  handleBoardHover(px, py)
  handleBoardInteraction(px, py)
}

function handleTouchMove(event) {
  if (!event.touches || event.touches.length === 0) return
  const touch = event.touches[0]
  const { px, py } = getCanvasPoint(touch.clientX, touch.clientY)
  handleBoardHover(px, py)
}

function handleTouchEnd() {
  hideHoverPiece()
}

function hideHoverPiece() {
  hoverPos.value = { row: -1, col: -1 }
}

function isInPalace(row, col, color) {
  if (col < 3 || col > 5) return false
  if (color === COLORS.BLACK) return row >= 0 && row <= 2
  return row >= 7 && row <= 9
}

function isOwnSide(row, color) {
  if (color === COLORS.BLACK) return row <= 4
  return row >= 5
}

function getPseudoMoves(currentBoard, row, col) {
  const piece = currentBoard[row]?.[col]
  if (!piece) return []

  const moves = []
  const { type, color } = piece

  const addMove = (nextRow, nextCol) => {
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) return
    const target = currentBoard[nextRow][nextCol]
    if (!target || target.color !== color) {
      moves.push({ row: nextRow, col: nextCol })
    }
  }

  switch (type) {
    case PIECE_TYPES.KING:
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([rowOffset, colOffset]) => {
        const nextRow = row + rowOffset
        const nextCol = col + colOffset
        if (isInPalace(nextRow, nextCol, color)) addMove(nextRow, nextCol)
      })
      break

    case PIECE_TYPES.ADVISOR:
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([rowOffset, colOffset]) => {
        const nextRow = row + rowOffset
        const nextCol = col + colOffset
        if (isInPalace(nextRow, nextCol, color)) addMove(nextRow, nextCol)
      })
      break

    case PIECE_TYPES.BISHOP:
      [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([rowOffset, colOffset]) => {
        const nextRow = row + rowOffset
        const nextCol = col + colOffset
        const eyeRow = row + rowOffset / 2
        const eyeCol = col + colOffset / 2
        if (
          nextRow >= 0 &&
          nextRow < ROWS &&
          nextCol >= 0 &&
          nextCol < COLS &&
          isOwnSide(nextRow, color) &&
          !currentBoard[eyeRow][eyeCol]
        ) {
          addMove(nextRow, nextCol)
        }
      })
      break

    case PIECE_TYPES.ROOK:
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([rowOffset, colOffset]) => {
        let nextRow = row + rowOffset
        let nextCol = col + colOffset
        while (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
          if (!currentBoard[nextRow][nextCol]) {
            moves.push({ row: nextRow, col: nextCol })
          } else {
            if (currentBoard[nextRow][nextCol].color !== color) moves.push({ row: nextRow, col: nextCol })
            break
          }
          nextRow += rowOffset
          nextCol += colOffset
        }
      })
      break

    case PIECE_TYPES.KNIGHT:
      [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([rowOffset, colOffset]) => {
        const nextRow = row + rowOffset
        const nextCol = col + colOffset
        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) return
        const legRow = row + (Math.abs(rowOffset) === 2 ? rowOffset / 2 : 0)
        const legCol = col + (Math.abs(colOffset) === 2 ? colOffset / 2 : 0)
        if (!currentBoard[legRow][legCol]) addMove(nextRow, nextCol)
      })
      break

    case PIECE_TYPES.CANNON:
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([rowOffset, colOffset]) => {
        let nextRow = row + rowOffset
        let nextCol = col + colOffset
        let jumped = false
        while (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
          if (!jumped) {
            if (!currentBoard[nextRow][nextCol]) {
              moves.push({ row: nextRow, col: nextCol })
            } else {
              jumped = true
            }
          } else if (currentBoard[nextRow][nextCol]) {
            if (currentBoard[nextRow][nextCol].color !== color) moves.push({ row: nextRow, col: nextCol })
            break
          }
          nextRow += rowOffset
          nextCol += colOffset
        }
      })
      break

    case PIECE_TYPES.PAWN: {
      const forward = color === COLORS.RED ? -1 : 1
      addMove(row + forward, col)
      if (!isOwnSide(row, color)) {
        addMove(row, col - 1)
        addMove(row, col + 1)
      }
      break
    }
  }

  return moves
}

function findKing(currentBoard, color) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const piece = currentBoard[row][col]
      if (piece && piece.type === PIECE_TYPES.KING && piece.color === color) {
        return { row, col }
      }
    }
  }
  return null
}

function isKingInCheck(currentBoard, color) {
  const king = findKing(currentBoard, color)
  if (!king) return true
  const opponentColor = color === COLORS.RED ? COLORS.BLACK : COLORS.RED

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const piece = currentBoard[row][col]
      if (piece && piece.color === opponentColor) {
        const moves = getPseudoMoves(currentBoard, row, col)
        if (moves.some((move) => move.row === king.row && move.col === king.col)) return true
      }
    }
  }

  return false
}

function simulateMove(currentBoard, fromRow, fromCol, toRow, toCol) {
  const nextBoard = currentBoard.map((row) => [...row])
  nextBoard[toRow][toCol] = nextBoard[fromRow][fromCol]
  nextBoard[fromRow][fromCol] = null
  return nextBoard
}

function getLegalMoves(currentBoard, row, col) {
  const piece = currentBoard[row]?.[col]
  if (!piece) return []
  return getPseudoMoves(currentBoard, row, col).filter((move) => {
    const nextBoard = simulateMove(currentBoard, row, col, move.row, move.col)
    return !isKingInCheck(nextBoard, piece.color)
  })
}

onMounted(() => {
  nextTick(() => {
    drawBoard()
  })
  window.addEventListener('resize', drawBoard)
})

onUnmounted(() => {
  window.removeEventListener('resize', drawBoard)
})

watch([board, selectedCell, lastMoveFrom, lastMoveTo, hoverPos, isMyTurn, myColor, gamePhase], () => {
  drawBoard()
})
</script>

<style scoped>
.chess-board {
  min-height: calc(100vh - 88px);
  padding: 8px 0 18px;
  position: relative;
  color: #fff;
}

.chess-board::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background:
    linear-gradient(rgba(14, 102, 240, 0.18), rgba(14, 102, 240, 0.18)),
    url('/assets/ui-ref/chess.png') center top / cover no-repeat;
  opacity: 0.28;
  pointer-events: none;
}

.loading {
  min-height: 70vh;
  display: grid;
  place-items: center;
  gap: 16px;
  color: #fff;
}

.loading-spinner {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.18);
  border-top-color: #ffd34d;
  animation: spin 0.9s linear infinite;
}

.versus-panel,
.status-banner,
.board-shell,
.action-strip,
.info-strip,
.bottom-banner {
  position: relative;
  z-index: 1;
  max-width: 940px;
  margin-left: auto;
  margin-right: auto;
}

.versus-panel {
  border-radius: 24px;
  padding: 14px 18px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: linear-gradient(180deg, rgba(248, 252, 255, 0.96), rgba(227, 239, 255, 0.92));
  color: #24477d;
}

.player-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.player-card.opponent {
  justify-content: flex-end;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #ffffff, #dfeaff);
  border: 2px solid rgba(255, 255, 255, 0.82);
  color: #1d6bde;
  font-size: 30px;
  font-weight: 900;
}

.avatar.ghost {
  color: #6f8dbf;
}

.player-card strong {
  display: block;
  font-size: 28px;
}

.player-card span {
  display: block;
  margin-top: 4px;
  color: #607cad;
  font-size: 18px;
}

.vs-word {
  font-size: 44px;
  font-weight: 900;
  color: #ffb200;
  text-shadow: 0 4px 10px rgba(195, 113, 12, 0.35);
}

.status-banner {
  margin-top: 12px;
  min-height: 52px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
  background: linear-gradient(180deg, rgba(246, 251, 255, 0.97), rgba(227, 239, 255, 0.94));
  color: #1f54aa;
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.board-shell {
  margin-top: 12px;
  padding: 18px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(250, 234, 198, 0.98), rgba(243, 221, 175, 0.96));
  box-shadow: 0 16px 32px rgba(8, 63, 162, 0.18);
  display: flex;
  justify-content: center;
}

.board-canvas {
  display: block;
  border-radius: 18px;
  box-shadow: inset 0 0 0 3px rgba(160, 106, 38, 0.3);
  cursor: pointer;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
}

.action-strip {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.action-card {
  min-height: 108px;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.62);
  color: #24477d;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 12px 20px rgba(8, 72, 182, 0.18);
}

.action-card span {
  font-size: 32px;
}

.action-card strong {
  font-size: 24px;
}

.action-card.orange {
  background: linear-gradient(180deg, #fff0d1, #ffe0a8);
}

.action-card.gold {
  background: linear-gradient(180deg, #fff9dd, #ffeab2);
}

.action-card.blue {
  background: linear-gradient(180deg, #e8f3ff, #d4e9ff);
}

.action-card.cream {
  background: linear-gradient(180deg, #fffaf0, #fff0d9);
}

.info-strip {
  margin-top: 14px;
  border-radius: 20px;
  padding: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: linear-gradient(180deg, rgba(247, 251, 255, 0.97), rgba(232, 241, 255, 0.95));
  color: #21467f;
}

.info-item {
  text-align: center;
}

.info-item span {
  display: block;
  color: #6887b4;
  font-size: 17px;
}

.info-item strong {
  display: block;
  margin-top: 6px;
  font-size: 34px;
}

.bottom-banner {
  margin-top: 14px;
  border-radius: 18px;
  min-height: 74px;
  display: grid;
  place-items: center;
  background: linear-gradient(90deg, rgba(216, 245, 255, 0.95), rgba(244, 251, 255, 0.95));
  color: #1d57b1;
  font-size: 30px;
  font-weight: 900;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 12;
  background: rgba(18, 84, 206, 0.96);
  color: #fff;
  padding: 12px 18px;
  border-radius: 999px;
  font-size: 15px;
  box-shadow: 0 10px 24px rgba(8, 56, 148, 0.35);
}

.result-panel {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(7, 24, 60, 0.58);
  display: grid;
  place-items: center;
}

.result-content {
  width: min(92vw, 360px);
  border-radius: 22px;
  padding: 22px 18px;
  background: linear-gradient(180deg, #ffffff, #eef5ff);
  color: #24477d;
  text-align: center;
}

.result-badge {
  width: 82px;
  height: 82px;
  border-radius: 50%;
  margin: 0 auto 12px;
  display: grid;
  place-items: center;
  font-size: 34px;
  font-weight: 900;
  color: #fff;
}

.result-badge.winner {
  background: linear-gradient(180deg, #ffc94d, #f39a10);
}

.result-badge.loser {
  background: linear-gradient(180deg, #ff7865, #e14d4d);
}

.result-content h2 {
  margin: 0;
  font-size: 30px;
}

.result-content p {
  margin: 8px 0 0;
  color: #5d7baa;
}

.result-actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.primary-btn,
.secondary-btn {
  min-height: 46px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 800;
}

.primary-btn {
  background: linear-gradient(180deg, #2e8dff, #0c59ef);
  color: #fff;
}

.secondary-btn {
  background: #fff;
  color: #1e65d7;
  border: 1px solid #bfd6fb;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .versus-panel {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .player-card,
  .player-card.opponent {
    justify-content: center;
  }

  .action-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bottom-banner,
  .info-item strong {
    font-size: 20px;
  }

  .player-card strong {
    font-size: 20px;
  }
}

/* Reference-art refresh */
.chess-board::before {
  opacity: 0.34;
  filter: saturate(1.08);
}

.versus-panel,
.status-banner,
.board-shell,
.info-strip {
  border: 2px solid var(--panel-border);
  box-shadow: var(--shadow-soft);
}

.versus-panel {
  border-radius: 30px;
}

.vs-word {
  color: #ffc12d;
  -webkit-text-stroke: 1px #fff4bf;
}

.status-banner {
  box-shadow: var(--shadow-soft);
}

.board-shell {
  border-radius: 30px;
  padding: 20px;
  background:
    linear-gradient(180deg, rgba(255, 241, 210, 0.98), rgba(246, 221, 173, 0.96));
}

.board-canvas {
  border: 2px solid rgba(172, 108, 36, 0.5);
  box-shadow:
    inset 0 0 0 3px rgba(160, 106, 38, 0.26),
    0 12px 24px rgba(104, 63, 18, 0.16);
}

.action-card {
  min-height: 116px;
  border-radius: 20px;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.56),
    0 10px 0 rgba(145, 87, 12, 0.1),
    0 16px 24px rgba(8, 72, 182, 0.16);
}

.bottom-banner {
  min-height: 88px;
  border: 2px solid #cce8ff;
  background:
    radial-gradient(circle at 12% 70%, rgba(40, 180, 113, 0.24), transparent 25%),
    radial-gradient(circle at 86% 68%, rgba(255, 174, 34, 0.2), transparent 23%),
    linear-gradient(90deg, rgba(216, 245, 255, 0.96), rgba(255, 255, 255, 0.98) 52%, rgba(223, 247, 255, 0.96));
  text-shadow: 0 2px 0 #fff;
}
</style>
