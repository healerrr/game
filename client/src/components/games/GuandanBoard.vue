<template>
  <div class="game-wrapper" :class="{ 'force-landscape': isPortrait }">
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
             :style="handGroupStyle(group)">
          <div v-for="(card, ci) in group" :key="cardKey(card) + '-' + ci"
               class="card-slot"
               :class="{ selected: isSelected(card), wild: isWildCard(card) }"
               :style="handCardStyle(ci)"
               @click="toggleSelect(card)">
            <PlayingCard :card="card" small />
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
  </div>
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
const isPortrait = ref(false)

let renderer = null
let rafId = null
let timerInterval = null
let resizeObserver = null

// --- Constants ---
const SEAT_ORDER = ['south', 'east', 'north', 'west']
const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'SJ': 16, 'BJ': 17 }
const HAND_CARD_BASE_H = 62
const HAND_STACK_STEP = 18

function handGroupStyle(group) {
  return { height: `${HAND_CARD_BASE_H + (group.length - 1) * HAND_STACK_STEP}px` }
}

function handCardStyle(index) {
  return { top: `${index * HAND_STACK_STEP}px` }
}

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

  const ctx = renderer._ctx

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

  // Layered table surface
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0e4a2d')
  bg.addColorStop(1, '#062615')
  renderer.drawRoundRect(0, 0, W, H, 0, bg)

  const railGrad = ctx.createLinearGradient(tableX, tableY, tableX, tableY + tableH)
  railGrad.addColorStop(0, '#c2762d')
  railGrad.addColorStop(0.45, '#7f3d13')
  railGrad.addColorStop(1, '#4c240d')
  renderer.drawRoundRect(tableX, tableY, tableW, tableH, 18, railGrad, 'rgba(255, 195, 98, 0.32)', 1.5)

  const feltGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.52)
  feltGrad.addColorStop(0, '#197343')
  feltGrad.addColorStop(0.62, '#0f5d35')
  feltGrad.addColorStop(1, '#07351f')
  renderer.drawRoundRect(feltX, feltY, feltW, feltH, 12, feltGrad, 'rgba(0, 0, 0, 0.45)', 2)

  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, W * 0.31, H * 0.34, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Subtle center focus
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, W * 0.17, H * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const rs = relativeSeats.value

  // Top player (horizontal cards)
  if (rs.top) {
    const seatX = W / 2 - 20
    const seatY = Math.max(8, feltY + 2)
    renderer.drawSeatInfo(seatX, seatY, {
      name: getPlayerName(rs.top.playerId),
      count: getCardCount(rs.top.playerId),
      isCurrentTurn: props.gs.currentPlayer === rs.top.playerId
    })
    const backW = Math.max(16, Math.min(22, W * 0.022))
    const backH = backW * 1.42
    const gap = 4
    const total = Math.min(getCardCount(rs.top.playerId) || 9, 13)
    const startX = W / 2 - (total * (backW + gap) - gap) / 2
    for (let i = 0; i < total; i++) {
      renderer.drawCardBack(startX + i * (backW + gap), seatY + 66, backW, backH)
    }
  }

  // Left player (vertical cards)
  if (rs.left) {
    const seatX = feltX + 10
    const seatY = H / 2 - 50
    renderer.drawSeatInfo(seatX, seatY, {
      name: getPlayerName(rs.left.playerId),
      count: getCardCount(rs.left.playerId),
      isCurrentTurn: props.gs.currentPlayer === rs.left.playerId
    })
    const backW = 26, backH = 17, gap = 3
    const total = Math.min(getCardCount(rs.left.playerId) || 7, 6)
    for (let i = 0; i < total; i++) {
      renderer.drawCardBack(seatX + 48, seatY - 34 + i * (backH + gap), backW, backH, { horizontal: true })
    }
  }

  // Right player (vertical cards)
  if (rs.right) {
    const seatX = W - feltX - 50
    const seatY = H / 2 - 50
    renderer.drawSeatInfo(seatX, seatY, {
      name: getPlayerName(rs.right.playerId),
      count: getCardCount(rs.right.playerId),
      isCurrentTurn: props.gs.currentPlayer === rs.right.playerId
    })
    const backW = 26, backH = 17, gap = 3
    const total = Math.min(getCardCount(rs.right.playerId) || 7, 6)
    for (let i = 0; i < total; i++) {
      renderer.drawCardBack(seatX - 30, seatY - 34 + i * (backH + gap), backW, backH, { horizontal: true })
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
    const panelY = H / 2 - 24
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
  renderer.drawRoundRect(feltX + 8, feltY + 8, 74, 24, 12, 'rgba(255,185,36,0.96)')
  renderer.drawText(lvlText, feltX + 45, feltY + 20, { font: 'bold 12px sans-serif', color: '#3a2300', align: 'center', baseline: 'middle' })
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

function checkOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth && window.innerWidth < 768
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
  // 强制横屏检测
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
  // 尝试使用 Screen Orientation API（部分浏览器支持）
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
  hintIndex.value = -1
}, { deep: true })

