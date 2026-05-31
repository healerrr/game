<template>
  <div class="ddz-wrapper" :class="{ 'force-landscape': isPortrait }">
    <section class="ddz-board">
      <header class="ddz-info-bar">
        <button class="back-btn" type="button" @click="$emit('back')" aria-label="返回">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="info-item">第 {{ gs.round || 1 }} 局</span>
        <span class="info-sep">|</span>
        <span class="info-item landlord-label">地主: <b>{{ landlordName }}</b></span>
        <span class="info-sep">|</span>
        <span class="info-item farmers-label">农民: <b>{{ farmersLabel }}</b></span>
        <span class="info-sep">|</span>
        <span class="info-item">炸弹 {{ gs.bombCount || 0 }} · 底分 {{ gs.scoreUnit || 50 }}</span>
      </header>

      <div class="canvas-area" ref="canvasWrapRef">
        <canvas ref="canvasRef" class="game-canvas"></canvas>
      </div>

      <div class="bottom-zone" v-if="gs.phase !== 'finished'">
        <div class="my-info">
          <div class="my-avatar" :class="{ landlord: isLandlord(player?.id) }" :style="avatarStyle(player?.id)">
            {{ playerInitial(player?.id) }}
          </div>
          <div class="my-meta">
            <strong>{{ getPlayerName(player?.id) || '我' }}</strong>
            <span>{{ myRoleLabel }} · {{ myHand.length }} 张</span>
          </div>
        </div>

        <div class="hand-stage">
          <div v-if="isBidding" class="action-buttons bidding-actions">
            <button class="btn-pass" type="button" :disabled="!isMyBidTurn" @click="bidLandlord(0)">{{ bidPassLabel }}</button>
            <button
              v-for="score in [1, 2, 3]"
              :key="score"
              class="btn-bid"
              type="button"
              :disabled="!canBidScore(score)"
              @click="bidLandlord(score)"
            >
              {{ score }}分
            </button>
            <div class="timer-circle" :class="{ urgent: countdown <= 5 }">
              <svg viewBox="0 0 60 60" width="42" height="42">
                <circle cx="30" cy="30" r="25" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
                <circle cx="30" cy="30" r="25" fill="none" stroke="#ffd45a" stroke-width="3" stroke-linecap="round" :stroke-dasharray="timerDash" transform="rotate(-90 30 30)"/>
              </svg>
              <span>{{ countdown }}</span>
            </div>
          </div>

          <div v-else class="action-buttons">
            <button class="btn-pass" type="button" :disabled="!canPass" @click="onPass">不出</button>
            <div class="timer-circle" :class="{ urgent: countdown <= 5 }">
              <svg viewBox="0 0 60 60" width="42" height="42">
                <circle cx="30" cy="30" r="25" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
                <circle cx="30" cy="30" r="25" fill="none" stroke="#ffd45a" stroke-width="3" stroke-linecap="round" :stroke-dasharray="timerDash" transform="rotate(-90 30 30)"/>
              </svg>
              <span>{{ countdown }}</span>
            </div>
            <button class="btn-play" type="button" :disabled="!canPlay" @click="playCards">出牌</button>
          </div>

          <div
            class="hand-cards"
            :class="{ dragging: isDraggingHand }"
            ref="handRef"
            @pointerdown="onHandPointerDown"
            @pointermove="onHandPointerMove"
            @pointerup="finishHandDrag"
            @pointercancel="finishHandDrag"
            @lostpointercapture="finishHandDrag"
          >
            <div
              v-for="(card, index) in myHand"
              :key="cardKey(card) + '-' + index"
              class="card-slot"
              :class="{ selected: isSelected(card) }"
              :data-card-index="index"
              :style="{ zIndex: index + 1 }"
            >
              <PlayingCard :card="card" small />
            </div>
            <div v-if="!myHand.length" class="hand-empty">暂无手牌</div>
          </div>

          <div class="hand-utility">
            <div class="pattern-label" :class="{ muted: !selectedPattern }">
              {{ selectedPattern ? patternName(selectedPattern.type) : turnHintText }}
            </div>
            <button class="btn-arrange" type="button" @click="clearSelection">清选</button>
          </div>
        </div>
      </div>

      <div v-else class="result-zone">
        <strong>{{ resultTitle }}</strong>
        <span>{{ resultSubtitle }}</span>
        <div class="result-actions">
          <button class="btn-play" type="button" @click="$emit('rematch')">再来一局</button>
          <button class="btn-pass" type="button" @click="$emit('back')">返回大厅</button>
        </div>
      </div>

      <transition name="fade">
        <div v-if="toast" class="toast">{{ toast }}</div>
      </transition>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PlayingCard from './shared/PlayingCard.vue'
