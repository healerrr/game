<template>
  <section class="gomoku-board">
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载五子棋棋盘...</p>
    </div>

    <template v-else>
      <header class="versus-panel">
        <div class="player-card">
          <div class="avatar">{{ myName.slice(0, 1) }}</div>
          <div>
            <strong>{{ myName }}</strong>
            <span>{{ myIndex === 0 ? '我方 · 黑棋' : '我方 · 白棋' }}</span>
          </div>
        </div>
        <div class="vs-word">VS</div>
        <div class="player-card opponent">
          <div>
            <strong>{{ opponentName }}</strong>
            <span>{{ myIndex === 0 ? '对手 · 白棋' : '对手 · 黑棋' }}</span>
          </div>
          <div class="avatar ghost">{{ opponentName.slice(0, 1) }}</div>
        </div>
      </header>

      <div class="turn-banner">
        {{ gamePhase === 'finished' ? '对局结束' : turnText }}
      </div>

      <div class="board-frame">
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

      <div class="tool-row">
        <button class="tool-card hint" @click="showSuggestedMove">
          <span>🔍</span>
          <strong>落子提示</strong>
        </button>
        <button class="tool-card undo" @click="showToast('当前版本暂未开放悔棋')">
          <span>↩</span>
          <strong>悔棋</strong>
        </button>
        <button class="tool-card restart" @click="$emit('rematch')">
          <span>🔄</span>
          <strong>重新开始</strong>
        </button>
        <button class="tool-card invite" @click="showToast('邀请对战功能稍后开放')">
          <span>👥</span>
          <strong>邀请对战</strong>
        </button>
      </div>

      <div class="status-panel">
        <strong>{{ gamePhase === 'finished' ? resultText : '对局进行中' }}</strong>
        <span>{{ gamePhase === 'finished' ? resultDetail : `当前手数：第 ${moveCount} 手` }}</span>
      </div>

      <div class="bottom-banner">轻松互动，欢乐同行 · 团队合作 共创精彩</div>
    </template>

    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <transition name="fade">
      <div v-if="gamePhase === 'finished'" class="result-panel">
        <div class="result-content">
          <div class="result-badge" :class="winnerClass">{{ gs.winner === myId ? '胜' : gs.winner === 'draw' ? '和' : '负' }}</div>
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

const boardCanvas = ref(null)
const hoverPos = ref({ x: -1, y: -1 })
const hintMove = ref(null)
const toast = ref('')

const BOARD_SIZE = 15
const CELL_SIZE = 32
const PADDING = 16
const CANVAS_SIZE = (BOARD_SIZE - 1) * CELL_SIZE + PADDING * 2

const board = computed(() => {
  if (!props.gs || !props.gs.board) {
    return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0))
  }
  return props.gs.board
})

const isReady = computed(() => props.gs && props.gs.board && props.gs.players)
const myId = computed(() => props.player?.id || '')

const myIndex = computed(() => {
  if (!props.gs.players || !myId.value) return 0
  const idx = props.gs.players.indexOf(myId.value)
  return idx >= 0 ? idx : 0
})

const myName = computed(() => props.player?.nickname || '我方')
const opponentName = computed(() => {
  const opponentId = props.gs.players?.find((id) => id !== myId.value)
  return props.roomPlayers.find((item) => item.id === opponentId)?.nickname || '对手'
})

const isMyTurn = computed(() => props.gs.currentPlayer === myId.value && props.gs.phase === 'playing')
const gamePhase = computed(() => props.gs.phase || 'waiting')
const moveCount = computed(() => props.gs.moveHistory?.length || 0)
const lastMoveX = computed(() => props.gs.lastMove?.x ?? -1)
const lastMoveY = computed(() => props.gs.lastMove?.y ?? -1)

const turnText = computed(() => {
  if (isMyTurn.value) return `轮到你落子（${myIndex.value === 0 ? '黑棋' : '白棋'}）`
  return `等待 ${opponentName.value} 落子`
})

const winnerClass = computed(() => {
  if (props.gs.winner === myId.value) return 'winner'
  if (props.gs.winner === 'draw') return 'draw'
  return 'loser'
})

const resultText = computed(() => {
  if (!props.gs.winner) return ''
  if (props.gs.winner === 'draw') return '平局'
  return props.gs.winner === myId.value ? '恭喜获胜' : '再接再厉'
})

const resultDetail = computed(() => {
  if (!props.gs.winner) return ''
  if (props.gs.winner === 'draw') return '棋盘已满，双方握手言和。'
  return props.gs.winner === myId.value ? '你率先连成五子，拿下本局。' : `${opponentName.value} 完成五子连珠。`
})

