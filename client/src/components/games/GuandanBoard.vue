<template>
  <section class="gd-board">
    <!-- 顶部信息栏 -->
    <header class="gd-info-bar">
      <button class="back-btn" @click="$emit('back')" aria-label="返回">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span class="info-item">第 {{ gs.round || 1 }} 局</span>
      <span class="info-sep">|</span>
      <span class="info-item">级牌: <b>{{ gs.level || '2' }}</b></span>
      <span class="info-sep">|</span>
      <span class="info-item team-vs">
        <em class="team-mine-label">{{ myTeamLabel }}</em>
        <span class="vs">VS</span>
        <em class="team-opp-label">{{ oppTeamLabel }}</em>
      </span>
      <span class="info-sep">|</span>
      <span class="info-item">得分: <b>{{ headerScore }}</b></span>
    </header>

    <!-- 中间Canvas牌桌区 -->
    <div class="canvas-area" ref="canvasWrapRef">
      <canvas ref="canvasRef" class="game-canvas"></canvas>
    </div>

    <!-- 底部手牌+操作区 -->
    <div class="bottom-zone" v-if="gs.phase === 'play'">
      <!-- 左侧我方信息 -->
      <div class="my-info">
        <div class="my-avatar" :style="avatarStyle(props.player?.id)">{{ playerInitial(props.player?.id) }}</div>
        <div class="my-meta">
          <strong>{{ getPlayerName(props.player?.id) || '我' }}</strong>
          <span>{{ myHand.length }}张</span>
        </div>
        <div v-if="selectedPattern" class="pattern-label">{{ patternName(selectedPattern.type) }}</div>
      </div>

      <!-- 中间分组手牌 -->
      <div class="hand-groups" ref="handRef">
        <div v-for="(group, gi) in groupedHand" :key="gi" class="card-group"
             :style="{ height: (80 + (group.length - 1) * 25) + 'px' }">
          <div v-for="(card, ci) in group" :key="cardKey(card) + '-' + ci"
               class="card-slot"
               :class="{ selected: isSelected(card), wild: isWildCard(card) }"
               :style="{ top: ci * 25 + 'px' }"
               @click="toggleSelect(card)">
            <PlayingCard :card="card" />
            <span v-if="isWildCard(card)" class="wild-star">&#9733;</span>
          </div>
        </div>
        <div v-if="!myHand.length" class="hand-empty">暂无手牌</div>
      </div>

      <!-- 右侧操作按钮 -->
      <div class="action-buttons">
        <button class="btn-pass" :disabled="!canPass" @click="onPass">不出</button>
        <button class="btn-hint" @click="nextHint">
          提示
          <span v-if="hints.length" class="badge">{{ hints.length }}</span>
        </button>
        <button class="btn-play" :disabled="!canPlay" @click="playCards">出牌</button>
        <div class="timer-circle" :class="{ urgent: countdown <= 5 }">
          <svg viewBox="0 0 60 60" width="50" height="50">
            <circle cx="30" cy="30" r="26" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
            <circle cx="30" cy="30" r="26" fill="none"
              stroke="#4FACFE" stroke-width="3" stroke-linecap="round"
              :stroke-dasharray="timerDash" transform="rotate(-90 30 30)"/>
          </svg>
          <span class="timer-num">{{ countdown }}</span>
        </div>
      </div>
    </div>

    <!-- 结算区 -->
    <div v-if="gs.phase !== 'play'" class="result-zone">
      <strong>{{ gs.finalWinner === props.player?.id ? '恭喜！我方率先出完' : `${getPlayerName(gs.finalWinner)} 率先出完` }}</strong>
      <span v-if="gs.settlement">升级 +{{ gs.settlement.levelUp }} · 下局级牌 {{ gs.settlement.nextLevel }}</span>
      <div class="result-actions">
        <button class="btn-play" @click="$emit('rematch')">再来一局</button>
        <button class="btn-pass" @click="$emit('back')">返回大厅</button>
      </div>
    </div>

    <!-- Toast -->
    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import PlayingCard from './shared/PlayingCard.vue'
import CanvasRenderer from '../../game/canvas-renderer.js'