import CanvasRenderer from '../../game/canvas-renderer.js'

const props = defineProps({
  gs: { type: Object, required: true },
  player: { type: Object, default: null },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

const selectedCards = ref(new Set())
const isDraggingHand = ref(false)
const toast = ref('')
const canvasRef = ref(null)
const canvasWrapRef = ref(null)
const handRef = ref(null)
const countdown = ref(30)
const isPortrait = ref(false)

let renderer = null
let rafId = null
let timerInterval = null
let resizeObserver = null

const handDrag = {
  active: false,
  pointerId: null,
  mode: 'add',
  startIndex: -1
}

const SEAT_ORDER = ['south', 'east', 'west']
const RANK_VALUES = { '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14, '2': 16, SJ: 17, BJ: 18 }
const SUIT_ORDER = { diamond: 0, club: 1, heart: 2, spade: 3, joker: 4 }

const rawMyHand = computed(() => props.gs.hands?.[props.player?.id] || [])
const myHand = computed(() => sortHandDesc(rawMyHand.value))
const isBidding = computed(() => props.gs.phase === 'bid')
const isPlaying = computed(() => props.gs.phase === 'play')
const isMyTurn = computed(() => props.gs.currentPlayer === props.player?.id)
const isMyBidTurn = computed(() => isBidding.value && isMyTurn.value)
const seats = computed(() => props.gs.seats || [])

const mySeat = computed(() => {
  const found = seats.value.find((seat) => seat.playerId === props.player?.id)
  return found?.seat || 'south'
})

const relativeSeats = computed(() => {
  const myIdx = Math.max(0, SEAT_ORDER.indexOf(mySeat.value))
  const map = { left: null, right: null, bottom: null }
  seats.value.forEach((seat) => {
    const idx = SEAT_ORDER.indexOf(seat.seat)
    const offset = ((idx - myIdx) + SEAT_ORDER.length) % SEAT_ORDER.length
    if (offset === 0) map.bottom = seat
    else if (offset === 1) map.right = seat
    else if (offset === 2) map.left = seat
  })
  return map
})

const selectedPattern = computed(() => {
  const cards = getSelectedCards()
  if (!cards.length) return null
  return identifyPattern(cards)
})

const canPlay = computed(() => {
  if (!isPlaying.value) return false
  if (!isMyTurn.value) return false
  if (!selectedPattern.value || selectedPattern.value.type === 'invalid') return false
  if (props.gs.lastPattern) return comparePattern(selectedPattern.value, props.gs.lastPattern) > 0
  return true
})

const canPass = computed(() => {
  if (!isPlaying.value) return false
  if (!isMyTurn.value) return false
  return Boolean(props.gs.lastPattern && props.gs.lastLeadPlayer !== props.player?.id)
})

const landlordName = computed(() => getPlayerName(props.gs.landlord) || '待定')
const farmersLabel = computed(() => (props.gs.farmers || []).map(getPlayerName).join('+') || '待定')
const myRoleLabel = computed(() => {
  if (isBidding.value || !props.gs.landlord) return '抢地主'
  return isLandlord(props.player?.id) ? '地主' : '农民'
})
const bidPassLabel = computed(() => Number(props.gs.currentBid || 0) > 0 ? '不抢' : '不叫')
const turnHintText = computed(() => {
  if (isBidding.value) {
    if (isMyBidTurn.value) return Number(props.gs.currentBid || 0) > 0 ? '请选择更高叫分或不抢' : '请选择叫地主分数'
    return `等待 ${getPlayerName(props.gs.currentPlayer)} 抢地主`
  }
  if (!isMyTurn.value) return `等待 ${getPlayerName(props.gs.currentPlayer)}`
  return props.gs.lastPattern ? '请选择可压牌型' : '请选择要出的牌'
})

const resultTitle = computed(() => {
  const won = props.gs.winningPlayers?.includes(props.player?.id)
  return won ? '恭喜获胜' : '本局结束'
})

const resultSubtitle = computed(() => {
  const winner = getPlayerName(props.gs.finalWinner)
  const role = isLandlord(props.gs.finalWinner) ? '地主' : '农民'
  return `${role} ${winner} 率先出完`
})

const timerDash = computed(() => {
  const max = 30
  const c = 2 * Math.PI * 25
  return `${(countdown.value / max) * c} ${c}`
})

function rankPower(rank) {
  return RANK_VALUES[rank] || 0
}

function suitPower(suit) {
  return SUIT_ORDER[suit] ?? 0
}

function sortHandDesc(hand) {
  return [...hand].sort((a, b) => {
    const diff = rankPower(b.rank) - rankPower(a.rank)
    if (diff !== 0) return diff
    return suitPower(b.suit) - suitPower(a.suit)
  })
}

function sortHandAsc(hand) {
  return [...hand].sort((a, b) => {
    const diff = rankPower(a.rank) - rankPower(b.rank)
    if (diff !== 0) return diff
    return suitPower(a.suit) - suitPower(b.suit)
  })
}

function cardKey(card) {
  return card?.id || `${card?.suit}-${card?.rank}`
}

function isSelected(card) {
  return selectedCards.value.has(cardKey(card))
}

function getSelectedCards() {
  const keys = selectedCards.value
  return myHand.value.filter((card) => keys.has(cardKey(card)))
}

function clearSelection() {
  selectedCards.value = new Set()
}

function canBidScore(score) {
  return isMyBidTurn.value && score > Number(props.gs.currentBid || 0)
}

function bidLandlord(score) {
  if (!isMyBidTurn.value) return
  if (score > 0 && !canBidScore(score)) return
  emit('action', score > 0 ? { type: 'bid', score } : { type: 'pass' })
}

function onHandPointerDown(event) {
  if (!isPlaying.value) return
  const index = getHandHitIndex(event)
  if (index < 0) return
  event.preventDefault()
  handRef.value?.setPointerCapture?.(event.pointerId)
  const card = myHand.value[index]
  handDrag.active = true
  handDrag.pointerId = event.pointerId
  handDrag.mode = isSelected(card) ? 'remove' : 'add'
  handDrag.startIndex = index
  isDraggingHand.value = true
  applyDragSelection(index)
}

function onHandPointerMove(event) {
  if (!handDrag.active || handDrag.pointerId !== event.pointerId) return
  const index = getHandHitIndex(event)
  if (index < 0) return
  event.preventDefault()
  applyDragSelection(index)
}

function finishHandDrag(event) {
  if (!handDrag.active) return
  if (event?.pointerId != null && event.pointerId !== handDrag.pointerId) return
  handRef.value?.releasePointerCapture?.(handDrag.pointerId)
  handDrag.active = false
  handDrag.pointerId = null
  handDrag.startIndex = -1
  isDraggingHand.value = false
}

function getHandHitIndex(event) {
  if (typeof document === 'undefined') return -1
  const elements = document.elementsFromPoint(event.clientX, event.clientY)
  const slot = elements.find((el) => el?.classList?.contains('card-slot') && handRef.value?.contains(el))
  return slot ? Number(slot.dataset.cardIndex) : -1
}

function applyDragSelection(index) {
  const from = handDrag.startIndex >= 0 ? Math.min(handDrag.startIndex, index) : index
  const to = handDrag.startIndex >= 0 ? Math.max(handDrag.startIndex, index) : index
  const next = new Set(selectedCards.value)
  for (let i = from; i <= to; i += 1) {
    const key = cardKey(myHand.value[i])
    if (handDrag.mode === 'remove') next.delete(key)
    else next.add(key)
  }
  selectedCards.value = next
}

function playCards() {
  const cards = getSelectedCards()
  if (!cards.length) return
  emit('action', { type: 'play', cards })
  clearSelection()
}

function onPass() {
  emit('action', { type: 'pass' })
  clearSelection()
}

function showToast(text) {
  toast.value = text
  setTimeout(() => {
    if (toast.value === text) toast.value = ''
  }, 1800)
}

function getPlayerName(pid) {
  return (props.roomPlayers || []).find((item) => item.id === pid)?.nickname || (pid ? '玩家' : '')
}

function playerInitial(pid) {
  return (getPlayerName(pid) || '玩').slice(0, 1)
}

function isLandlord(pid) {
  return Boolean(pid && pid === props.gs.landlord)
}

function avatarStyle(pid) {
  if (!pid) return {}
  let hash = 0
  for (const ch of String(pid)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const palette = [['#FFD86B', '#FF9F43'], ['#7EE8FA', '#80FF72'], ['#FBC2EB', '#A18CD1'], ['#84FAB0', '#8FD3F4'], ['#FF9A9E', '#FAD0C4']]
  const [a, b] = palette[hash % palette.length]
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
}

function getCardCount(pid) {
  if (props.gs.handCounts?.[pid] != null) return props.gs.handCounts[pid]
  if (props.gs.hands?.[pid]) return props.gs.hands[pid].length
  return 17
}

function getValueCounts(cards) {
  const map = new Map()
  cards.forEach((card) => {
    const power = rankPower(card.rank)
    const entry = map.get(power) || { power, cards: [] }
    entry.cards.push(card)
    map.set(power, entry)
  })
  return [...map.values()].sort((a, b) => a.power - b.power)
}

function isConsecutive(values) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return false
  }
  return true
}

function canSequence(values, minLength) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length >= minLength &&
    sorted.every((value) => value >= 3 && value <= 14) &&
    new Set(sorted).size === sorted.length &&
    isConsecutive(sorted)
}

function buildPattern(type, cards, mainValue, extras = {}) {
  return { type, cards: [...cards], mainValue, length: cards.length, ...extras }
}

function findTripleSequence(counts, sequenceLength) {
  const values = counts
    .filter((entry) => entry.cards.length >= 3 && entry.power <= 14)
    .map((entry) => entry.power)
    .sort((a, b) => a - b)
  for (let i = 0; i <= values.length - sequenceLength; i += 1) {
    const seq = values.slice(i, i + sequenceLength)
    if (isConsecutive(seq)) return seq
  }
  return null
}

function identifyAirplane(sorted, counts) {
  const size = sorted.length
  if (size >= 6 && size % 3 === 0) {
    const sequenceLength = size / 3
    if (counts.length === sequenceLength && counts.every((entry) => entry.cards.length === 3)) {
      const values = counts.map((entry) => entry.power)
      if (canSequence(values, 2)) return buildPattern('airplane', sorted, values.at(-1), { sequenceLength })
    }
  }
  if (size >= 8 && size % 4 === 0) {
    const sequenceLength = size / 4
    const sequence = findTripleSequence(counts, sequenceLength)
    if (sequence) return buildPattern('airplane_single', sorted, sequence.at(-1), { sequenceLength })
  }
  if (size >= 10 && size % 5 === 0) {
    const sequenceLength = size / 5
    const sequence = findTripleSequence(counts, sequenceLength)
    if (sequence) {
      const tripleSet = new Set(sequence)
      const wings = counts.filter((entry) => !tripleSet.has(entry.power))
      if (wings.length === sequenceLength && wings.every((entry) => entry.cards.length === 2)) {
        return buildPattern('airplane_pair', sorted, sequence.at(-1), { sequenceLength })
      }
    }
  }
  return null
}

function identifyPattern(cards) {
  if (!Array.isArray(cards) || !cards.length) return null
  const sorted = sortHandAsc(cards)
  const counts = getValueCounts(sorted)
  const values = counts.map((entry) => entry.power)
  const size = sorted.length

  if (size === 1) return buildPattern('single', sorted, values[0])
  if (size === 2) {
    if (sorted.every((card) => card.suit === 'joker') && new Set(sorted.map((card) => card.rank)).size === 2) {
      return buildPattern('rocket', sorted, 999)
    }
    if (counts.length === 1) return buildPattern('pair', sorted, values[0])
  }
  if (size === 3 && counts.length === 1) return buildPattern('triple', sorted, values[0])
  if (size === 4) {
    if (counts.length === 1) return buildPattern('bomb', sorted, values[0], { bombSize: 4 })
    const triple = counts.find((entry) => entry.cards.length === 3)
    if (triple) return buildPattern('triple_single', sorted, triple.power)
  }
  if (size === 5) {
    const triple = counts.find((entry) => entry.cards.length === 3)
    const pair = counts.find((entry) => entry.cards.length === 2)
    if (triple && pair) return buildPattern('triple_pair', sorted, triple.power)
  }
  if (size >= 5 && counts.every((entry) => entry.cards.length === 1) && canSequence(values, 5)) {
    return buildPattern('straight', sorted, values.at(-1), { sequenceLength: size })
  }
  if (size >= 6 && size % 2 === 0 && counts.every((entry) => entry.cards.length === 2) && canSequence(values, 3)) {
    return buildPattern('pair_straight', sorted, values.at(-1), { sequenceLength: size / 2 })
  }
  const airplane = identifyAirplane(sorted, counts)
  if (airplane) return airplane
  if (size === 6 && counts.some((entry) => entry.cards.length === 4)) {
    const four = counts.find((entry) => entry.cards.length === 4)
    return buildPattern('four_two_singles', sorted, four.power)
  }
  if (size === 8) {
    const four = counts.find((entry) => entry.cards.length === 4)
    const pairs = counts.filter((entry) => entry.power !== four?.power && entry.cards.length === 2)
    if (four && pairs.length === 2) return buildPattern('four_two_pairs', sorted, four.power)
  }
  return buildPattern('invalid', sorted, 0)
}

function comparePattern(nextPattern, currentPattern) {
  if (!nextPattern || nextPattern.type === 'invalid') return -1
  if (!currentPattern) return 1
  if (nextPattern.type === 'rocket') return currentPattern.type === 'rocket' ? 0 : 1
  if (currentPattern.type === 'rocket') return -1
  if (nextPattern.type === 'bomb' && currentPattern.type !== 'bomb') return 1
  if (currentPattern.type === 'bomb' && nextPattern.type !== 'bomb') return -1
  if (nextPattern.type !== currentPattern.type) return -1
  if (nextPattern.sequenceLength && nextPattern.sequenceLength !== currentPattern.sequenceLength) return -1
  if (nextPattern.length !== currentPattern.length) return -1
  return nextPattern.mainValue - currentPattern.mainValue
}

function patternName(type) {
  const names = {
    single: '单张',
    pair: '对子',
    triple: '三张',
    triple_single: '三带一',
    triple_pair: '三带二',
    straight: '顺子',
    pair_straight: '连对',
    airplane: '飞机',
    airplane_single: '飞机带单',
    airplane_pair: '飞机带对',
    four_two_singles: '四带二',
    four_two_pairs: '四带两对',
    bomb: '炸弹',
    rocket: '王炸',
    invalid: '无效'
  }
  return names[type] || ''
}

function scheduleDraw() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = null
    drawTable()
  })
}