const suggestedMove = computed(() => {
  const center = Math.floor(BOARD_SIZE / 2)
  if (board.value[center][center] === 0) return { x: center, y: center }

  for (let radius = 1; radius < BOARD_SIZE; radius += 1) {
    for (let x = Math.max(0, center - radius); x <= Math.min(BOARD_SIZE - 1, center + radius); x += 1) {
      for (let y = Math.max(0, center - radius); y <= Math.min(BOARD_SIZE - 1, center + radius); y += 1) {
        if (board.value[x][y] === 0) return { x, y }
      }
    }
  }

  return null
})

function showToast(text) {
  toast.value = text
  setTimeout(() => {
    if (toast.value === text) toast.value = ''
  }, 1800)
}

function showSuggestedMove() {
  if (!suggestedMove.value) {
    showToast('暂无可用落点')
    return
  }
  hintMove.value = suggestedMove.value
  drawBoard()
}

function drawBoard() {
  const canvas = boardCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1

  canvas.width = CANVAS_SIZE * dpr
  canvas.height = CANVAS_SIZE * dpr
  canvas.style.width = `${CANVAS_SIZE}px`
  canvas.style.height = `${CANVAS_SIZE}px`
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#f7d99e'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  ctx.strokeStyle = '#9b6a2d'
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.82

  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const pos = PADDING + i * CELL_SIZE
    ctx.beginPath()
    ctx.moveTo(pos, PADDING)
    ctx.lineTo(pos, PADDING + (BOARD_SIZE - 1) * CELL_SIZE)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(PADDING, pos)
    ctx.lineTo(PADDING + (BOARD_SIZE - 1) * CELL_SIZE, pos)
    ctx.stroke()
  }

  ctx.fillStyle = '#744511'
  ;[3, 7, 11].forEach((x) => {
    ;[3, 7, 11].forEach((y) => {
      ctx.beginPath()
      ctx.arc(PADDING + x * CELL_SIZE, PADDING + y * CELL_SIZE, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  })

  ctx.globalAlpha = 1
  for (let x = 0; x < BOARD_SIZE; x += 1) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      if (board.value[x][y] !== 0) drawPiece(ctx, x, y, board.value[x][y])
    }
  }

  if (lastMoveX.value >= 0 && lastMoveY.value >= 0) {
    ctx.fillStyle = '#ff5d5d'
    ctx.beginPath()
    ctx.arc(PADDING + lastMoveX.value * CELL_SIZE, PADDING + lastMoveY.value * CELL_SIZE, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  if (hintMove.value) {
    const cx = PADDING + hintMove.value.x * CELL_SIZE
    const cy = PADDING + hintMove.value.y * CELL_SIZE
    ctx.strokeStyle = '#23a86c'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, 12, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (hoverPos.value.x >= 0 && hoverPos.value.y >= 0 && isMyTurn.value && board.value[hoverPos.value.x][hoverPos.value.y] === 0) {
    ctx.globalAlpha = 0.4
    drawPiece(ctx, hoverPos.value.x, hoverPos.value.y, myIndex.value === 0 ? 1 : 2)
    ctx.globalAlpha = 1
  }
}

function drawPiece(ctx, x, y, playerIndex) {
  const cx = PADDING + x * CELL_SIZE
  const cy = PADDING + y * CELL_SIZE
  const radius = 13
  const gradient = ctx.createRadialGradient(cx - 4, cy - 4, 0, cx, cy, radius)

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)

  if (playerIndex === 1) {
    gradient.addColorStop(0, '#737373')
    gradient.addColorStop(1, '#111111')
  } else {
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(1, '#dcdcdc')
  }

  ctx.fillStyle = gradient
  ctx.fill()

  if (playerIndex === 2) {
    ctx.strokeStyle = '#c7c7c7'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function getCellFromPosition(px, py) {
  const x = Math.round((px - PADDING) / CELL_SIZE)
  const y = Math.round((py - PADDING) / CELL_SIZE)
  if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) return { x, y }
  return null
}

function handleBoardInteraction(px, py) {
  if (!isMyTurn.value) return
  const cell = getCellFromPosition(px, py)
  if (cell && board.value[cell.x][cell.y] === 0) {
    hintMove.value = null
    emit('action', { type: 'place', x: cell.x, y: cell.y })
  }
}

function handleBoardHover(px, py) {
  if (!isMyTurn.value) {
    hideHoverPiece()
    return
  }
  const cell = getCellFromPosition(px, py)
  if (cell && board.value[cell.x][cell.y] === 0) {
    hoverPos.value = cell
  } else {
    hideHoverPiece()
  }
}

function handleCanvasClick(event) {
  const rect = boardCanvas.value.getBoundingClientRect()
  handleBoardInteraction(event.clientX - rect.left, event.clientY - rect.top)
}

function handleCanvasMove(event) {
  const rect = boardCanvas.value.getBoundingClientRect()
  handleBoardHover(event.clientX - rect.left, event.clientY - rect.top)
}

function handleTouchStart(event) {
  if (!event.touches || event.touches.length === 0) return
  const touch = event.touches[0]
  const rect = boardCanvas.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  handleBoardHover(x, y)
  handleBoardInteraction(x, y)
}

function handleTouchMove(event) {
  if (!event.touches || event.touches.length === 0) return
  const touch = event.touches[0]
  const rect = boardCanvas.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  handleBoardHover(x, y)
}

function handleTouchEnd() {
  hideHoverPiece()
}

function hideHoverPiece() {
  hoverPos.value = { x: -1, y: -1 }
}

onMounted(() => {
  nextTick(() => {
    drawBoard()
  })
})

watch([board, lastMoveX, lastMoveY, hoverPos, isMyTurn, myIndex, hintMove], () => {
  drawBoard()
})
</script>

<style scoped>
.gomoku-board {
  min-height: calc(100vh - 88px);
  padding: 8px 0 18px;
  position: relative;
  color: #fff;
}

.gomoku-board::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 28px;
  background:
    linear-gradient(rgba(14, 102, 240, 0.22), rgba(14, 102, 240, 0.22)),
    url('/assets/ui-ref/gomoku.png') center top / cover no-repeat;
  opacity: 0.3;
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
.turn-banner,
.board-frame,
.tool-row,
.status-panel,
.bottom-banner {
  position: relative;
  z-index: 1;
  max-width: 920px;
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
  background: linear-gradient(180deg, rgba(245, 250, 255, 0.96), rgba(223, 237, 255, 0.92));
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
  border: 2px solid rgba(255, 255, 255, 0.8);
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
  color: #5f7cad;
  font-size: 18px;
}

.vs-word {
  font-size: 44px;
  font-weight: 900;
  color: #ffb200;
  text-shadow: 0 4px 10px rgba(195, 113, 12, 0.35);
}

.turn-banner {
  margin-top: 12px;
  min-height: 52px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 900;
  background: linear-gradient(180deg, rgba(244, 252, 255, 0.97), rgba(225, 239, 255, 0.94));
  color: #1f54aa;
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.board-frame {
  margin-top: 12px;
  padding: 18px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(252, 243, 221, 0.97), rgba(247, 228, 184, 0.95));
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

.tool-row {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.tool-card {
  min-height: 110px;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.62);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 12px 20px rgba(8, 72, 182, 0.18);
}

.tool-card span {
  font-size: 34px;
}

.tool-card strong {
  font-size: 26px;
}

.tool-card.hint {
  background: linear-gradient(180deg, #42d0bf, #17a893);
}

.tool-card.undo {
  background: linear-gradient(180deg, #4189ff, #1957de);
}

.tool-card.restart {
  background: linear-gradient(180deg, #ffc954, #f29b0b);
}

.tool-card.invite {
  background: linear-gradient(180deg, #a973ff, #7a4ce1);
}

.status-panel {
  margin-top: 14px;
  border-radius: 20px;
  padding: 16px;
  text-align: center;
  background: linear-gradient(180deg, rgba(247, 251, 255, 0.97), rgba(232, 241, 255, 0.95));
  color: #21467f;
}

.status-panel strong {
  display: block;
  font-size: 32px;
}

.status-panel span {
  display: block;
  margin-top: 6px;
  color: #6887b4;
  font-size: 20px;
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

.result-badge.draw {
  background: linear-gradient(180deg, #63a4ff, #3466eb);
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

@media (max-width: 720px) {
  .versus-panel {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .player-card,
  .player-card.opponent {
    justify-content: center;
  }

  .tool-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bottom-banner,
  .status-panel strong {
    font-size: 20px;
  }

  .player-card strong {
    font-size: 20px;
  }
}

/* Reference-art refresh */
.gomoku-board::before {
  opacity: 0.36;
  filter: saturate(1.08);
}

.versus-panel,
.turn-banner,
.board-frame,
.status-panel {
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

.turn-banner {
  box-shadow: var(--shadow-soft);
}

.board-frame {
  border-radius: 30px;
  padding: 20px;
  background:
    linear-gradient(180deg, rgba(255, 243, 214, 0.98), rgba(247, 224, 177, 0.96));
}

.board-canvas {
  border: 2px solid rgba(172, 108, 36, 0.5);
  box-shadow:
    inset 0 0 0 3px rgba(160, 106, 38, 0.26),
    0 12px 24px rgba(104, 63, 18, 0.16);
}

.tool-card {
  min-height: 118px;
  border-radius: 20px;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.42),
    0 10px 0 rgba(0, 0, 0, 0.1),
    0 16px 24px rgba(8, 72, 182, 0.18);
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
