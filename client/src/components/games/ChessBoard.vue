<template>
  <section class="chess-board">
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>正在同步象棋对局...</p>
    </div>

    <template v-else>
      <section class="battle-card">
        <div class="player-mini">
          <div class="avatar">{{ myName.slice(0, 1) }}</div>
          <div class="player-mini__copy">
            <strong>{{ myName }}</strong>
            <span>{{ mySideLabel }}</span>
          </div>
        </div>

        <div class="battle-meta">
          <div class="battle-meta__turn" :class="{ mine: isMyTurn, done: gamePhase === 'finished' }">
            {{ phaseText }}
          </div>
          <div class="battle-meta__score">
            <span>回合 {{ moveCount }}</span>
            <span>{{ captureText }}</span>
          </div>
        </div>

        <div class="player-mini opponent">
          <div class="player-mini__copy">
            <strong>{{ opponentName }}</strong>
            <span>{{ opponentSideLabel }}</span>
          </div>
          <div class="avatar ghost">{{ opponentName.slice(0, 1) }}</div>
        </div>
      </section>

      <section class="board-card">
        <div class="board-head">
          <span class="mode-chip">{{ mySideLabel }}</span>
          <span class="mode-chip soft">
            {{ selectedPieceLabel ? `${selectedPieceLabel} · 可走 ${legalMoves.length} 步` : '九路十行标准棋盘' }}
          </span>
        </div>

        <div class="board-shell">
          <div class="board-surface">
            <div class="board-playarea">
              <div
                v-for="line in horizontalLines"
                :key="`h-${line.key}`"
                class="grid-line horizontal"
                :style="{ top: `${line.top}%` }"
              ></div>

              <template v-for="line in verticalLines" :key="line.key">
                <div
                  class="grid-line vertical"
                  :style="{
                    left: `${line.left}%`,
                    top: `${line.top}%`,
                    height: `${line.height}%`
                  }"
                ></div>
              </template>

              <svg class="palace-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line
                  v-for="line in palaceLines"
                  :key="line.key"
                  :x1="line.x1"
                  :y1="line.y1"
                  :x2="line.x2"
                  :y2="line.y2"
                />
              </svg>

              <div
                v-for="mark in anchorMarks"
                :key="mark.key"
                class="anchor-mark"
                :class="mark.mask"
                :style="mark.style"
              >
                <span class="anchor corner tl"></span>
                <span class="anchor corner tr"></span>
                <span class="anchor corner bl"></span>
                <span class="anchor corner br"></span>
              </div>

              <div class="river-label river-left">楚河</div>
              <div class="river-label river-right">汉界</div>

              <button
                v-for="cell in cells"
                :key="cell.key"
                type="button"
                class="intersection"
                :class="intersectionClass(cell)"
                :style="pointStyle(cell)"
                @click="handlePointTap(cell)"
              >
                <span
                  v-if="isLegalMoveCell(cell) && !cell.piece"
                  class="move-dot"
                ></span>
                <span
                  v-if="isLegalMoveCell(cell) && cell.piece && cell.piece.color !== myColor"
                  class="capture-ring"
                ></span>
                <span
                  v-if="cell.piece"
                  class="piece-token"
                  :class="pieceTokenClass(cell)"
                >
                  {{ pieceText(cell.piece) }}
                </span>
                <span v-if="isLastMoveCell(cell, 'from')" class="trace from"></span>
                <span v-if="isLastMoveCell(cell, 'to')" class="trace to"></span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="info-strip">
        <div class="info-item">
          <span>轮到</span>
          <strong>{{ currentSideLabel }}</strong>
        </div>
        <div class="info-item">
          <span>已吃子</span>
          <strong>{{ myCaptureCount }}</strong>
        </div>
        <div class="info-item">
          <span>局面</span>
          <strong>{{ selectedPieceLabel || '等待选子' }}</strong>
        </div>
      </section>

      <section class="action-grid">
        <button type="button" class="action-btn select" @click="showSelectionTip">
          <span class="action-btn__badge">步</span>
          <span class="action-btn__copy">
            <strong>走法提示</strong>
            <small>{{ selectedPieceLabel ? `当前 ${legalMoves.length} 个落点` : '先点己方棋子' }}</small>
          </span>
        </button>

        <button type="button" class="action-btn undo" @click="emit('action', { type: 'undo' })">
          <span class="action-btn__badge">悔</span>
          <span class="action-btn__copy">
            <strong>悔棋</strong>
            <small>回退上一手</small>
          </span>
        </button>

        <button type="button" class="action-btn restart" @click="$emit('rematch')">
          <span class="action-btn__badge">重</span>
          <span class="action-btn__copy">
            <strong>重新开始</strong>
            <small>快速再来一局</small>
          </span>
        </button>

        <button type="button" class="action-btn back" @click="$emit('back')">
          <span class="action-btn__badge">返</span>
          <span class="action-btn__copy">
            <strong>返回大厅</strong>
            <small>退出当前对局</small>
          </span>
        </button>
      </section>
    </template>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <transition name="fade">
      <div v-if="gamePhase === 'finished'" class="result-panel">
        <div class="result-card">
          <div class="result-badge" :class="winnerClass">
            {{ props.gs.winner === myColor ? '胜' : '负' }}
          </div>
          <h2>{{ resultText }}</h2>
          <p>{{ resultDetail }}</p>
          <div class="result-actions">
            <button type="button" class="primary-btn" @click="$emit('rematch')">再来一局</button>
            <button type="button" class="secondary-btn" @click="$emit('back')">返回大厅</button>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