function drawTable() {
  if (!renderer || !canvasRef.value) return
  const W = renderer._logicalWidth
  const H = renderer._logicalHeight
  const ctx = renderer._ctx
  renderer.clear()

  const outerPad = Math.max(8, Math.min(W, H) * 0.025)
  const rail = Math.max(10, Math.min(W, H) * 0.045)
  const tableX = outerPad
  const tableY = outerPad
  const tableW = W - outerPad * 2
  const tableH = H - outerPad * 2
  const feltX = tableX + rail
  const feltY = tableY + rail
  const feltW = tableW - rail * 2
  const feltH = tableH - rail * 2

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#174167')
  bg.addColorStop(1, '#071f31')
  renderer.drawRoundRect(0, 0, W, H, 0, bg)

  const railGrad = ctx.createLinearGradient(tableX, tableY, tableX, tableY + tableH)
  railGrad.addColorStop(0, '#cf7f32')
  railGrad.addColorStop(0.48, '#74380f')
  railGrad.addColorStop(1, '#3f1d09')
  renderer.drawRoundRect(tableX, tableY, tableW, tableH, 18, railGrad, 'rgba(255, 205, 121, 0.36)', 1.5)

  const feltGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.54)
  feltGrad.addColorStop(0, '#1d8a59')
  feltGrad.addColorStop(0.68, '#11653f')
  feltGrad.addColorStop(1, '#07351f')
  renderer.drawRoundRect(feltX, feltY, feltW, feltH, 12, feltGrad, 'rgba(0, 0, 0, 0.45)', 2)

  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, W * 0.28, H * 0.32, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  drawOpponent(relativeSeats.value.left, feltX + 10, H / 2 - 50, 'left')
  drawOpponent(relativeSeats.value.right, W - feltX - 50, H / 2 - 50, 'right')
  drawBottomCards(W / 2, feltY + 58)
  drawCenterPlay(W, H)
}