const props = defineProps({
  gs: { type: Object, required: true },
  player: { type: Object, default: null },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

// --- Refs ---
const selectedCards = ref(new Set())
const toast = ref('')
const canvasRef = ref(null)
const canvasWrapRef = ref(null)
const handRef = ref(null)
const countdown = ref(30)
const hintIndex = ref(-1)

let renderer = null
let rafId = null
let timerInterval = null
let resizeObserver = null

// --- Constants ---
const SEAT_ORDER = ['south', 'east', 'north', 'west']
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'SJ': 16, 'BJ': 17 }

// --- Computed ---
const currentLevel = computed(() => props.gs.level || '2')

const myHand = computed(() => {
  const hand = props.gs.hands?.[props.player?.id] || []
  return sortHand(hand, currentLevel.value)
})

const groupedHand = computed(() => {
  const hand = myHand.value
  const groups = []
  let currentGroup = []
  for (const card of hand) {
    if (currentGroup.length === 0 || sameRankGroup(currentGroup[0], card)) {
      currentGroup.push(card)
    } else {
      groups.push(currentGroup)
      currentGroup = [card]
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)
  return groups
})

const hints = computed(() => props.gs.currentHints || [])

const selectedPattern = computed(() => {
  const cards = getSelectedCards()
  if (cards.length === 0) return null
  return identifyPattern(cards, currentLevel.value)
})

const canPlay = computed(() => {
  if (!isMyTurn.value) return false
  if (!selectedPattern.value) return false
  if (selectedPattern.value.type === 'invalid') return false
  if (props.gs.lastPattern) {
    return comparePattern(selectedPattern.value, props.gs.lastPattern) > 0
  }
  return true
})

const canPass = computed(() => {
  if (!isMyTurn.value) return false
  return !!props.gs.lastPattern && props.gs.lastLeadPlayer !== props.player?.id
})

const isMyTurn = computed(() => props.gs.currentPlayer === props.player?.id)

const seats = computed(() => props.gs.seats || [])

const mySeat = computed(() => {
  const found = seats.value.find(s => s.playerId === props.player?.id)
  return found?.seat || 'south'
})

const relativeSeats = computed(() => {
  const myIdx = SEAT_ORDER.indexOf(mySeat.value)
  const map = { top: null, left: null, right: null, bottom: null }
  seats.value.forEach(s => {
    const idx = SEAT_ORDER.indexOf(s.seat)
    const offset = ((idx - myIdx) + 4) % 4
    if (offset === 0) map.bottom = s
    else if (offset === 1) map.right = s
    else if (offset === 2) map.top = s
    else if (offset === 3) map.left = s
  })
  return map
})

const myTeamPlayers = computed(() => {
  const myId = props.player?.id
  if (props.gs.teams?.south_north?.includes(myId)) return props.gs.teams.south_north
  if (props.gs.teams?.east_west?.includes(myId)) return props.gs.teams.east_west
  return props.gs.teams?.south_north || []
})

const opponentTeamPlayers = computed(() => {
  const mySet = new Set(myTeamPlayers.value)
  return (props.gs.players || []).filter(pid => !mySet.has(pid))
})

const myTeamLabel = computed(() => myTeamPlayers.value.map(p => getPlayerName(p)).join('+') || '我方')
const oppTeamLabel = computed(() => opponentTeamPlayers.value.map(p => getPlayerName(p)).join('+') || '对方')

const headerScore = computed(() => {
  const teamKey = mySideTeamKey()
  const s = props.gs.scores?.[teamKey]
  if (typeof s === 'number') return s
  return 0
})

const timerDash = computed(() => {
  const max = 30
  const c = 2 * Math.PI * 26
  return `${(countdown.value / max) * c} ${c}`
})

// --- Functions ---
function rankPower(rank, level) {
  if (rank === 'SJ') return 16
  if (rank === 'BJ') return 17
  if (rank === level) return 15
  return RANK_VALUES[rank] || 0
}

function sortHand(hand, level) {
  return [...hand].sort((a, b) => {
    const pa = rankPower(a.rank, level)
    const pb = rankPower(b.rank, level)
    if (pa !== pb) return pb - pa // 从大到小
    return a.suit.localeCompare(b.suit)
  })
}

function sameRankGroup(a, b) {
  return a.rank === b.rank
}

function cardKey(card) {
  if (card.id) return card.id
  return `${card.suit}-${card.rank}`
}

function cardUniqueKey(card) {
  return card.id || `${card.suit}-${card.rank}-${Math.random().toString(36).slice(2, 6)}`
}

function isWildCard(card) {
  return card.suit === 'heart' && card.rank === currentLevel.value
}

function isSelected(card) {
  return selectedCards.value.has(cardKey(card))
}

function toggleSelect(card) {
  const key = cardKey(card)
  const newSet = new Set(selectedCards.value)
  if (newSet.has(key)) newSet.delete(key)
  else newSet.add(key)
  selectedCards.value = newSet
}

function getSelectedCards() {
  const keys = selectedCards.value
  return myHand.value.filter(c => keys.has(cardKey(c)))
}

function nextHint() {
  if (hints.value.length === 0) {
    showToast('无可用提示')
    return
  }
  hintIndex.value = (hintIndex.value + 1) % hints.value.length
  const hint = hints.value[hintIndex.value]
  selectedCards.value = new Set(hint.cards.map(c => cardKey(c)))
}

function playCards() {
  const cards = getSelectedCards()
  if (!cards.length) return
  emit('action', { type: 'play', cards })
  selectedCards.value = new Set()
}

function onPass() {
  emit('action', { type: 'pass' })
  selectedCards.value = new Set()
}

function showToast(text) {
  toast.value = text
  setTimeout(() => { if (toast.value === text) toast.value = '' }, 1800)
}

function getPlayerName(pid) {
  return (props.roomPlayers || []).find(i => i.id === pid)?.nickname || (pid ? '玩家' : '')
}

function playerInitial(pid) {
  const name = getPlayerName(pid) || '玩'
  return name.slice(0, 1)
}

function avatarStyle(pid) {
  if (!pid) return {}
  let hash = 0
  for (const ch of String(pid)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const palette = [['#FFD86B', '#FF9F43'], ['#7EE8FA', '#80FF72'], ['#FBC2EB', '#A18CD1'], ['#F6D365', '#FDA085'], ['#84FAB0', '#8FD3F4'], ['#A1C4FD', '#C2E9FB'], ['#FF9A9E', '#FAD0C4'], ['#FCCB90', '#D57EEB']]
  const [a, b] = palette[hash % palette.length]
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
}

function mySideTeamKey() {
  const myId = props.player?.id
  if (props.gs.teams?.south_north?.includes(myId)) return 'south_north'
  if (props.gs.teams?.east_west?.includes(myId)) return 'east_west'
  return 'south_north'
}

function getCardCount(pid) {
  if (props.gs.handCounts?.[pid] != null) return props.gs.handCounts[pid]
  if (props.gs.hands?.[pid]) return props.gs.hands[pid].length
  return 9
}

// --- Pattern Recognition (full frontend replica) ---
function getValueCounts(cards, level) {
  const counts = new Map()
  cards.forEach(card => {
    const power = rankPower(card.rank, level)
    const item = counts.get(power) || { power, cards: [] }
    item.cards.push(card)
    counts.set(power, item)
  })
  return [...counts.values()].sort((a, b) => a.power - b.power)
}

function isPureSequence(values) {
  if (values.length < 2) return true
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false
  }
  return true
}

function buildPattern(type, cards, mainValue, extras = {}) {
  return { type, cards: [...cards], mainValue, length: cards.length, ...extras }
}

function identifyPatternPure(sorted, level) {
  const counts = getValueCounts(sorted, level)
  const values = counts.map(e => e.power)
  const suits = [...new Set(sorted.map(c => c.suit))]
  const size = sorted.length
  const maxCount = Math.max(...counts.map(e => e.cards.length))

  if (size === 1) return buildPattern('single', sorted, values[0])
  if (size === 2 && counts.length === 1) return buildPattern('pair', sorted, values[0])
  if (size === 3 && counts.length === 1) return buildPattern('triple', sorted, values[0])
  if (size >= 4 && counts.length === 1) return buildPattern('bomb', sorted, values[0], { bombSize: size })
  if (size === 5 && suits.length === 1 && values.length === 5 && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('straight_flush', sorted, values[values.length - 1])
  }
  if (size === 5 && counts.length === 2 && counts.some(e => e.cards.length === 3) && counts.some(e => e.cards.length === 2)) {
    const triple = counts.find(e => e.cards.length === 3)
    return buildPattern('triple_pair', sorted, triple.power)
  }
  if (size >= 5 && counts.every(e => e.cards.length === 1) && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('straight', sorted, values[values.length - 1], { sequenceLength: size })
  }
  if (size >= 6 && size % 2 === 0 && counts.every(e => e.cards.length === 2) && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('pair_straight', sorted, values[values.length - 1], { sequenceLength: size / 2 })
  }
  if (size >= 6 && size % 3 === 0 && counts.every(e => e.cards.length === 3) && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('steel', sorted, values[values.length - 1], { sequenceLength: size / 3 })
  }
  // Airplane
  const tripleEntries = counts.filter(e => e.cards.length === 3)
  if (tripleEntries.length >= 2) {
    const tripleValues = tripleEntries.map(e => e.power).sort((a, b) => a - b)
    let sequence = [tripleValues[0]]
    for (let i = 1; i < tripleValues.length; i++) {
      if (tripleValues[i] === tripleValues[i - 1] + 1) sequence.push(tripleValues[i])
      else sequence = [tripleValues[i]]
      if (sequence.length >= 2) {
        const wingCount = size - sequence.length * 3
        if (wingCount === sequence.length || wingCount === sequence.length * 2) {
          return buildPattern('airplane', sorted, sequence[sequence.length - 1], { airplaneLength: sequence.length, wingCount })
        }
      }
    }
  }
  if (maxCount >= 4) {
    const bombEntry = counts.filter(e => e.cards.length === maxCount).sort((a, b) => b.power - a.power)[0]
    return buildPattern('bomb', sorted, bombEntry.power, { bombSize: maxCount })
  }
  return buildPattern('invalid', sorted, 0)
}

function identifyPattern(cards, level = '2') {
  if (!Array.isArray(cards) || cards.length === 0) return null
  const sorted = sortHand(cards, level)
  const size = sorted.length
  if (size === 4 && sorted.every(c => c.suit === 'joker')) return buildPattern('rocket', sorted, 999)
  
  const wilds = sorted.filter(c => isWildCard(c))
  const nonWilds = sorted.filter(c => !isWildCard(c))
  const wildCount = wilds.length

  if (wildCount === 0) return identifyPatternPure(sorted, level)
  if (size === 1) return buildPattern('single', sorted, rankPower(sorted[0].rank, level))

  // Try bomb (all same rank with wilds)
  if (size >= 4) {
    if (nonWilds.length === 0) {
      return buildPattern('bomb', sorted, rankPower(level, level), { bombSize: size, hasWild: true })
    }
    const powers = nonWilds.map(c => rankPower(c.rank, level))
    if (new Set(powers).size === 1) {
      return buildPattern('bomb', sorted, powers[0], { bombSize: size, hasWild: true })
    }
  }

  // Try straight_flush (5 cards, same suit, consecutive)
  if (size === 5 && nonWilds.length > 0) {
    const suits = [...new Set(nonWilds.map(c => c.suit))]
    if (suits.length === 1 && suits[0] !== 'joker') {
      const vals = nonWilds.map(c => rankPower(c.rank, level)).filter(v => v <= 14 && v >= 2)
      const unique = [...new Set(vals)].sort((a, b) => a - b)
      if (unique.length === nonWilds.length) {
        const minV = unique[0], maxV = unique[unique.length - 1]
        if (maxV - minV < 5) {
          const gaps = (maxV - minV + 1) - unique.length
          if (gaps <= wildCount) {
            const remaining = wildCount - gaps
            let seqEnd = maxV, seqStart = minV, extra = remaining
            while (seqEnd - seqStart + 1 < 5 && extra > 0) {
              if (seqEnd + 1 <= 14) { seqEnd++; extra-- }
              else if (seqStart - 1 >= 2) { seqStart--; extra-- }
              else break
            }
            if (seqEnd - seqStart + 1 === 5) {
              return buildPattern('straight_flush', sorted, seqEnd, { hasWild: true })
            }
          }
        }
      }
    }
  }

  // Try triple_pair (5 cards: 3+2)
  if (size === 5) {
    const counts = getValueCounts(nonWilds, level)
    for (const entry of counts) {
      const tripleNeed = 3 - entry.cards.length
      if (tripleNeed > wildCount) continue
      const remainingWilds = wildCount - tripleNeed
      const otherCards = nonWilds.filter(c => rankPower(c.rank, level) !== entry.power)
      if (otherCards.length + remainingWilds === 2) {
        if (otherCards.length === 0 || new Set(otherCards.map(c => rankPower(c.rank, level))).size === 1) {
          return buildPattern('triple_pair', sorted, entry.power, { hasWild: true })
        }
      }
    }
  }

  // Try straight
  if (size >= 5) {
    const vals = nonWilds.map(c => rankPower(c.rank, level))
    if (vals.every(v => v <= 14 && v >= 2)) {
      const unique = [...new Set(vals)].sort((a, b) => a - b)
      if (unique.length === nonWilds.length && unique.length > 0) {
        const minV = unique[0], maxV = unique[unique.length - 1]
        const span = maxV - minV + 1
        if (span <= size) {
          const internalGaps = span - unique.length
          if (internalGaps <= wildCount) {
            const extension = size - span
            const extraWilds = wildCount - internalGaps
            if (extension <= extraWilds) {
              let seqStart = minV, seqEnd = maxV, ext = extension
              while (seqEnd - seqStart + 1 < size && ext > 0) {
                if (seqEnd + 1 <= 14) { seqEnd++; ext-- }
                else if (seqStart - 1 >= 2) { seqStart--; ext-- }
                else break
              }
              if (seqEnd - seqStart + 1 === size && seqEnd <= 14) {
                return buildPattern('straight', sorted, seqEnd, { sequenceLength: size, hasWild: true })
              }
            }
          }
        }
      }
    }
  }

  // Try pair_straight
  if (size >= 6 && size % 2 === 0) {
    const pairCount = size / 2
    const vals = nonWilds.map(c => rankPower(c.rank, level))
    if (vals.every(v => v <= 14 && v >= 2)) {
      const groups = new Map()
      vals.forEach(v => groups.set(v, (groups.get(v) || 0) + 1))
      let valid = true
      for (const cnt of groups.values()) { if (cnt > 2) { valid = false; break } }
      if (valid) {
        const sortedKeys = [...groups.keys()].sort((a, b) => a - b)
        if (sortedKeys.length > 0) {
          const minV = sortedKeys[0], maxV = sortedKeys[sortedKeys.length - 1]
          if (maxV - minV + 1 <= pairCount) {
            let wildsNeeded = 0
            const seqStart = Math.max(2, maxV - pairCount + 1)
            const seqEnd = seqStart + pairCount - 1
            if (seqEnd <= 14 && minV >= seqStart && maxV <= seqEnd) {
              for (let v = seqStart; v <= seqEnd; v++) wildsNeeded += (2 - (groups.get(v) || 0))
              if (wildsNeeded <= wildCount) {
                return buildPattern('pair_straight', sorted, seqEnd, { sequenceLength: pairCount, hasWild: true })
              }
            }
          }
        }
      }
    }
  }

  // Try steel
  if (size >= 6 && size % 3 === 0) {
    const tripleCount = size / 3
    const vals = nonWilds.map(c => rankPower(c.rank, level))
    if (vals.every(v => v <= 14 && v >= 2)) {
      const groups = new Map()
      vals.forEach(v => groups.set(v, (groups.get(v) || 0) + 1))
      let valid = true
      for (const cnt of groups.values()) { if (cnt > 3) { valid = false; break } }
      if (valid) {
        const sortedKeys = [...groups.keys()].sort((a, b) => a - b)
        if (sortedKeys.length > 0) {
          const minV = sortedKeys[0], maxV = sortedKeys[sortedKeys.length - 1]
          if (maxV - minV + 1 <= tripleCount) {
            let wildsNeeded = 0
            const seqStart = Math.max(2, maxV - tripleCount + 1)
            const seqEnd = seqStart + tripleCount - 1
            if (seqEnd <= 14 && minV >= seqStart && maxV <= seqEnd) {
              for (let v = seqStart; v <= seqEnd; v++) wildsNeeded += (3 - (groups.get(v) || 0))
              if (wildsNeeded <= wildCount) {
                return buildPattern('steel', sorted, seqEnd, { sequenceLength: tripleCount, hasWild: true })
              }
            }
          }
        }
      }
    }
  }

  // Try triple (3 cards)
  if (size === 3) {
    if (nonWilds.length === 0) return buildPattern('triple', sorted, rankPower(level, level), { hasWild: true })
    const powers = nonWilds.map(c => rankPower(c.rank, level))
    if (new Set(powers).size === 1) return buildPattern('triple', sorted, powers[0], { hasWild: true })
  }

  // Try pair (2 cards)
  if (size === 2) {
    if (nonWilds.length === 0) return buildPattern('pair', sorted, rankPower(level, level), { hasWild: true })
    return buildPattern('pair', sorted, rankPower(nonWilds[0].rank, level), { hasWild: true })
  }

  // Fallback
  return identifyPatternPure(sorted, level)
}

function comparePattern(nextPat, currentPat) {
  if (!nextPat || nextPat.type === 'invalid') return -1
  if (!currentPat) return 1
  const bombLike = ['bomb', 'straight_flush', 'rocket']
  if (nextPat.type === 'rocket') return currentPat.type === 'rocket' ? 0 : 1
  if (currentPat.type === 'rocket') return -1
  if (nextPat.type === 'straight_flush' && currentPat.type !== 'straight_flush' && currentPat.type !== 'rocket') return 1
  if (nextPat.type === 'bomb' && !bombLike.includes(currentPat.type)) return 1
  if (currentPat.type === 'bomb' && !bombLike.includes(nextPat.type)) return -1
  if (nextPat.type !== currentPat.type) return -1
  if (nextPat.type === 'bomb') {
    if (nextPat.bombSize !== currentPat.bombSize) return nextPat.bombSize - currentPat.bombSize
    return nextPat.mainValue - currentPat.mainValue
  }
  if (nextPat.sequenceLength && nextPat.sequenceLength !== currentPat.sequenceLength) return -1
  if (nextPat.airplaneLength && nextPat.airplaneLength !== currentPat.airplaneLength) return -1
  if (nextPat.length !== currentPat.length) return -1
  return nextPat.mainValue - currentPat.mainValue
}

function patternName(type) {
  const names = {
    single: '单张', pair: '对子', triple: '三条', bomb: '炸弹',
    rocket: '火箭', straight: '顺子', pair_straight: '连对',
    steel: '钢板', triple_pair: '三带二', straight_flush: '同花顺',
    airplane: '飞机', invalid: '无效'
  }
  return names[type] || ''
}

// --- Canvas Drawing ---
function scheduleDraw() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => { rafId = null; drawTable() })
}