const ROWS = 10
const COLS = 9
const RIVER_GAP = 0
const TOTAL_ROW_UNITS = (ROWS - 1) + RIVER_GAP
const BOARD_LEFT = 7.5
const BOARD_RIGHT = 92.5
const BOARD_TOP = 7.5
const BOARD_BOTTOM = 92.5
const BOARD_WIDTH = BOARD_RIGHT - BOARD_LEFT
const BOARD_HEIGHT = BOARD_BOTTOM - BOARD_TOP

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

const anchorCoords = [
  { row: 2, col: 1, mask: 'all' },
  { row: 2, col: 7, mask: 'all' },
  { row: 7, col: 1, mask: 'all' },
  { row: 7, col: 7, mask: 'all' },
  { row: 3, col: 0, mask: 'right' },
  { row: 3, col: 2, mask: 'all' },
  { row: 3, col: 4, mask: 'all' },
  { row: 3, col: 6, mask: 'all' },
  { row: 3, col: 8, mask: 'left' },
  { row: 6, col: 0, mask: 'right' },
  { row: 6, col: 2, mask: 'all' },
  { row: 6, col: 4, mask: 'all' },
  { row: 6, col: 6, mask: 'all' },
  { row: 6, col: 8, mask: 'left' }
]

const toast = ref('')
let toastTimer = null

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null))

const board = computed(() => (props.gs?.board?.length ? props.gs.board : emptyBoard()))
const isReady = computed(() => Boolean(props.gs?.board && props.gs?.players?.length))
const myId = computed(() => props.player?.id || '')
const redId = computed(() => props.gs?.players?.[0] || '')
const blackId = computed(() => props.gs?.players?.[1] || '')

const myColor = computed(() => {
  if (!myId.value) return COLORS.RED
  return blackId.value === myId.value ? COLORS.BLACK : COLORS.RED
})

const opponentColor = computed(() => (myColor.value === COLORS.RED ? COLORS.BLACK : COLORS.RED))
const currentColor = computed(() => props.gs?.currentPlayer || COLORS.RED)
const gamePhase = computed(() => props.gs?.phase || 'waiting')
const moveCount = computed(() => props.gs?.moveHistory?.length || 0)
const myName = computed(() => props.player?.nickname || '我方')

const opponentName = computed(() => {
  const opponentId = myColor.value === COLORS.RED ? blackId.value : redId.value
  return props.roomPlayers.find((item) => item.id === opponentId)?.nickname || '对手'
})