function drawOpponent(seat, seatX, seatY, side) {
  if (!seat) return
  const pid = seat.playerId
  const hasLandlord = Boolean(props.gs.landlord)
  renderer.drawSeatInfo(seatX, seatY, {
    name: getPlayerName(pid),
    count: getCardCount(pid),
    isCurrentTurn: props.gs.currentPlayer === pid
  })
  drawRoleBadge(seatX + 20, seatY - 8, hasLandlord ? (isLandlord(pid) ? '地主' : '农民') : '抢地主', isLandlord(pid))

  const backW = 26
  const backH = 17
  const gap = 3
  const total = Math.min(getCardCount(pid) || 12, 10)
  const x = side === 'left' ? seatX + 48 : seatX - 30
  for (let i = 0; i < total; i += 1) {
    renderer.drawCardBack(x, seatY - 34 + i * (backH + gap), backW, backH, { horizontal: true })
  }
}

function drawRoleBadge(x, y, text, landlord) {
  const color = landlord ? 'rgba(255, 190, 52, 0.96)' : 'rgba(44, 170, 255, 0.9)'
  const textColor = landlord ? '#442500' : '#ffffff'
  renderer.drawRoundRect(x - 22, y - 10, 44, 20, 10, color, 'rgba(255,255,255,0.72)', 1)
  renderer.drawText(text, x, y + 1, {
    font: 'bold 12px sans-serif',
    color: textColor,
    align: 'center',
    baseline: 'middle'
  })
}

