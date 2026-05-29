<template>
  <section class="gomoku-board">
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>正在同步五子棋棋局...</p>
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
            {{ gamePhase === 'finished' ? resultText : turnText }}
          </div>
          <div class="battle-meta__score">
            <span>手数 {{ moveCount }}</span>
            <span>{{ gamePhase === 'finished' ? resultDetail : `对手 ${opponentName}` }}</span>
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
          <span class="mode-chip">{{ myPieceName }}</span>
          <span class="mode-chip soft">{{ boardAssistLabel }}</span>
        </div>

        <div class="board-shell">
          <div class="board-surface">
            <div class="board-playarea" @pointerdown="handleBoardPointer">
              <button
                v-for="cell in cells"
                :key="`${cell.x}-${cell.y}`"
                type="button"
                class="intersection"
                :class="{ disabled: !canPlace(cell), pending: isPendingCell(cell) }"
                :style="pointStyle(cell)"
                :disabled="!canPlace(cell)"
              >
                <span v-if="cell.value === 0 && isStarCell(cell)" class="star-dot"></span>
                <span v-if="isPendingCell(cell)" class="pending-piece" :class="myPiece === 1 ? 'black' : 'white'"></span>
                <span v-if="cell.value !== 0" class="piece" :class="cell.value === 1 ? 'black' : 'white'"></span>
                <span v-if="isLastMoveCell(cell)" class="last-dot"></span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="action-grid">
        <button type="button" class="action-btn surrender" :disabled="gamePhase === 'finished'" @click="$emit('forfeit')">
          <span class="action-btn__icon">认</span>
          <span class="action-btn__copy">
            <strong>认输</strong>
            <small>结束本局</small>
          </span>
        </button>

        <button type="button" class="action-btn back" @click="$emit('back')">
          <span class="action-btn__icon">返</span>
          <span class="action-btn__copy">
            <strong>返回大厅</strong>
            <small>离开对局</small>
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
            {{ props.gs.winner === myId ? '胜' : props.gs.winner === 'draw' ? '和' : '负' }}
          </div>
          <h2>{{ resultText }}</h2>
          <p>{{ resultDetail }}</p>
          <div class="result-actions">
            <button type="button" class="secondary-btn" @click="$emit('back')">返回大厅</button>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'back', 'forfeit'])

const BOARD_SIZE = 15
const STAR_POINTS = new Set(['3,3', '3,7', '3,11', '7,3', '7,7', '7,11', '11,3', '11,7', '11,11'])
const toast = ref('')
const pendingCell = ref(null)

let toastTimer = null

const emptyBoard = () => Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))

const board = computed(() => {
  return props.gs?.board?.length ? props.gs.board : emptyBoard()
})

const isReady = computed(() => Boolean(props.gs?.board && props.gs?.players?.length))
const myId = computed(() => props.player?.id || '')

const myIndex = computed(() => {
  const players = props.gs?.players || []
  const idx = players.indexOf(myId.value)
  return idx >= 0 ? idx : 0
})

const myPiece = computed(() => (myIndex.value === 0 ? 1 : 2))
const myPieceName = computed(() => (myPiece.value === 1 ? '我方 · 黑棋' : '我方 · 白棋'))
const mySideLabel = computed(() => myPieceName.value)
const opponentSideLabel = computed(() => (myPiece.value === 1 ? '对手 · 白棋' : '对手 · 黑棋'))

const myName = computed(() => props.player?.nickname || '我方')
const opponentName = computed(() => {
  const opponentId = props.gs?.players?.find((id) => id !== myId.value)
  return props.roomPlayers.find((item) => item.id === opponentId)?.nickname || '对手'
})

const isMyTurn = computed(() => props.gs?.phase === 'playing' && props.gs?.currentPlayer === myId.value)
const gamePhase = computed(() => props.gs?.phase || 'waiting')
const moveCount = computed(() => props.gs?.moveHistory?.length || 0)
const lastMove = computed(() => props.gs?.lastMove || null)

const turnText = computed(() => {
  return isMyTurn.value ? '轮到你落子' : `等待 ${opponentName.value}`
})

const winnerClass = computed(() => {
  if (props.gs?.winner === myId.value) return 'winner'
  if (props.gs?.winner === 'draw') return 'draw'
  return 'loser'
})

const resultText = computed(() => {
  if (!props.gs?.winner) return ''
  if (props.gs.winner === 'draw') return '平局'
  return props.gs.winner === myId.value ? '恭喜获胜' : '再接再厉'
})