function drawTable() {
  if (!renderer || !canvasRef.value) return
  const W = renderer._logicalWidth
  const H = renderer._logicalHeight
  renderer.clear()

  // Background
  renderer.drawWoodFrame(0, 0, W, H, 10)

  const ctx = renderer._ctx
  // Central decorative ellipse
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, W * 0.32, H * 0.35, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  const rs = relativeSeats.value

  // Top player (horizontal cards)
  if (rs.top) {
    const seatX = W / 2 - 20
    const seatY = 18
    renderer.drawSeatInfo(seatX, seatY, {
      name: getPlayerName(rs.top.playerId),
      count: getCardCount(rs.top.playerId),
      isCurrentTurn: props.gs.currentPlayer === rs.top.playerId
    })
    const backW = 20, backH = 30, gap = 3
    const total = Math.min(getCardCount(rs.top.playerId) || 9, 12)
    const startX = W / 2 - (total * (backW + gap) - gap) / 2
    for (let i = 0; i < total; i++) {
      renderer.drawCardBack(startX + i * (backW + gap), seatY + 80, backW, backH)
    }
  }

  // Left player (vertical cards)
  if (rs.left) {
    const seatX = 18
    const seatY = H / 2 - 50
    renderer.drawSeatInfo(seatX, seatY, {
      name: getPlayerName(rs.left.playerId),
      count: getCardCount(rs.left.playerId),
      isCurrentTurn: props.gs.currentPlayer === rs.left.playerId
    })
    const backW = 24, backH = 16, gap = 2
    const total = Math.min(getCardCount(rs.left.playerId) || 7, 5)
    for (let i = 0; i < total; i++) {
      renderer.drawCardBack(seatX + 50, seatY - 30 + i * (backH + gap), backW, backH, { horizontal: true })
    }
  }

  // Right player (vertical cards)
  if (rs.right) {
    const seatX = W - 62
    const seatY = H / 2 - 50
    renderer.drawSeatInfo(seatX, seatY, {
      name: getPlayerName(rs.right.playerId),
      count: getCardCount(rs.right.playerId),
      isCurrentTurn: props.gs.currentPlayer === rs.right.playerId
    })
    const backW = 24, backH = 16, gap = 2
    const total = Math.min(getCardCount(rs.right.playerId) || 7, 5)
    for (let i = 0; i < total; i++) {
      renderer.drawCardBack(seatX - 28, seatY - 30 + i * (backH + gap), backW, backH, { horizontal: true })
    }
  }

  // Central play area
  const lastPlay = props.gs.lastPlay
  const lastCards = (lastPlay?.cards || []).slice(0, 14)
  if (lastCards.length) {
    const cardW = 32, gap = 3
    const totalCardsW = lastCards.length * (cardW + gap) - gap
    const panelW = Math.max(totalCardsW + 24, 130)
    const panelX = W / 2 - panelW / 2
    const panelY = H / 2 - 50
    const labelText = patternName(identifyPattern(lastCards, currentLevel.value)?.type) || ''
    renderer.drawPlayedCards(panelX, panelY, lastCards, {
      title: `${getPlayerName(lastPlay.playerId)} 出牌`,
      label: labelText
    })
  } else {
    const txt = props.gs.phase === 'play' ? '等待出牌' : '本局结束'
    renderer.drawRoundRect(W / 2 - 60, H / 2 - 18, 120, 36, 18, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.3)', 1)
    renderer.drawText(txt, W / 2, H / 2, {
      font: 'bold 13px "Noto Serif SC", serif',
      color: '#fff8e6',
      align: 'center',
      baseline: 'middle'
    })
  }

  // Level badge
  const lvlText = `级牌 ${currentLevel.value}`
  renderer.drawRoundRect(16, 14, 70, 22, 11, 'rgba(255,175,26,0.9)')
  renderer.drawText(lvlText, 51, 25, { font: 'bold 11px sans-serif', color: '#3a2300', align: 'center', baseline: 'middle' })
}