function drawBottomCards(centerX, y) {
  const cards = props.gs.bottomCards || []
  const isHidden = isBidding.value || cards.length === 0
  const cardW = 28
  const cardH = cardW * 1.42
  const gap = 5
  const displayCount = isHidden ? 3 : cards.length
  const totalW = displayCount * (cardW + gap) - gap
  const panelW = Math.max(124, totalW + 34)
  renderer.drawRoundRect(centerX - panelW / 2, y - 24, panelW, cardH + 44, 16, 'rgba(6, 44, 28, 0.32)', 'rgba(255,255,255,0.2)', 1)
  renderer.drawText(isHidden ? '底牌待揭晓' : '地主底牌', centerX, y - 10, {
    font: 'bold 12px sans-serif',
    color: 'rgba(255,255,255,0.9)',
    align: 'center',
    baseline: 'middle'
  })
  const startX = centerX - totalW / 2
  for (let index = 0; index < displayCount; index += 1) {
    const x = startX + index * (cardW + gap)
    if (isHidden) renderer.drawCardBack(x, y + 4, cardW, cardH)
    else renderer._drawCardFace(x, y + 4, cardW, cardH, cards[index])
  }
}

function drawCenterPlay(W, H) {
  if (isBidding.value) {
    const bidder = getPlayerName(props.gs.currentBidder)
    const title = props.gs.currentBid > 0 ? `当前 ${props.gs.currentBid} 分 ${bidder}` : '正在抢地主'
    const subtitle = `${getPlayerName(props.gs.currentPlayer)} 行动`
    const waitY = H * 0.6
    renderer.drawRoundRect(W / 2 - 92, waitY - 30, 184, 60, 18, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.24)', 1)
    renderer.drawText(title, W / 2, waitY - 8, {
      font: 'bold 14px sans-serif',
      color: '#fff8e6',
      align: 'center',
      baseline: 'middle'
    })
    renderer.drawText(subtitle, W / 2, waitY + 14, {
      font: '12px sans-serif',
      color: 'rgba(255,255,255,0.82)',
      align: 'center',
      baseline: 'middle'
    })
    return
  }

  const lastPlay = props.gs.lastPlay
  const lastCards = (lastPlay?.cards || []).slice(0, 16)
  if (lastCards.length) {
    const pattern = identifyPattern(lastCards)
    drawPlayedCardsStrip(W / 2, H * 0.6, lastCards, {
      title: `${getPlayerName(lastPlay.playerId)} 出牌`,
      label: patternName(pattern?.type)
    })
    return
  }

  const txt = props.gs.phase === 'play' ? '等待出牌' : '本局结束'
  const waitY = H * 0.6
  renderer.drawRoundRect(W / 2 - 62, waitY - 18, 124, 36, 18, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.24)', 1)
  renderer.drawText(txt, W / 2, waitY, {
    font: 'bold 13px sans-serif',
    color: '#fff8e6',
    align: 'center',
    baseline: 'middle'
  })
}