const resultDetail = computed(() => {
  if (!props.gs?.winner) return ''
  if (props.gs.winner === 'draw') return '棋盘已满，双方握手言和。'
  return props.gs.winner === myId.value ? '你率先连成五子，拿下本局。' : `${opponentName.value} 完成了五子连珠。`
})

const boardAssistLabel = computed(() => {
  if (pendingCell.value) return `待落 ${toCoord(pendingCell.value.x, pendingCell.value.y)} · 再点确认`
  return '轻点预览，再点确认'
})

const cells = computed(() => {
  const list = []
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      list.push({
        x,
        y,
        value: cellValue(x, y)
      })
    }
  }
  return list
})

onBeforeUnmount(() => {
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
})

watch(
  () => [props.gs?.currentPlayer, moveCount.value, props.gs?.phase],
  () => {
    if (!pendingCell.value) return
    if (!isMyTurn.value || cellValue(pendingCell.value.x, pendingCell.value.y) !== 0) {
      pendingCell.value = null
    }
  }
)

function toCoord(x, y) {
  return `${String.fromCharCode(65 + x)}${y + 1}`
}

function pointStyle(cell) {
  return {
    left: `${(cell.x / (BOARD_SIZE - 1)) * 100}%`,
    top: `${(cell.y / (BOARD_SIZE - 1)) * 100}%`
  }
}

function cellValue(x, y) {
  return board.value?.[x]?.[y] ?? 0
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function canPlace(cell) {
  if (!isMyTurn.value) return false
  return cellValue(cell.x, cell.y) === 0
}

function placeAt(cell) {
  if (!canPlace(cell)) {
    if (isMyTurn.value) showToast('这里已有棋子')
    return
  }

  if (!pendingCell.value || pendingCell.value.x !== cell.x || pendingCell.value.y !== cell.y) {
    pendingCell.value = { x: cell.x, y: cell.y }
    showToast(`已选 ${toCoord(cell.x, cell.y)}，再次点击确认`)
    return
  }

  confirmPendingMove()
}

function confirmPendingMove() {
  if (!pendingCell.value) return
  const cell = { ...pendingCell.value }
  if (!canPlace(cell)) {
    pendingCell.value = null
    return
  }

  pendingCell.value = null
  emit('action', { type: 'place', x: cell.x, y: cell.y })
}

function handleBoardPointer(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (!isMyTurn.value) {
    showToast(`等待 ${opponentName.value} 落子`)
    return
  }

  const rect = event.currentTarget.getBoundingClientRect()
  const x = clamp(Math.round(((event.clientX - rect.left) / rect.width) * (BOARD_SIZE - 1)), 0, BOARD_SIZE - 1)
  const y = clamp(Math.round(((event.clientY - rect.top) / rect.height) * (BOARD_SIZE - 1)), 0, BOARD_SIZE - 1)
  placeAt({ x, y, value: cellValue(x, y) })
}

function isLastMoveCell(cell) {
  if (!lastMove.value) return false
  return lastMove.value.x === cell.x && lastMove.value.y === cell.y
}

function isPendingCell(cell) {
  if (!pendingCell.value) return false
  return pendingCell.value.x === cell.x && pendingCell.value.y === cell.y
}

function isStarCell(cell) {
  return STAR_POINTS.has(`${cell.x},${cell.y}`)
}

function showToast(text) {
  toast.value = text
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
  toastTimer = setTimeout(() => {
    if (toast.value === text) {
      toast.value = ''
    }
  }, 1800)
}

</script>

<style scoped>
.gomoku-board {
  width: min(100%, 430px);
  margin: 0 auto;
  padding: 0 0 12px;
  display: grid;
  gap: 10px;
  color: #fff;
}

.loading {
  min-height: 58vh;
  display: grid;
  place-items: center;
  gap: 14px;
}

.loading-spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.18);
  border-top-color: #ffd34d;
  animation: spin 0.9s linear infinite;
}

.battle-card,
.board-card,
.action-grid {
  position: relative;
  z-index: 1;
}

.battle-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(236, 245, 255, 0.96));
  color: #17305f;
  box-shadow: 0 14px 28px rgba(38, 82, 180, 0.14);
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
  color: #6781b8;
  font-size: 12px;
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
  color: #ffffff;
}

.battle-meta__score {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 12px;
  color: #6b82b3;
}

.battle-meta__score span {
  min-height: auto;
  padding: 0;
  border-radius: 0;
  background: transparent;
  display: inline;
  font-size: inherit;
  font-weight: 400;
}

.board-card {
  padding: 10px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(242, 248, 255, 0.95));
  box-shadow: 0 14px 26px rgba(8, 63, 162, 0.14);
}