const isMyTurn = computed(() => gamePhase.value === 'playing' && currentColor.value === myColor.value)
const mySideLabel = computed(() => (myColor.value === COLORS.RED ? '我方 · 红方' : '我方 · 黑方'))
const opponentSideLabel = computed(() => (myColor.value === COLORS.RED ? '对手 · 黑方' : '对手 · 红方'))
const currentSideLabel = computed(() => (currentColor.value === COLORS.RED ? '红方' : '黑方'))
const myCaptureCount = computed(() => props.gs?.capturedPieces?.[myColor.value]?.length || 0)
const opponentCaptureCount = computed(() => props.gs?.capturedPieces?.[opponentColor.value]?.length || 0)
const captureText = computed(() => `吃子 ${myCaptureCount.value}:${opponentCaptureCount.value}`)

const phaseText = computed(() => {
  if (gamePhase.value === 'finished') return '本局已结束'
  return isMyTurn.value ? '轮到你行棋' : `等待 ${opponentName.value}`
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

const selectedPieceLabel = computed(() => {
  if (!selectedPiece.value) return ''
  return `${pieceText(selectedPiece.value)}${toCoord(selectedCell.value.row, selectedCell.value.col)}`
})

const legalMoves = computed(() => {
  const selected = selectedCell.value
  const piece = selectedPiece.value
  if (!selected || !piece || piece.color !== myColor.value || !isMyTurn.value) return []
  return getLegalMoves(board.value, selected.row, selected.col)
})

const lastMove = computed(() => props.gs?.lastMove || null)

const winnerClass = computed(() => (props.gs?.winner === myColor.value ? 'winner' : 'loser'))
const resultText = computed(() => (props.gs?.winner === myColor.value ? '将杀成功' : '本局失利'))
const resultDetail = computed(() =>
  props.gs?.winner === myColor.value ? '你已经完成绝杀，漂亮拿下这一局。' : `${opponentName.value} 率先形成胜势。`
)

const cells = computed(() => {
  const list = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      list.push({
        key: `${row}-${col}`,
        row,
        col,
        piece: board.value[row][col]
      })
    }
  }
  return list
})

const horizontalLines = computed(() =>
  Array.from({ length: ROWS }, (_, row) => ({
    key: row,
    top: yPercent(viewRow(row))
  }))
)

const verticalLines = computed(() => {
  const lines = []
  const topHeight = yPercent(4) - BOARD_TOP
  const bottomTop = yPercent(5)
  const bottomHeight = BOARD_BOTTOM - bottomTop

  for (let col = 0; col < COLS; col += 1) {
    const left = xPercent(col)
    if (col === 0 || col === COLS - 1) {
      lines.push({ key: `full-${col}`, left, top: BOARD_TOP, height: BOARD_HEIGHT })
    } else {
      lines.push({ key: `top-${col}`, left, top: BOARD_TOP, height: topHeight })
      lines.push({ key: `bottom-${col}`, left, top: bottomTop, height: bottomHeight })
    }
  }
  return lines
})

const palaceLines = computed(() => {
  const blackPalace = [{ from: { row: 0, col: 3 }, to: { row: 2, col: 5 } }, { from: { row: 0, col: 5 }, to: { row: 2, col: 3 } }]
  const redPalace = [{ from: { row: 9, col: 3 }, to: { row: 7, col: 5 } }, { from: { row: 9, col: 5 }, to: { row: 7, col: 3 } }]
  
  const topPalace = myColor.value === COLORS.BLACK ? redPalace : blackPalace
  const bottomPalace = myColor.value === COLORS.BLACK ? blackPalace : redPalace
  
  return [
    createPalaceLine('top-a', topPalace[0].from, topPalace[0].to),
    createPalaceLine('top-b', topPalace[1].from, topPalace[1].to),
    createPalaceLine('bottom-a', bottomPalace[0].from, bottomPalace[0].to),
    createPalaceLine('bottom-b', bottomPalace[1].from, bottomPalace[1].to)
  ]
})

const anchorMarks = computed(() =>
  anchorCoords.map((coord) => ({
    key: `${coord.row}-${coord.col}`,
    style: anchorStyle(coord),
    mask: coord.mask
  }))
)

onBeforeUnmount(() => {
  clearToast()
})

function showToast(text) {
  clearToast()
  toast.value = text
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 1800)
}

function clearToast() {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
}

function showSelectionTip() {
  if (!selectedPiece.value) {
    showToast('先点击己方棋子，再查看可落点。')
    return
  }
  showToast(`${selectedPieceLabel.value} 当前可走 ${legalMoves.value.length} 步`)
}