function drawPlayedCardsStrip(centerX, centerY, cards, options = {}) {
  const W = renderer._logicalWidth
  const gap = Math.max(2, Math.min(5, W * 0.004))
  const maxCardsW = W * 0.6 - 28
  const cardW = Math.max(22, Math.min(38, (maxCardsW - gap * Math.max(cards.length - 1, 0)) / Math.max(cards.length, 1)))
  const cardH = cardW * 1.42
  const totalCardsW = cards.length * (cardW + gap) - gap
  const panelW = Math.min(W * 0.6, Math.max(totalCardsW + 28, 150))
  const panelH = cardH + 58
  const panelX = centerX - panelW / 2
  const panelY = centerY - panelH / 2
  const startX = centerX - totalCardsW / 2
  const cardY = panelY + 25

  renderer.drawRoundRect(panelX, panelY, panelW, panelH, 18, 'rgba(4, 39, 24, 0.34)', 'rgba(255,255,255,0.2)', 1)
  renderer.drawText(options.title || '出牌', centerX, panelY + 10, {
    font: 'bold 12px sans-serif',
    color: 'rgba(255,255,255,0.9)',
    align: 'center',
    baseline: 'middle'
  })
  cards.forEach((card, index) => {
    renderer._drawCardFace(startX + index * (cardW + gap), cardY, cardW, cardH, card)
  })
  if (options.label) {
    const labelW = Math.max(58, options.label.length * 13 + 22)
    const labelY = cardY + cardH + 10
    renderer.drawRoundRect(centerX - labelW / 2, labelY - 10, labelW, 22, 11, 'rgba(255, 190, 52, 0.92)')
    renderer.drawText(options.label, centerX, labelY + 1, {
      font: 'bold 12px sans-serif',
      color: '#4a2900',
      align: 'center',
      baseline: 'middle'
    })
  }
}

function sizeCanvas() {
  if (!canvasRef.value || !canvasWrapRef.value) return
  const w = canvasWrapRef.value.clientWidth || 800
  const h = canvasWrapRef.value.clientHeight || 300
  if (!renderer) renderer = new CanvasRenderer(canvasRef.value, { width: w, height: h })
  else renderer.resize(w, h)
  scheduleDraw()
}