watch(() => props.gs?.currentPlayer, () => {
  resetCountdown()
  selectedCards.value = new Set()
  hintIndex.value = -1
})
</script>

<style scoped>
/* 强制横屏外层容器 */
.game-wrapper {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.game-wrapper.force-landscape {
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

.gd-board {
  width: 100%;
  height: 100%;
  max-height: 100%;
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
  /* 占比限制：底部区域不超过屏幕高度的 35% */
  max-height: 35vh;
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
/* 扩大触摸热区，便于手机端点击 */
.card-slot::after {
  content: '';
  position: absolute;
  inset: -10px -6px;
  z-index: -1;
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
  gap: 10px;
}

.action-buttons button {
  width: 60px; height: 34px;
  min-width: 64px;
  min-height: 44px;
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

/* 手机竖屏适配 */
@media (max-width: 414px) {
  .bottom-zone {
    min-height: 100px;
    max-height: 140px;
    padding: 4px;
  }
  .card-slot :deep(.playing-card) {
    width: 42px;
    height: 60px;
  }
  .card-group {
    width: 44px;
  }
  .hand-groups {
    gap: 3px;
  }
  .action-buttons {
    gap: 8px;
  }
  .action-buttons button {
    min-width: 52px;
    min-height: 38px;
    font-size: 12px;
    padding: 4px 8px;
  }
  .top-info-bar {
    font-size: 12px;
    height: 36px;
  }
}

@media (max-width: 375px) {
  .bottom-zone {
    min-height: 90px;
    max-height: 120px;
  }
  .card-slot :deep(.playing-card) {
    width: 38px;
    height: 54px;
  }
  .card-group {
    width: 40px;
  }
}

/* 横屏锁定提示 (旧覆盖层已移除，保留 fade 过渡) */

/* Professional landscape table polish */
.game-wrapper {
  height: 100dvh;
  background:
    radial-gradient(circle at 50% -12%, rgba(255, 211, 93, 0.18), transparent 28%),
    linear-gradient(180deg, #0b4a2c 0%, #052717 100%);
}

.gd-board {
  background:
    radial-gradient(circle at 50% 18%, rgba(37, 178, 105, 0.14), transparent 28%),
    linear-gradient(180deg, #0b4a2c 0%, #052717 100%);
}

.gd-info-bar {
  flex-basis: 46px;
  min-height: 46px;
  gap: 10px;
  padding: 0 14px;
  background:
    linear-gradient(180deg, rgba(18, 92, 55, 0.98), rgba(7, 58, 33, 0.98));
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
  font-size: 14px;
  overflow: hidden;
}

.back-btn {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.info-item {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 800;
}

.info-item b {
  color: #ffdc45;
  font-size: 17px;
}

.team-vs {
  min-width: 0;
  flex: 1 1 auto;
  justify-content: center;
  font-weight: 900;
  overflow: hidden;
}

.team-mine-label,
.team-opp-label {
  max-width: 38%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-mine-label {
  color: #7dffba;
}

.team-opp-label {
  color: #ff8f9a;
}

.vs {
  color: #ffe15b;
  font-size: 12px;
  flex: 0 0 auto;
}

.canvas-area {
  flex: 1 1 auto;
  min-height: 0;
  margin: 8px 10px 0;
  border-radius: 18px;
  border: 1px solid rgba(255, 214, 114, 0.28);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 14px 28px rgba(0, 0, 0, 0.28);
}

.bottom-zone {
  position: relative;
  flex: 0 0 clamp(154px, 35vh, 190px);
  min-height: 154px;
  max-height: 190px;
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 154px;
  align-items: stretch;
  gap: 10px;
  margin: 8px 10px 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(14, 65, 39, 0.98), rgba(7, 42, 24, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 14px 28px rgba(0, 0, 0, 0.22);
}

.my-info {
  flex: none;
  min-width: 0;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.09);
  justify-content: center;
  padding: 8px 6px;
}

.my-avatar {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(255, 255, 255, 0.78);
  font-size: 18px;
}

.my-meta strong {
  max-width: 76px;
  color: #fff;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-meta span {
  color: #87e6ae;
  font-size: 12px;
  font-weight: 800;
}

.pattern-label {
  max-width: 78px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255, 203, 67, 0.16);
  color: #ffd45a;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hand-groups {
  --hand-card-w: clamp(34px, 3.6vw, 42px);
  --hand-card-h: calc(var(--hand-card-w) * 1.42);
  min-width: 0;
  padding: 14px 6px 6px;
  gap: 3px;
  align-items: flex-end;
  justify-content: center;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.035));
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow-x: hidden;
  overflow-y: visible;
  scrollbar-width: none;
}

.hand-groups::-webkit-scrollbar {
  display: none;
}

.hand-groups::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
}

.hand-groups::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.26);
  border-radius: 999px;
}

.card-group {
  width: var(--hand-card-w);
  flex: 0 0 var(--hand-card-w);
}

.card-slot {
  transition: transform 0.14s ease, filter 0.14s ease;
  filter: drop-shadow(0 9px 10px rgba(0, 0, 0, 0.18));
}

.card-slot:hover {
  transform: translateY(-3px);
}

.card-slot.selected {
  transform: translateY(-14px);
  z-index: 8;
}

.card-slot.selected::after {
  top: -9px;
  width: 26px;
  height: 6px;
  border-radius: 999px;
  background: #ffcc3d;
  box-shadow: 0 0 12px rgba(255, 204, 61, 0.8);
}

.card-slot :deep(.playing-card) {
  width: var(--hand-card-w);
  height: var(--hand-card-h);
  border-radius: 8px;
}

.wild-star {
  top: -5px;
  right: -5px;
  font-size: 13px;
}

.action-buttons {
  flex: none;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: center;
  justify-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.09);
}

.action-buttons button {
  width: 100%;
  min-width: 0;
  height: 40px;
  min-height: 40px;
  border-radius: 999px;
  font-size: 14px;
  letter-spacing: 0;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 8px 15px rgba(0, 0, 0, 0.18);
}

.btn-pass {
  background: linear-gradient(180deg, #3d8dff, #1162d8);
}

.btn-hint {
  background: linear-gradient(180deg, #ffb433, #f18400);
}

.btn-play {
  background: linear-gradient(180deg, #39c673, #168844);
}

.action-buttons button:disabled {
  opacity: 0.38;
  filter: grayscale(0.15);
}

.timer-circle {
  width: 48px;
  height: 48px;
  margin-top: 0;
}

.timer-num {
  color: #77c7ff;
  font-size: 15px;
}

.result-zone {
  margin: 8px 10px 10px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
}

@media (max-height: 600px) {
  .gd-info-bar {
    flex-basis: 40px;
    min-height: 40px;
    font-size: 12px;
  }

  .back-btn {
    width: 30px;
    height: 30px;
    flex-basis: 30px;
  }

  .canvas-area {
    margin: 6px 8px 0;
  }

  .bottom-zone {
    flex-basis: clamp(126px, 33vh, 156px);
    min-height: 126px;
    max-height: 156px;
    grid-template-columns: 74px minmax(0, 1fr) 136px;
    gap: 7px;
    margin: 6px 8px 8px;
    padding: 8px;
  }

  .my-avatar {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .my-meta strong {
    font-size: 12px;
  }

  .pattern-label {
    font-size: 11px;
    padding: 3px 7px;
  }

  .hand-groups {
    --hand-card-w: clamp(32px, 3.3vw, 38px);
    padding: 10px 4px 4px;
    gap: 2px;
  }

  .card-slot :deep(.playing-card) {
    width: var(--hand-card-w);
    height: var(--hand-card-h);
  }

  .card-slot.selected {
    transform: translateY(-11px);
  }

  .action-buttons {
    gap: 6px;
  }

  .action-buttons button {
    height: 34px;
    min-height: 34px;
    font-size: 12px;
  }

  .timer-circle {
    width: 42px;
    height: 42px;
  }
}

@media (max-width: 680px) {
  .info-sep {
    display: none;
  }

  .gd-info-bar {
    gap: 7px;
  }

  .info-item:not(.team-vs) {
    font-size: 12px;
  }

  .team-mine-label,
  .team-opp-label {
    max-width: 34%;
  }
}
</style>