function pointStyle(cell) {
  const { row, col } = toViewPoint(cell.row, cell.col)
  return {
    left: `${xPercent(col)}%`,
    top: `${yPercent(row)}%`
  }
}

function toTopPercent(row) {
  return (rowUnit(row) / TOTAL_ROW_UNITS) * 100
}

function yPercent(row) {
  return BOARD_TOP + (toTopPercent(row) / 100) * BOARD_HEIGHT
}

function xPercent(col) {
  return BOARD_LEFT + (col / (COLS - 1)) * BOARD_WIDTH
}

function rowUnit(row) {
  return row + (row >= 5 ? RIVER_GAP : 0)
}

function viewRow(row) {
  return myColor.value === COLORS.BLACK ? ROWS - 1 - row : row
}

function viewCol(col) {
  return myColor.value === COLORS.BLACK ? COLS - 1 - col : col
}

function toViewPoint(row, col) {
  return {
    row: viewRow(row),
    col: viewCol(col)
  }
}

function toCoord(row, col) {
  const files = ['九', '八', '七', '六', '五', '四', '三', '二', '一']
  const viewColumn = myColor.value === COLORS.BLACK ? col : 8 - col
  const step = myColor.value === COLORS.BLACK ? row + 1 : 10 - row
  return `${files[viewColumn]}${step}`
}

function pieceText(piece) {
  return pieceLabels[piece.color]?.[piece.type] || ''
}

function pieceTokenClass(cell) {
  return {
    red: cell.piece?.color === COLORS.RED,
    black: cell.piece?.color === COLORS.BLACK,
    selected: isSelectedCell(cell),
    selectable: canSelectPiece(cell)
  }
}

function intersectionClass(cell) {
  return {
    selected: isSelectedCell(cell),
    legal: isLegalMoveCell(cell),
    owned: canSelectPiece(cell)
  }
}

function isSelectedCell(cell) {
  return selectedCell.value?.row === cell.row && selectedCell.value?.col === cell.col
}

function isLegalMoveCell(cell) {
  return legalMoves.value.some((move) => move.row === cell.row && move.col === cell.col)
}

function isLastMoveCell(cell, phase) {
  if (!lastMove.value) return false
  const point = phase === 'from' ? lastMove.value.from : lastMove.value.to
  return point?.row === cell.row && point?.col === cell.col
}

function canSelectPiece(cell) {
  return Boolean(cell.piece && cell.piece.color === myColor.value && isMyTurn.value)
}

function handlePointTap(cell) {
  if (!isMyTurn.value || gamePhase.value !== 'playing') return

  if (canSelectPiece(cell)) {
    emit('action', { type: 'select', row: cell.row, col: cell.col })
    return
  }

  if (selectedCell.value && isLegalMoveCell(cell)) {
    emit('action', {
      type: 'move',
      fromRow: selectedCell.value.row,
      fromCol: selectedCell.value.col,
      row: cell.row,
      col: cell.col
    })
  }
}

function createPalaceLine(key, from, to) {
  const fromPoint = toViewPoint(from.row, from.col)
  const toPoint = toViewPoint(to.row, to.col)
  return {
    key,
    x1: xPercent(fromPoint.col),
    y1: yPercent(fromPoint.row),
    x2: xPercent(toPoint.col),
    y2: yPercent(toPoint.row)
  }
}