function resetCountdown() {
  countdown.value = 30
}

function startTimer() {
  stopTimer()
  resetCountdown()
  timerInterval = setInterval(() => {
    if (countdown.value > 0) countdown.value -= 1
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function checkOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth && window.innerWidth < 768
}

onMounted(async () => {
  await nextTick()
  sizeCanvas()
  startTimer()
  if (window.ResizeObserver && canvasWrapRef.value) {
    resizeObserver = new ResizeObserver(() => sizeCanvas())
    resizeObserver.observe(canvasWrapRef.value)
  } else {
    window.addEventListener('resize', sizeCanvas)
  }
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {})
    }
  } catch (e) { /* ignore */ }
})

onBeforeUnmount(() => {
  stopTimer()
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeObserver) resizeObserver.disconnect()
  else window.removeEventListener('resize', sizeCanvas)
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
  try {
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock()
    }
  } catch (e) { /* ignore */ }
})

watch(() => props.gs, () => {
  scheduleDraw()
}, { deep: true })

watch(() => rawMyHand.value.map(cardKey).sort().join('|'), () => {
  const liveKeys = new Set(rawMyHand.value.map(cardKey))
  selectedCards.value = new Set([...selectedCards.value].filter((key) => liveKeys.has(key)))
})

watch(() => props.gs?.currentPlayer, () => {
  resetCountdown()
  clearSelection()
})
</script>

<style scoped>
.ddz-wrapper {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.ddz-wrapper.force-landscape {
  position: fixed;
  top: 0;
  left: 100vw;
  width: 100vh;
  height: 100vw;
  transform: rotate(90deg);
  transform-origin: top left;
  overflow: hidden;
  z-index: 100;
}

.ddz-board {
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 50% -12%, rgba(255, 211, 93, 0.16), transparent 28%),
    linear-gradient(180deg, #174167 0%, #071f31 100%);
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #fff;
}

.ddz-info-bar {
  flex: 0 0 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: linear-gradient(180deg, rgba(20, 70, 105, 0.98), rgba(8, 42, 65, 0.98));
  border-bottom: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 8px 18px rgba(0,0,0,0.22);
  font-size: 13px;
  z-index: 10;
  overflow: hidden;
}

.back-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.14);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.info-item {
  color: rgba(255,255,255,0.88);
  font-weight: 800;
  white-space: nowrap;
}

.info-item b {
  color: #ffdc45;
}

.farmers-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-sep {
  color: rgba(255,255,255,0.3);
}

.canvas-area {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  margin: 6px 8px 0;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 214, 114, 0.28);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.08),
    0 14px 28px rgba(0,0,0,0.28);
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.bottom-zone {
  flex: 0 0 clamp(146px, 32vh, 166px);
  min-height: 146px;
  max-height: 166px;
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  align-items: stretch;
  gap: 8px;
  margin: 6px 8px 6px;
  padding: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(13, 58, 42, 0.98), rgba(7, 36, 29, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 14px 28px rgba(0,0,0,0.22);
}

.my-info {
  min-width: 0;
  border-radius: 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.09);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 7px;
  padding: 6px 4px;
}

.my-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.78);
  display: grid;
  place-items: center;
  color: #083018;
  font-size: 15px;
  font-weight: 900;
}

.my-avatar.landlord {
  box-shadow: 0 0 0 3px rgba(255, 210, 77, 0.28), 0 0 14px rgba(255, 210, 77, 0.38);
}

.my-meta {
  min-width: 0;
  text-align: center;
}

.my-meta strong {
  display: block;
  max-width: 62px;
  color: #fff;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-meta span {
  display: block;
  margin-top: 3px;
  color: #87e6ae;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.hand-stage {
  min-width: 0;
  display: grid;
  grid-template-rows: 38px minmax(70px, 1fr) 28px;
  gap: 4px;
  overflow: visible;
}

.action-buttons {
  width: min(720px, 100%);
  justify-self: center;
  display: grid;
  grid-template-columns: minmax(92px, 0.9fr) 42px minmax(110px, 1fr);
  align-items: center;
  gap: 7px;
}

.bidding-actions {
  grid-template-columns: minmax(72px, 0.8fr) repeat(3, minmax(64px, 0.8fr)) 42px;
}

.action-buttons button,
.result-actions button {
  height: 38px;
  min-height: 38px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  text-shadow: 0 1px 0 rgba(0,0,0,0.28);
}

.action-buttons button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  filter: grayscale(0.15);
}