.board-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.mode-chip {
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, #2f8fff, #0f62ef);
  color: #fff;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
}

.mode-chip.soft {
  background: #edf5ff;
  color: #1b5fd9;
}

.board-shell {
  padding: 12px;
  border-radius: 20px;
  background: linear-gradient(180deg, #f9dfab, #f2c679);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.board-surface {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: 16px;
  background: linear-gradient(180deg, #f6dda7, #efcc88);
  overflow: hidden;
}

.board-playarea {
  --grid-pad: 3%;
  position: absolute;
  inset: var(--grid-pad);
  overflow: visible;
  background:
    linear-gradient(to right, rgba(139, 103, 42, 0.72) 0 1px, transparent 1px) 0 0 / calc(100% / 14) 100% repeat-x,
    linear-gradient(to bottom, rgba(139, 103, 42, 0.72) 0 1px, transparent 1px) 0 0 / 100% calc(100% / 14) repeat-y;
  border: 1px solid rgba(139, 103, 42, 0.72);
  cursor: pointer;
  touch-action: manipulation;
}

.intersection {
  position: absolute;
  width: 12%;
  height: 12%;
  padding: 0;
  border: none;
  background: transparent;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.intersection:not(.disabled) {
  cursor: pointer;
}

.intersection.disabled {
  cursor: default;
}

.piece,
.star-dot,
.pending-piece,
.last-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.piece {
  width: 60%;
  height: 60%;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.piece.black {
  background: radial-gradient(circle at 30% 30%, #666, #1a1a1a 72%);
}

.piece.white {
  background: radial-gradient(circle at 30% 30%, #ffffff, #dadada 72%);
  border: 1px solid rgba(168, 168, 168, 0.9);
}

.pending-piece {
  width: 62%;
  height: 62%;
  border-radius: 50%;
  opacity: 0.48;
  box-shadow:
    0 0 0 3px rgba(31, 107, 255, 0.26),
    0 4px 10px rgba(8, 58, 140, 0.2);
}

.pending-piece.black {
  background: radial-gradient(circle at 30% 30%, #666, #1a1a1a 72%);
}

.pending-piece.white {
  background: radial-gradient(circle at 30% 30%, #ffffff, #dadada 72%);
  border: 1px solid rgba(168, 168, 168, 0.9);
}

.star-dot {
  width: 16%;
  height: 16%;
  border-radius: 50%;
  background: #784913;
}

.last-dot {
  width: 18%;
  height: 18%;
  border-radius: 50%;
  background: #ff5d5d;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.action-btn {
  min-height: 62px;
  padding: 10px 12px;
  border: none;
  border-radius: 18px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  text-align: left;
  color: #fff;
  box-shadow: 0 10px 18px rgba(8, 72, 182, 0.16);
}

.action-btn__icon {
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
}

.action-btn__copy strong,
.action-btn__copy small {
  display: block;
}

.action-btn__copy strong {
  font-size: 14px;
  line-height: 1.15;
  font-weight: 800;
}

.action-btn__copy small {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.2;
  opacity: 0.88;
}

.action-btn.surrender {
  background: linear-gradient(180deg, #ff6f61, #de3d37);
}

.action-btn.back {
  background: linear-gradient(180deg, #a973ff, #7a4ce1);
}

.action-btn:disabled {
  opacity: 0.54;
  cursor: not-allowed;
  filter: grayscale(0.15);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 12;
  background: rgba(18, 84, 206, 0.96);
  color: #fff;
  padding: 12px 18px;
  border-radius: 999px;
  font-size: 14px;
  box-shadow: 0 10px 24px rgba(8, 56, 148, 0.35);
  white-space: nowrap;
}

.result-panel {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(7, 24, 60, 0.58);
  display: grid;
  place-items: center;
  padding: 16px;
}

.result-card {
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

.result-card h2 {
  margin: 0;
  font-size: 28px;
}

.result-card p {
  margin: 8px 0 0;
  color: #5d7baa;
  line-height: 1.45;
}

.result-actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.secondary-btn {
  min-height: 46px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 800;
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

@media (max-width: 380px) {
  .battle-card {
    padding: 10px;
  }

  .board-card {
    padding: 8px;
  }

  .board-shell {
    padding: 10px;
  }

  .player-mini__copy strong {
    font-size: 15px;
  }

  .battle-meta__turn {
    font-size: 17px;
  }

  .action-btn {
    min-height: 58px;
    padding: 9px 10px;
  }

  .toast {
    max-width: calc(100vw - 24px);
    white-space: normal;
    text-align: center;
  }
}
</style>