function anchorStyle(coord) {
  const point = toViewPoint(coord.row, coord.col)
  return {
    left: `${xPercent(point.col)}%`,
    top: `${yPercent(point.row)}%`
  }
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

function getValidMoves(stateBoard, row, col) {
  const piece = stateBoard[row][col]
  if (!piece) return []

  const moves = []
  const { type, color } = piece

  const addMove = (nextRow, nextCol) => {
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) return
    const target = stateBoard[nextRow][nextCol]
    if (!target || target.color !== color) {
      moves.push({ row: nextRow, col: nextCol })
    }
  }

  switch (type) {
    case PIECE_TYPES.KING:
      ;[[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
        const nextRow = row + dr
        const nextCol = col + dc
        if (isInPalace(nextRow, nextCol, color)) addMove(nextRow, nextCol)
      })
      break

    case PIECE_TYPES.ADVISOR:
      ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
        const nextRow = row + dr
        const nextCol = col + dc
        if (isInPalace(nextRow, nextCol, color)) addMove(nextRow, nextCol)
      })
      break

    case PIECE_TYPES.BISHOP:
      ;[[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
        const nextRow = row + dr
        const nextCol = col + dc
        if (
          nextRow >= 0 &&
          nextRow < ROWS &&
          nextCol >= 0 &&
          nextCol < COLS &&
          isOwnSide(nextRow, color) &&
          !stateBoard[row + dr / 2][col + dc / 2]
        ) {
          addMove(nextRow, nextCol)
        }
      })
      break

    case PIECE_TYPES.ROOK:
      ;[[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
        let nextRow = row + dr
        let nextCol = col + dc
        while (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
          if (!stateBoard[nextRow][nextCol]) {
            moves.push({ row: nextRow, col: nextCol })
          } else {
            if (stateBoard[nextRow][nextCol].color !== color) {
              moves.push({ row: nextRow, col: nextCol })
            }
            break
          }
          nextRow += dr
          nextCol += dc
        }
      })
      break

    case PIECE_TYPES.KNIGHT:
      ;[[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => {
        const nextRow = row + dr
        const nextCol = col + dc
        if (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
          const legRow = row + (Math.abs(dr) === 2 ? dr / 2 : 0)
          const legCol = col + (Math.abs(dc) === 2 ? dc / 2 : 0)
          if (!stateBoard[legRow][legCol]) addMove(nextRow, nextCol)
        }
      })
      break

    case PIECE_TYPES.CANNON:
      ;[[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
        let nextRow = row + dr
        let nextCol = col + dc
        let jumped = false
        while (nextRow >= 0 && nextRow < ROWS && nextCol >= 0 && nextCol < COLS) {
          if (!jumped) {
            if (!stateBoard[nextRow][nextCol]) {
              moves.push({ row: nextRow, col: nextCol })
            } else {
              jumped = true
            }
          } else if (stateBoard[nextRow][nextCol]) {
            if (stateBoard[nextRow][nextCol].color !== color) {
              moves.push({ row: nextRow, col: nextCol })
            }
            break
          }
          nextRow += dr
          nextCol += dc
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

    default:
      break
  }

  return moves
}

function findKing(stateBoard, color) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (stateBoard[row][col]?.type === PIECE_TYPES.KING && stateBoard[row][col].color === color) {
        return { row, col }
      }
    }
  }
  return null
}

function isKingInCheck(stateBoard, color) {
  const king = findKing(stateBoard, color)
  if (!king) return true

  const attackerColor = color === COLORS.RED ? COLORS.BLACK : COLORS.RED
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (stateBoard[row][col]?.color === attackerColor) {
        const moves = getValidMoves(stateBoard, row, col)
        if (moves.some((move) => move.row === king.row && move.col === king.col)) {
          return true
        }
      }
    }
  }
  return false
}

function simulateMove(stateBoard, fromRow, fromCol, toRow, toCol) {
  const clonedBoard = stateBoard.map((line) => [...line])
  clonedBoard[toRow][toCol] = clonedBoard[fromRow][fromCol]
  clonedBoard[fromRow][fromCol] = null
  return clonedBoard
}

function getLegalMoves(stateBoard, row, col) {
  const piece = stateBoard[row][col]
  if (!piece) return []

  return getValidMoves(stateBoard, row, col).filter((move) => {
    const nextBoard = simulateMove(stateBoard, row, col, move.row, move.col)
    return !isKingInCheck(nextBoard, piece.color)
  })
}
</script>

<style scoped>
.chess-board {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #17305f;
}

.loading,
.result-panel {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading {
  min-height: 420px;
  flex-direction: column;
  gap: 12px;
  color: #365da8;
}

.loading-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid rgba(56, 126, 255, 0.18);
  border-top-color: #397fff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.battle-card,
.board-card,
.info-strip,
.action-grid,
.result-card {
  border-radius: 24px;
  box-shadow: 0 14px 28px rgba(38, 82, 180, 0.14);
}

.battle-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(236, 245, 255, 0.96));
}