.btn-pass {
  background: linear-gradient(180deg, #ffc26a, #e77b1a);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,0.35),
    0 8px 16px rgba(193, 91, 10, 0.34);
}

.btn-bid {
  background: linear-gradient(180deg, #ffdf78, #d99313);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,0.35),
    0 8px 16px rgba(190, 124, 12, 0.34);
}

.btn-play {
  background: linear-gradient(180deg, #6fd98d, #18a750);
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,0.3),
    0 8px 16px rgba(24, 167, 80, 0.3);
}

.timer-circle {
  position: relative;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
}

.timer-circle svg {
  width: 38px;
  height: 38px;
}

.timer-circle span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ffd45a;
  font-size: 13px;
  font-weight: 900;
}

.timer-circle.urgent span {
  color: #ff7575;
}

.hand-cards {
  --card-overlap: clamp(-30px, -3.2vw, -18px);
  --card-w: clamp(38px, 4.35vw, 48px);
  --card-h: clamp(54px, 6.18vw, 68px);
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  overflow-x: auto;
  overflow-y: visible;
  touch-action: none;
  cursor: grab;
  overscroll-behavior: contain;
  padding: 10px 90px 2px 4px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035));
  border: 1px solid rgba(255,255,255,0.08);
  scrollbar-width: none;
}

.hand-cards::-webkit-scrollbar {
  display: none;
}

.hand-cards.dragging {
  cursor: grabbing;
}

.card-slot {
  flex: 0 0 auto;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.14s ease, filter 0.14s ease;
  filter: drop-shadow(0 9px 10px rgba(0,0,0,0.18));
}

.card-slot + .card-slot {
  margin-left: var(--card-overlap);
}

.card-slot.selected {
  transform: translateY(-12px);
  z-index: 80 !important;
}

.card-slot.selected::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 5px;
  border-radius: 999px;
  background: #ffcc3d;
  box-shadow: 0 0 12px rgba(255, 204, 61, 0.8);
  pointer-events: none;
}

.card-slot :deep(.playing-card) {
  width: var(--card-w);
  height: var(--card-h);
  border-radius: 8px;
}

.hand-empty {
  width: 100%;
  text-align: center;
  color: #9bd8b3;
  font-size: 13px;
  padding: 20px 0;
}

.hand-utility {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 74px;
  align-items: center;
  gap: 6px;
}

.pattern-label {
  min-height: 26px;
  display: grid;
  place-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  color: #ffe28a;
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,226,138,0.22);
  font-size: 12px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pattern-label.muted {
  color: rgba(255,255,255,0.64);
  border-color: rgba(255,255,255,0.12);
}

.btn-arrange {
  height: 28px;
  border: 0;
  border-radius: 999px;
  color: #073719;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  background: linear-gradient(180deg, #72f296, #21c35d);
}

.result-zone {
  flex: 1;
  margin: 8px 10px 10px;
  border-radius: 20px;
  background: rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
}

.result-zone strong {
  font-size: 20px;
  color: #ffd45a;
}

.result-zone span {
  color: #c1ead0;
  font-size: 13px;
}

.result-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.result-actions button {
  min-width: 104px;
  padding: 0 16px;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 60px;
  transform: translateX(-50%);
  z-index: 100;
  padding: 8px 16px;
  border-radius: 16px;
  background: rgba(0,0,0,0.8);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (min-width: 900px) {
  .hand-cards {
    justify-content: center;
  }
}

@media (max-height: 500px) {
  .ddz-info-bar {
    flex-basis: 36px;
    min-height: 36px;
  }

  .canvas-area {
    margin: 4px 6px 0;
  }

  .bottom-zone {
    flex-basis: 136px;
    min-height: 136px;
    max-height: 136px;
    grid-template-columns: 62px minmax(0, 1fr);
    margin: 5px 6px;
    padding: 7px;
  }

  .my-avatar {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .hand-stage {
    grid-template-rows: 34px minmax(66px, 1fr) 24px;
    gap: 3px;
  }

  .action-buttons {
    grid-template-columns: minmax(70px, 0.9fr) 36px minmax(86px, 1fr);
    gap: 5px;
  }

  .bidding-actions {
    grid-template-columns: minmax(58px, 0.8fr) repeat(3, minmax(48px, 0.8fr)) 36px;
  }

  .action-buttons button {
    height: 34px;
    min-height: 34px;
    font-size: 14px;
  }

  .timer-circle,
  .timer-circle svg {
    width: 34px;
    height: 34px;
  }

  .hand-cards {
    padding-top: 7px;
    padding-right: 76px;
  }

  .hand-utility {
    grid-template-columns: minmax(0, 1fr) 64px;
  }

  .pattern-label {
    min-height: 23px;
    font-size: 11px;
  }

  .btn-arrange {
    height: 24px;
    font-size: 12px;
  }
}
</style>