function sizeCanvas() {
  if (!canvasRef.value || !canvasWrapRef.value) return
  const w = canvasWrapRef.value.clientWidth || 800
  const h = canvasWrapRef.value.clientHeight || 300
  if (!renderer) {
    renderer = new CanvasRenderer(canvasRef.value, { width: w, height: h })
  } else {
    renderer.resize(w, h)
  }
  scheduleDraw()
}

// --- Timer ---
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
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

// --- Lifecycle ---
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
})

onBeforeUnmount(() => {
  stopTimer()
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeObserver) resizeObserver.disconnect()
  else window.removeEventListener('resize', sizeCanvas)
})

watch(() => props.gs, () => {
  scheduleDraw()
  hintIndex.value = -1
}, { deep: true })

watch(() => props.gs?.currentPlayer, () => {
  resetCountdown()
  selectedCards.value = new Set()
  hintIndex.value = -1
})
</script>

<style scoped>
.gd-board {
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #0a2e1a;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #fff;
}

/* 顶部信息栏 */
.gd-info-bar {
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: linear-gradient(90deg, #1a3a2a 0%, #0d4d2a 50%, #1a3a2a 100%);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  font-size: 13px;
  z-index: 10;
}

.back-btn {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.15); color: #fff;
  display: grid; place-items: center; cursor: pointer;
  transition: background 0.15s;
}
.back-btn:hover { background: rgba(255,255,255,0.25); }