.player-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.player-mini.opponent {
  justify-content: flex-end;
}

.player-mini__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.player-mini__copy strong,
.player-mini__copy span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-mini__copy strong {
  font-size: 17px;
  font-weight: 800;
  color: #143372;
}

.player-mini__copy span {
  font-size: 12px;
  color: #6781b8;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #65a8ff, #3069f6);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  flex-shrink: 0;
}

.avatar.ghost {
  background: linear-gradient(180deg, #eef4ff, #d9e7ff);
  color: #5e79b2;
}

.battle-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.battle-meta__turn {
  min-width: 130px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(44, 111, 255, 0.1);
  color: #3966d5;
  font-size: 15px;
  font-weight: 800;
  text-align: center;
}

.battle-meta__turn.mine {
  background: linear-gradient(180deg, #4e9cff, #2d6eff);
  color: #fff;
  box-shadow: 0 10px 18px rgba(61, 110, 255, 0.28);
}

.battle-meta__turn.done {
  background: linear-gradient(180deg, #6f7faa, #43557f);
  color: #fff;
}

.battle-meta__score {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 12px;
  color: #6b82b3;
}

.board-card {
  padding: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(243, 247, 255, 0.95));
}

.board-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  padding: 7px 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, #3f88ff, #2f69ff);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.mode-chip.soft {
  flex: 1;
  min-width: 0;
  background: rgba(65, 128, 255, 0.12);
  color: #3864c7;
}

.board-shell {
  padding: 10px;
  border-radius: 24px;
  background: linear-gradient(180deg, #f6ddb0, #ecc889);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.45);
}

.board-surface {
  position: relative;
  border-radius: 18px;
  padding: 10px;
  background:
    radial-gradient(circle at 22% 18%, rgba(255, 255, 255, 0.35), transparent 24%),
    linear-gradient(180deg, rgba(255, 245, 214, 0.94), rgba(242, 209, 142, 0.94));
  box-shadow:
    inset 0 0 0 2px rgba(147, 92, 24, 0.22),
    inset 0 10px 18px rgba(255, 255, 255, 0.2);
}

.board-surface::before,
.board-surface::after {
  content: "";
  position: absolute;
  pointer-events: none;
  border-radius: 14px;
}

.board-surface::before {
  inset: 8px;
  border: 1.4px solid rgba(146, 96, 28, 0.34);
}

.board-surface::after {
  inset: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.board-playarea {
  position: relative;
  width: 100%;
  aspect-ratio: 8 / 9;
}

.grid-line,
.palace-overlay {
  position: absolute;
  pointer-events: none;
}

.grid-line.horizontal {
  left: 7.5%;
  width: 85%;
  height: 1.4px;
  background: rgba(115, 65, 12, 0.84);
  transform: translateY(-50%);
}

.grid-line.vertical {
  width: 1.4px;
  background: rgba(115, 65, 12, 0.84);
  transform: translateX(-50%);
}

.palace-overlay {
  inset: 0;
}

.palace-overlay line {
  stroke: rgba(115, 65, 12, 0.45);
  stroke-width: 1.4;
}

.anchor-mark {
  position: absolute;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.anchor-mark.left .tr,
.anchor-mark.left .br,
.anchor-mark.right .tl,
.anchor-mark.right .bl {
  display: none;
}

.anchor {
  position: absolute;
  width: 6px;
  height: 6px;
  border-color: rgba(115, 65, 12, 0.82);
  border-style: solid;
}

.anchor.tl {
  top: 0;
  left: 0;
  border-width: 1.2px 0 0 1.2px;
}

.anchor.tr {
  top: 0;
  right: 0;
  border-width: 1.2px 1.2px 0 0;
}

.anchor.bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 1.2px 1.2px;
}

.anchor.br {
  right: 0;
  bottom: 0;
  border-width: 0 1.2px 1.2px 0;
}

.river-label {
  position: absolute;
  top: 50.4%;
  transform: translateY(-50%);
  font-size: clamp(17px, 4vw, 22px);
  font-weight: 800;
  letter-spacing: 0;
  color: rgba(126, 72, 13, 0.8);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
  pointer-events: none;
}

.river-left {
  left: 31%;
}

.river-right {
  right: 31%;
}

.intersection {
  position: absolute;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.intersection.owned {
  cursor: pointer;
}

.piece-token,
.move-dot,
.capture-ring,
.trace {
  position: absolute;
  display: block;
  pointer-events: none;
}

.piece-token {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 19px;
  font-weight: 900;
  box-shadow:
    0 8px 14px rgba(92, 57, 10, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(141, 92, 22, 0.16);
  background: linear-gradient(180deg, #fff9ec, #f2e2bc);
}

.piece-token.red {
  color: #c7443d;
}

.piece-token.black {
  color: #26324c;
}

.piece-token.selected {
  box-shadow:
    0 10px 18px rgba(57, 110, 255, 0.2),
    0 0 0 3px rgba(57, 110, 255, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.move-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(54, 138, 255, 0.92);
  box-shadow: 0 0 0 5px rgba(54, 138, 255, 0.12);
}

.capture-ring {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 110, 68, 0.86);
}

.trace {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.trace.from {
  background: rgba(55, 124, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(55, 124, 255, 0.5);
}

.trace.to {
  width: 14px;
  height: 14px;
  background: rgba(255, 142, 63, 0.24);
  box-shadow: inset 0 0 0 1px rgba(255, 142, 63, 0.72);
}

.info-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.92);
}

.info-item {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, #f5f9ff, #ecf3ff);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item span {
  font-size: 11px;
  color: #7690bf;
}

.info-item strong {
  font-size: 15px;
  font-weight: 800;
  color: #19376c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.action-btn {
  min-width: 0;
  border: 0;
  border-radius: 22px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 12px 22px rgba(51, 94, 200, 0.16);
}

.action-btn__badge {
  width: 36px;
  height: 36px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

.action-btn__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.action-btn__copy strong,
.action-btn__copy small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-btn__copy strong {
  font-size: 15px;
  font-weight: 800;
}

.action-btn__copy small {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.82);
}

.action-btn.select {
  background: linear-gradient(135deg, #48c8d8, #418bff);
}

.action-btn.undo {
  background: linear-gradient(135deg, #5f8cff, #3d6cff);
}

.action-btn.restart {
  background: linear-gradient(135deg, #ffbe45, #ff8e4a);
}

.action-btn.back {
  background: linear-gradient(135deg, #6d7ee7, #5263ce);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 120px;
  transform: translateX(-50%);
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(21, 39, 77, 0.9);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  z-index: 30;
  box-shadow: 0 12px 22px rgba(14, 27, 55, 0.24);
}

.result-panel {
  position: fixed;
  inset: 0;
  padding: 20px;
  background: rgba(16, 31, 67, 0.42);
  backdrop-filter: blur(8px);
  z-index: 40;
}

.result-card {
  width: min(100%, 320px);
  padding: 24px 22px 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(236, 244, 255, 0.97));
  text-align: center;
}

.result-badge {
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
}

.result-badge.winner {
  background: linear-gradient(180deg, #ffcb55, #ff9f38);
}

.result-badge.loser {
  background: linear-gradient(180deg, #7f93c2, #5c6f99);
}

.result-card h2 {
  margin: 0;
  font-size: 24px;
  color: #173566;
}

.result-card p {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: #5b6f99;
}

.result-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.primary-btn,
.secondary-btn {
  border: 0;
  border-radius: 16px;
  padding: 12px 10px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.primary-btn {
  background: linear-gradient(180deg, #4f9cff, #2f6cff);
  color: #fff;
}

.secondary-btn {
  background: rgba(52, 103, 225, 0.1);
  color: #315ed2;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
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

@media (max-width: 420px) {
  .battle-card {
    padding: 12px;
    gap: 8px;
  }

  .player-mini__copy strong {
    font-size: 15px;
  }

  .battle-meta__turn {
    min-width: 108px;
    padding-inline: 10px;
    font-size: 14px;
  }

  .board-card,
  .info-strip {
    padding: 10px;
  }

  .board-shell {
    padding: 8px;
  }

  .board-surface {
    padding: 8px;
  }

  .intersection {
    width: 34px;
    height: 34px;
  }

  .piece-token {
    width: 30px;
    height: 30px;
    font-size: 18px;
  }
}
</style>