.info-item { color: #e0e0e0; white-space: nowrap; }
.info-item b { color: #FFD700; font-weight: 700; }
.info-sep { color: rgba(255,255,255,0.3); }
.team-vs { display: inline-flex; align-items: center; gap: 4px; }
.team-mine-label { font-style: normal; color: #84FAB0; }
.team-opp-label { font-style: normal; color: #FF9A9E; }
.vs { color: #FFD700; font-weight: 900; font-size: 11px; }

/* Canvas区域 */
.canvas-area {
  flex: 1 1 0;
  min-height: 0;
  position: relative;
  margin: 4px 6px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* 底部手牌+操作区 */
.bottom-zone {
  flex: 0 0 auto;
  min-height: 140px;
  max-height: 200px;
  display: flex;
  align-items: stretch;
  background: linear-gradient(180deg, #0f3d26 0%, #0a2e1a 100%);
  border-top: 1px solid rgba(255,215,0,0.2);
  padding: 6px 8px;
  gap: 8px;
}

/* 左侧我方信息 */
.my-info {
  flex: 0 0 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.my-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  color: #fff; font-weight: 900; font-size: 16px;
  border: 2px solid rgba(255,215,0,0.6);
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
.my-meta { text-align: center; line-height: 1.2; }
.my-meta strong { display: block; font-size: 12px; color: #e0e0e0; }
.my-meta span { font-size: 10px; color: #8fbc8f; }
.pattern-label {
  padding: 2px 8px; border-radius: 8px;
  background: rgba(255,215,0,0.2); color: #FFD700;
  font-size: 11px; font-weight: 700;
}

/* 分组手牌区 */
.hand-groups {
  flex: 1 1 0;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  overflow-x: auto;
  overflow-y: visible;
  padding: 8px 6px 6px;
  scrollbar-width: thin;
}
.hand-groups::-webkit-scrollbar { height: 4px; }
.hand-groups::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

.card-group {
  position: relative;
  flex-shrink: 0;
  width: 52px;
}

.card-slot {
  position: absolute;
  left: 0;
  cursor: pointer;
  transition: transform 0.15s ease;
  border-radius: 8px;
}
.card-slot:hover { transform: translateY(-4px); }
.card-slot.selected { transform: translateY(-15px); }
.card-slot.selected::after {
  content: '';
  position: absolute; top: -4px; left: 50%; transform: translateX(-50%);
  width: 6px; height: 6px; border-radius: 50%;
  background: #FF9800; box-shadow: 0 0 6px #FF9800;
}
.card-slot.wild {
  filter: drop-shadow(0 0 4px rgba(255,215,0,0.7));
}
.card-slot.wild::before {
  content: '';
  position: absolute; inset: -2px; border-radius: 10px;
  border: 2px solid #FFD700;
  pointer-events: none;
  animation: wild-glow 1.5s ease-in-out infinite alternate;
}
@keyframes wild-glow {
  from { box-shadow: 0 0 4px rgba(255,215,0,0.4); }
  to { box-shadow: 0 0 10px rgba(255,215,0,0.8); }
}
.wild-star {
  position: absolute; top: -2px; right: -2px;
  font-size: 12px; color: #FFD700;
  text-shadow: 0 0 4px rgba(255,215,0,0.8);
  pointer-events: none; z-index: 5;
}

.card-slot :deep(.playing-card) {
  width: 50px; height: 72px; border-radius: 8px;
}

.hand-empty {
  width: 100%; text-align: center;
  color: #6b9b7a; font-size: 13px; padding: 20px 0;
}

/* 右侧操作按钮 */
.action-buttons {
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-buttons button {
  width: 60px; height: 34px;
  border-radius: 17px; border: none;
  color: #fff; font-size: 13px; font-weight: 700;
  cursor: pointer; position: relative;
  letter-spacing: 1px;
  transition: transform 0.12s, opacity 0.2s;
}
.action-buttons button:not(:disabled):hover { transform: scale(1.05); }
.action-buttons button:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-pass { background: linear-gradient(135deg, #2196F3, #1976D2); box-shadow: 0 3px 8px rgba(25,118,210,0.4); }
.btn-hint { background: linear-gradient(135deg, #FF9800, #F57C00); box-shadow: 0 3px 8px rgba(245,124,0,0.4); }
.btn-play { background: linear-gradient(135deg, #4CAF50, #388E3C); box-shadow: 0 3px 8px rgba(56,142,60,0.4); }

.badge {
  position: absolute; top: -4px; right: 2px;
  min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 8px; background: #F44336;
  color: #fff; font-size: 10px; font-weight: 700;
  display: grid; place-items: center;
  border: 1.5px solid #fff;
}

.timer-circle {
  position: relative; width: 50px; height: 50px;
  display: grid; place-items: center;
}
.timer-circle svg { display: block; }
.timer-num {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  font-weight: 900; font-size: 16px; color: #4FACFE;
}
.timer-circle.urgent .timer-num { color: #F44336; }

/* 结算区 */
.result-zone {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; padding: 20px;
}
.result-zone strong {
  font-size: 20px; color: #FFD700;
  font-family: 'Noto Serif SC', serif;
}
.result-zone span { color: #8fbc8f; font-size: 13px; }
.result-actions { display: flex; gap: 12px; margin-top: 12px; }
.result-actions button { width: 100px; height: 38px; }

/* Toast */
.toast {
  position: fixed; left: 50%; bottom: 60px;
  transform: translateX(-50%); z-index: 100;
  padding: 8px 16px; border-radius: 16px;
  background: rgba(0,0,0,0.8); color: #fff;
  font-size: 13px; font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-height: 600px) {
  .bottom-zone { min-height: 110px; max-height: 150px; }
  .card-slot :deep(.playing-card) { width: 44px; height: 62px; }
  .card-group { width: 46px; }
}
</style>
