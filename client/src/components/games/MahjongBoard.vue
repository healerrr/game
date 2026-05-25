<template>
  <div class="mahjong-stage">
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载麻将牌桌...</p>
    </div>

    <template v-else>
      <!-- 顶部蓝色渐变头部 -->
      <header class="mj-header">
        <button class="back-btn" @click="$emit('back')" aria-label="返回">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="#1976D2" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="title-wrap">
          <span class="star left">✦</span>
          <h1 class="title">红中麻将</h1>
          <span class="star right">✦</span>
        </div>

        <div class="score-badge">
          <span class="coin">¥</span>
          <span class="score-num">{{ myScore }}</span>
        </div>
      </header>

      <!-- 信息条 -->
      <div class="info-bar">
        <div class="info-item">
          <span class="info-icon flag">⚑</span>
          <span class="info-text">第 {{ gs.roundNumber || 1 }} 局</span>
        </div>
        <div class="info-divider"></div>
        <div class="info-item">
          <span class="info-icon avatar">👤</span>
          <span class="info-text">{{ getPlayerName(activeSeat || gs.currentPlayer) }}</span>
        </div>
        <div class="info-divider"></div>
        <div class="info-item">
          <span class="info-icon mahjong">🀄</span>
          <span class="info-text">剩余 {{ gs.remainingTiles ?? 0 }}</span>
        </div>
      </div>

      <!-- Canvas 游戏桌面 -->
      <div class="table-canvas-wrap" ref="canvasWrapRef">
        <canvas ref="canvasRef" class="game-canvas"></canvas>
      </div>

      <!-- 手牌区 -->
      <div class="hand-panel">
        <div class="hand-header">
          <span class="hand-label">我的手牌</span>
          <span class="hand-count">{{ myHand.length }} 张</span>
        </div>
        <div class="hand-row">
          <button
            v-for="(tile, index) in myHand"
            :key="tile.id || `${tile.suit}-${tile.rank}-${index}`"
            class="hand-tile"
            :class="{
              selected: selectedIndex === index,
              hint: hintIndex === index && selectedIndex !== index,
              disabled: !canDiscard
            }"
            :disabled="!canDiscard"
            @click="selectTile(index)"
          >
            <span class="tile-top" :data-suit="getTileSuitClass(tile)">
              <span class="tile-glyph" :class="getTileSuitClass(tile)">{{ getTileGlyph(tile) }}</span>
            </span>
            <span class="tile-side"></span>
            <span v-if="canHuTile(tile)" class="hu-mark">可胡</span>
          </button>
        </div>
      </div>

      <!-- 副露展示区 -->
      <div v-if="myMelds.length" class="melds-panel">
        <span class="melds-label">我方已碰/杠</span>
        <div class="melds-row">
          <div
            v-for="(meld, mi) in myMelds"
            :key="`meld-${mi}`"
            class="meld-group"
          >
            <span class="meld-tag" :class="meld.type">{{ meldLabel(meld.type) }}</span>
            <div class="meld-tiles">
              <span
                v-for="(t, ti) in meld.tiles"
                :key="`m-${mi}-${ti}`"
                class="meld-tile"
              >
                <span class="tile-glyph" :class="getTileSuitClass(t)">{{ getTileGlyph(t) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮区 -->
      <div class="action-bar">
        <template v-if="canDraw">
          <button class="action-btn act-discard" @click="draw">摸 牌</button>
        </template>

        <template v-else-if="canDiscard">
          <button
            class="action-btn act-peng"
            :disabled="!canSelfAction('peng')"
            @click="emitSelfAction('peng')"
          >碰</button>
          <button
            class="action-btn act-gang"
            :disabled="!canSelfAction('gang') && !canSelfAction('angang') && !canSelfAction('bugang')"
            @click="emitSelfGang"
          >杠</button>
          <button
            class="action-btn act-hu"
            :disabled="!canSelfAction('hu')"
            @click="emitSelfAction('hu')"
          >胡</button>
          <button
            class="action-btn act-discard"
            :disabled="selectedIndex === null"
            @click="discard"
          >出牌</button>
        </template>

        <template v-else-if="showResponsePanel">
          <button
            v-if="hasResponse('peng')"
            class="action-btn act-peng"
            @click="emitResponseByType('peng')"
          >碰</button>
          <button
            v-if="hasResponse('gang')"
            class="action-btn act-gang"
            @click="emitResponseByType('gang')"
          >杠</button>
          <button
            v-if="hasResponse('hu')"
            class="action-btn act-hu"
            @click="emitResponseByType('hu')"
          >胡</button>
          <button
            class="action-btn act-pass"
            @click="emitResponseByType('pass')"
          >过</button>
        </template>

        <template v-else-if="gs.phase === 'finished'">
          <button class="action-btn act-discard" @click="$emit('rematch')">再来一局</button>
          <button class="action-btn act-pass" @click="$emit('back')">返回大厅</button>
        </template>

        <template v-else>
          <div class="status-line">{{ waitingText }}</div>
        </template>
      </div>

      <!-- 游戏规则按钮 -->
      <button class="rules-btn" @click="showRules = !showRules">
        <span class="rules-icon">📖</span>
        <span>游戏规则</span>
      </button>

      <!-- 规则弹窗 -->
      <transition name="modal">
        <div v-if="showRules" class="rules-overlay" @click.self="showRules = false">
          <div class="rules-card">
            <h3>红中麻将规则</h3>
            <ul>
              <li>使用万、筒、条 + 红中（共 112 张）</li>
              <li>胡牌牌型：4 副面子 + 1 对将</li>
              <li>支持碰、明杠、暗杠、补杠</li>
              <li>红中可作百搭（视具体规则）</li>
            </ul>
            <button class="rules-close" @click="showRules = false">关闭</button>
          </div>
        </div>
      </transition>

      <transition name="modal">
        <div v-if="gs.phase === 'finished'" class="result-overlay">
          <div class="result-card">
            <h2>{{ resultText }}</h2>
            <p>{{ resultDetail }}</p>
            <p v-if="winSummary" class="summary">{{ winSummary }}</p>
            <div class="result-actions">
              <button class="action-btn act-discard" @click="$emit('rematch')">再来一局</button>
              <button class="action-btn act-pass" @click="$emit('back')">返回大厅</button>
            </div>
          </div>
        </div>
      </transition>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import CanvasRenderer from '../../game/canvas-renderer.js'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

const seatOrder = ['south', 'west', 'north', 'east']

const selectedIndex = ref(null)
const showHint = ref(true)
const showRules = ref(false)
const canvasRef = ref(null)
const canvasWrapRef = ref(null)
let renderer = null
let rafId = 0
let resizeObserver = null

const myId = computed(() => props.player?.id || '')
const isReady = computed(() => Boolean(props.gs?.hands && props.gs?.players && myId.value))
const myHand = computed(() => props.gs.hands?.[myId.value] || [])
const myScore = computed(() => props.gs.scores?.[myId.value] ?? props.player?.score ?? 1000)

const seatsByPlayerId = computed(() => {
  const map = new Map()
  if (Array.isArray(props.gs.seats) && props.gs.seats.length) {
    props.gs.seats.forEach((entry) => map.set(entry.playerId, entry.seat))
    return map
  }
  const ordered = props.roomPlayers || []
  ordered.forEach((p, idx) => map.set(p.id, seatOrder[idx] || `seat_${idx}`))
  return map
})

const mySeat = computed(() => seatsByPlayerId.value.get(myId.value) || 'south')

const positionByPlayerId = computed(() => {
  const myIndex = seatOrder.indexOf(mySeat.value)
  const map = new Map()
  ;(props.roomPlayers || []).forEach((p) => {
    const seatName = seatsByPlayerId.value.get(p.id) || 'south'
    const seatIdx = seatOrder.indexOf(seatName)
    if (myIndex < 0 || seatIdx < 0) {
      map.set(p.id, p.id === myId.value ? 'bottom' : 'top')
      return
    }
    const diff = (seatIdx - myIndex + seatOrder.length) % seatOrder.length
    if (diff === 0) map.set(p.id, 'bottom')
    else if (diff === 1) map.set(p.id, 'right')
    else if (diff === 2) map.set(p.id, 'top')
    else map.set(p.id, 'left')
  })
  return map
})

const seatTop = computed(() => (props.roomPlayers || []).find((p) => positionByPlayerId.value.get(p.id) === 'top') || null)
const seatLeft = computed(() => (props.roomPlayers || []).find((p) => positionByPlayerId.value.get(p.id) === 'left') || null)
const seatRight = computed(() => (props.roomPlayers || []).find((p) => positionByPlayerId.value.get(p.id) === 'right') || null)
const seatBottom = computed(() => (props.roomPlayers || []).find((p) => positionByPlayerId.value.get(p.id) === 'bottom') || { id: myId.value, nickname: props.player?.nickname || '我' })

const canDraw = computed(() => props.gs.phase === 'draw' && props.gs.currentPlayer === myId.value)
const canDiscard = computed(() => props.gs.phase === 'discard' && props.gs.currentPlayer === myId.value)

const activeSeat = computed(() => {
  if (props.gs.phase !== 'response') return props.gs.currentPlayer
  const pending = props.gs.pendingAction
  if (!pending) return props.gs.currentPlayer
  if (pending.type === 'self') return pending.playerId
  return pending.queue?.[0]?.playerId || props.gs.currentPlayer
})

const showResponsePanel = computed(() => {
  const pending = props.gs.pendingAction
  if (!pending || props.gs.phase !== 'response') return false
  if (pending.type === 'self') return pending.playerId === myId.value
  return pending.queue?.[0]?.playerId === myId.value
})

const responseOptions = computed(() => {
  const pending = props.gs.pendingAction
  if (!pending) return []
  if (pending.type === 'self') {
    return (pending.options || []).map((item) => ({ type: item.action, tile: item.tile }))
  }
  const current = pending.queue?.[0]
  if (!current) return []
  return [{ type: current.action, tile: current.tile }]
})

const selfActionOptions = computed(() => {
  const pending = props.gs.pendingAction
  if (!pending || pending.type !== 'self') return []
  if (pending.playerId !== myId.value) return []
  return (pending.options || []).map((item) => ({ type: item.action, tile: item.tile }))
})

const myMelds = computed(() => {
  const melds = props.gs.melds?.[myId.value] || props.gs.fulu?.[myId.value] || []
  return melds.map((m) => ({
    type: m.type || 'peng',
    tiles: m.tiles || []
  }))
})

const lastDiscard = computed(() => props.gs.lastDiscard || null)

const waitingText = computed(() => {
  if (canDraw.value) return '轮到你摸牌'
  if (canDiscard.value) return '请选择一张牌打出'
  if (props.gs.phase === 'response') return `等待 ${getPlayerName(activeSeat.value)} 响应...`
  if (props.gs.phase === 'finished') return '本局结算中'
  return `等待 ${getPlayerName(props.gs.currentPlayer)} 操作...`
})

const hintIndex = computed(() => {
  if (!showHint.value || !canDiscard.value || myHand.value.length === 0) return null
  const counter = new Map()
  myHand.value.forEach((tile) => {
    const key = `${tile.suit}-${tile.rank}`
    counter.set(key, (counter.get(key) || 0) + 1)
  })
  for (let i = 0; i < myHand.value.length; i += 1) {
    const tile = myHand.value[i]
    const key = `${tile.suit}-${tile.rank}`
    if ((counter.get(key) || 0) === 1 && tile.suit !== 'dragon' && tile.suit !== 'wind') {
      return i
    }
  }
  return myHand.value.length - 1
})

const huTilesSet = computed(() => {
  const set = new Set()
  if (props.gs.huTiles && Array.isArray(props.gs.huTiles)) {
    props.gs.huTiles.forEach((t) => set.add(`${t.suit}-${t.rank}`))
  }
  return set
})

const resultText = computed(() => {
  if (!props.gs.finalWinner) return '流局'
  return props.gs.finalWinner === myId.value ? '你赢了' : '你输了'
})

const resultDetail = computed(() => {
  if (!props.gs.finalWinner) return '牌局结束，暂无赢家。'
  return props.gs.finalWinner === myId.value ? '恭喜胡牌，手气绝佳。' : '差一点点，下局继续冲。'
})

const winSummary = computed(() => {
  if (!props.gs.winInfo) return ''
  const { winnerId, sourcePlayerId, totalFan } = props.gs.winInfo
  if (sourcePlayerId && sourcePlayerId !== winnerId) {
    return `${getPlayerName(winnerId)} 点炮胡牌 · ${totalFan}番`
  }
  return `${getPlayerName(winnerId)} 自摸胡牌 · ${totalFan}番`
})

function concealedCount(playerId) {
  const count = (props.gs.hands?.[playerId] || []).length
  return Math.min(Math.max(count, 0), 14) || 13
}

function getPlayerName(playerId) {
  if (!playerId) return '未知'
  return (props.roomPlayers || []).find((p) => p.id === playerId)?.nickname || '玩家'
}

function getPlayerScore(playerId) {
  if (!playerId) return 0
  return props.gs.scores?.[playerId] ?? 1000
}

function getTileSuitClass(tile) {
  if (!tile) return ''
  const s = tile.suit
  if (s === 'man' || s === 'wan') return 'suit-wan'
  if (s === 'pin' || s === 'tong') return 'suit-tong'
  if (s === 'sou' || s === 'tiao') return 'suit-tiao'
  if (s === 'wind') return 'suit-wind'
  if (s === 'dragon') return 'suit-dragon'
  return ''
}

function getTileGlyph(tile) {
  if (!tile) return ''
  const { suit, rank } = tile
  if (suit === 'man' || suit === 'wan') return `${rank}万`
  if (suit === 'pin' || suit === 'tong') return `${rank}筒`
  if (suit === 'sou' || suit === 'tiao') return `${rank}条`
  if (suit === 'wind') return ({ 1: '东', 2: '南', 3: '西', 4: '北' })[rank] || '风'
  if (suit === 'dragon') return ({ 1: '中', 2: '发', 3: '白' })[rank] || '中'
  return `${rank || ''}`
}

function meldLabel(type) {
  if (type === 'peng') return '碰'
  if (type === 'gang' || type === 'angang' || type === 'bugang') return '杠'
  if (type === 'chi') return '吃'
  return type
}

function canHuTile(tile) {
  if (!tile) return false
  return huTilesSet.value.has(`${tile.suit}-${tile.rank}`)
}

function canSelfAction(type) {
  return selfActionOptions.value.some((o) => o.type === type)
}

function hasResponse(type) {
  if (type === 'gang') {
    return responseOptions.value.some((o) => o.type === 'gang' || o.type === 'angang' || o.type === 'bugang')
  }
  return responseOptions.value.some((o) => o.type === type)
}

function emitSelfAction(type) {
  const opt = selfActionOptions.value.find((o) => o.type === type)
  if (!opt) return
  if (opt.tile) emit('action', { type, tile: opt.tile })
  else emit('action', { type })
}

function emitSelfGang() {
  const opt = selfActionOptions.value.find((o) => o.type === 'gang' || o.type === 'angang' || o.type === 'bugang')
  if (!opt) return
  if (opt.tile) emit('action', { type: opt.type, tile: opt.tile })
  else emit('action', { type: opt.type })
}

function emitResponseByType(type) {
  if (type === 'pass') {
    emit('action', { type: 'pass' })
    return
  }
  let opt
  if (type === 'gang') {
    opt = responseOptions.value.find((o) => o.type === 'gang' || o.type === 'angang' || o.type === 'bugang')
  } else {
    opt = responseOptions.value.find((o) => o.type === type)
  }
  if (!opt) return
  if (opt.tile) emit('action', { type: opt.type, tile: opt.tile })
  else emit('action', { type: opt.type })
}

function selectTile(index) {
  if (!canDiscard.value) return
  selectedIndex.value = selectedIndex.value === index ? null : index
}

function draw() { emit('action', { type: 'draw' }) }

function discard() {
  const card = myHand.value[selectedIndex.value]
  if (!card) return
  emit('action', { type: 'discard', card })
  selectedIndex.value = null
}

// ============== Canvas 渲染 ==============

function scheduleRedraw() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = 0
    drawTable()
  })
}

function ensureCanvasSize() {
  if (!renderer || !canvasWrapRef.value) return
  const w = canvasWrapRef.value.clientWidth
  const h = 380
  if (w !== renderer._logicalWidth || h !== renderer._logicalHeight) {
    renderer.resize(w, h)
  }
}

function drawTable() {
  if (!renderer) return
  ensureCanvasSize()
  renderer.clear()
  const W = renderer._logicalWidth
  const H = renderer._logicalHeight

  // 木质外框
  renderer.drawWoodFrame(0, 0, W, H, 14)

  // 内部毡面
  const padding = 14
  const innerX = padding
  const innerY = padding
  const innerW = W - padding * 2
  const innerH = H - padding * 2

  // 玩家
  const top = seatTop.value
  const left = seatLeft.value
  const right = seatRight.value
  const bottom = seatBottom.value
  const activeId = activeSeat.value || props.gs.currentPlayer

  // 顶部玩家手牌（横排）
  if (top) {
    const tileW = 22
    const tileH = 30
    const gap = 2
    const count = Math.min(concealedCount(top.id), 13)
    const totalW = count * (tileW + gap) - gap
    const startX = innerX + (innerW - totalW) / 2
    const tilesY = innerY + 56
    for (let i = 0; i < count; i++) {
      renderer.drawMahjongBack(startX + i * (tileW + gap), tilesY, tileW, tileH, { tilt: false })
    }
    // 座位信息
    const seatX = innerX + innerW / 2 - 20
    renderer.drawSeatInfo(seatX, innerY + 4, {
      name: top.nickname,
      score: getPlayerScore(top.id),
      isCurrentTurn: top.id === activeId
    })
  }

  // 左侧玩家手牌（竖排）
  if (left) {
    const tileW = 24
    const tileH = 18
    const gap = 2
    const count = Math.min(concealedCount(left.id), 13)
    const totalH = count * (tileH + gap) - gap
    const startY = innerY + (innerH - totalH) / 2
    const tilesX = innerX + 56
    for (let i = 0; i < count; i++) {
      renderer.drawMahjongBack(tilesX, startY + i * (tileH + gap), tileW, tileH, { tilt: false })
    }
    renderer.drawSeatInfo(innerX + 4, innerY + innerH / 2 - 30, {
      name: left.nickname,
      score: getPlayerScore(left.id),
      isCurrentTurn: left.id === activeId
    })
  }

  // 右侧玩家手牌（竖排）
  if (right) {
    const tileW = 24
    const tileH = 18
    const gap = 2
    const count = Math.min(concealedCount(right.id), 13)
    const totalH = count * (tileH + gap) - gap
    const startY = innerY + (innerH - totalH) / 2
    const tilesX = innerX + innerW - 56 - tileW
    for (let i = 0; i < count; i++) {
      renderer.drawMahjongBack(tilesX, startY + i * (tileH + gap), tileW, tileH, { tilt: false })
    }
    renderer.drawSeatInfo(innerX + innerW - 44, innerY + innerH / 2 - 30, {
      name: right.nickname,
      score: getPlayerScore(right.id),
      isCurrentTurn: right.id === activeId
    })
  }

  // 中央弃牌区
  drawCenterDiscards(innerX, innerY, innerW, innerH)

  // 中心 "剩余牌数" 标签
  const labelW = 130
  const labelH = 36
  const labelX = innerX + innerW / 2 - labelW / 2
  const labelY = innerY + innerH / 2 - labelH / 2
  renderer.drawRoundRect(labelX, labelY, labelW, labelH, 18, 'rgba(20, 90, 60, 0.85)', 'rgba(255, 220, 130, 0.9)', 2)
  renderer.drawText('剩余牌数', labelX + labelW / 2, labelY + 7, {
    font: 'bold 11px "PingFang SC", sans-serif',
    color: '#dff5e3',
    align: 'center',
    baseline: 'top'
  })
  renderer.drawText(String(props.gs.remainingTiles ?? 0), labelX + labelW / 2, labelY + 21, {
    font: 'bold 14px "PingFang SC", sans-serif',
    color: '#FFD54F',
    align: 'center',
    baseline: 'top'
  })

  // 底部玩家信息
  if (bottom) {
    const seatX = innerX + innerW / 2 - 20
    const seatY = innerY + innerH - 70
    renderer.drawSeatInfo(seatX, seatY, {
      name: bottom.nickname,
      score: getPlayerScore(bottom.id),
      isCurrentTurn: bottom.id === activeId
    })
    // "我方"标签
    const tagW = 36
    const tagH = 16
    const tagX = seatX + 40 + 6
    const tagY = seatY + 4
    renderer.drawRoundRect(tagX, tagY, tagW, tagH, 8, '#FF9800')
    renderer.drawText('我方', tagX + tagW / 2, tagY + 3, {
      font: 'bold 10px "PingFang SC", sans-serif',
      color: '#fff',
      align: 'center',
      baseline: 'top'
    })
  }
}

function drawCenterDiscards(innerX, innerY, innerW, innerH) {
  const cx = innerX + innerW / 2
  const cy = innerY + innerH / 2
  const tileW = 22
  const tileH = 30
  const gap = 2
  const cols = 7
  const offset = 62 // 从中心向外距离

  const playerByPos = {
    top: seatTop.value,
    left: seatLeft.value,
    right: seatRight.value,
    bottom: seatBottom.value
  }

  // 上方弃牌（横排，从左到右）
  const topDiscards = (props.gs.discards?.[playerByPos.top?.id] || []).slice(-cols)
  topDiscards.forEach((tile, i) => {
    const tx = cx - (cols * (tileW + gap) - gap) / 2 + i * (tileW + gap)
    const ty = cy - offset - tileH
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })

  // 下方弃牌（横排，从左到右）
  const bottomDiscards = (props.gs.discards?.[playerByPos.bottom?.id] || []).slice(-cols)
  bottomDiscards.forEach((tile, i) => {
    const tx = cx - (cols * (tileW + gap) - gap) / 2 + i * (tileW + gap)
    const ty = cy + offset
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })

  // 左侧弃牌（竖排，从上到下）
  const leftRows = 5
  const leftDiscards = (props.gs.discards?.[playerByPos.left?.id] || []).slice(-leftRows)
  leftDiscards.forEach((tile, i) => {
    const tx = cx - offset - tileW
    const ty = cy - (leftRows * (tileH + gap) - gap) / 2 + i * (tileH + gap)
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })

  // 右侧弃牌（竖排，从上到下）
  const rightRows = 5
  const rightDiscards = (props.gs.discards?.[playerByPos.right?.id] || []).slice(-rightRows)
  rightDiscards.forEach((tile, i) => {
    const tx = cx + offset
    const ty = cy - (rightRows * (tileH + gap) - gap) / 2 + i * (tileH + gap)
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })
}

// ============== 生命周期 ==============

onMounted(async () => {
  await nextTick()
  if (canvasRef.value && canvasWrapRef.value) {
    const w = canvasWrapRef.value.clientWidth || 800
    renderer = new CanvasRenderer(canvasRef.value, { width: w, height: 380 })
    drawTable()
  }
  if (typeof ResizeObserver !== 'undefined' && canvasWrapRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleRedraw())
    resizeObserver.observe(canvasWrapRef.value)
  } else {
    window.addEventListener('resize', scheduleRedraw)
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (resizeObserver) resizeObserver.disconnect()
  else window.removeEventListener('resize', scheduleRedraw)
})

watch(
  () => [props.gs, props.roomPlayers, myId.value],
  () => { scheduleRedraw() },
  { deep: true }
)

watch([() => props.gs.phase, () => props.gs.currentPlayer, myHand], () => {
  if (!canDiscard.value) selectedIndex.value = null
  if (selectedIndex.value !== null && selectedIndex.value >= myHand.value.length) selectedIndex.value = null
})
</script>

<style scoped>
.mahjong-stage {
  min-height: 100vh;
  padding: 0 0 24px;
  background: linear-gradient(180deg, #E8F4FD 0%, #D6E9F8 100%);
  color: #1f2c44;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.loading {
  min-height: 86vh;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 16px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(25, 118, 210, 0.18);
  border-top-color: #1976D2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* ===== 顶部头部 ===== */
.mj-header {
  position: relative;
  height: 64px;
  padding: 0 14px;
  background: linear-gradient(180deg, #4FACFE 0%, #00C6FB 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 14px rgba(33, 150, 243, 0.32);
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 0;
  background: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
  transition: transform 0.18s ease;
}
.back-btn:hover { transform: translateX(-2px); }

.title-wrap {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
}

.title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 4px;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 60, 120, 0.45);
}

.star {
  font-size: 16px;
  color: #FFE082;
  text-shadow: 0 0 8px rgba(255, 224, 130, 0.85);
}

.score-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 22px;
  background: linear-gradient(180deg, #FFD54F, #FFA726);
  color: #5a3000;
  font-weight: 800;
  font-size: 15px;
  box-shadow: 0 4px 10px rgba(255, 152, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  border: 2px solid #fff;
}

.score-badge .coin {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(180deg, #FFE082, #FFB300);
  color: #6a3d00;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 900;
  border: 1px solid #fff;
}

/* ===== 信息条 ===== */
.info-bar {
  margin: 12px 14px 0;
  padding: 10px 16px;
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 4px 14px rgba(33, 150, 243, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid rgba(79, 172, 254, 0.18);
}

.info-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #2c3e6e;
}

.info-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 14px;
  color: #fff;
}

.info-icon.flag { background: linear-gradient(135deg, #ff7043, #f4511e); }
.info-icon.avatar { background: linear-gradient(135deg, #66BB6A, #43A047); }
.info-icon.mahjong { background: linear-gradient(135deg, #29B6F6, #0288D1); font-size: 12px; }

.info-divider {
  width: 1px;
  height: 22px;
  background: linear-gradient(180deg, transparent, rgba(33, 150, 243, 0.25), transparent);
}

/* ===== Canvas 桌面 ===== */
.table-canvas-wrap {
  margin: 12px 14px 0;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 12px 28px rgba(13, 77, 42, 0.32);
}

.game-canvas {
  display: block;
  width: 100%;
  height: 380px;
}

/* ===== 手牌区 ===== */
.hand-panel {
  margin: 14px 14px 0;
  padding: 14px 14px 16px;
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 6px 18px rgba(33, 150, 243, 0.14);
  border: 1px solid rgba(79, 172, 254, 0.18);
}

.hand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 4px;
}

.hand-label {
  font-size: 13px;
  font-weight: 800;
  color: #1976D2;
  position: relative;
  padding-left: 12px;
}
.hand-label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: linear-gradient(180deg, #4FACFE, #00C6FB);
}

.hand-count {
  font-size: 12px;
  color: #607086;
  font-weight: 700;
}

.hand-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  min-height: 96px;
}

.hand-tile {
  position: relative;
  width: 52px;
  height: 84px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: transform 0.18s ease, filter 0.18s ease;
}

.hand-tile.disabled { cursor: default; opacity: 0.78; }

.hand-tile:not(.disabled):hover { transform: translateY(-4px); }

.hand-tile.selected {
  transform: translateY(-12px);
}

.hand-tile.hint .tile-top {
  border-color: #FFB300;
  box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.15);
}

.hand-tile .tile-top {
  position: absolute;
  inset: 0 0 6px 0;
  border-radius: 8px;
  background: linear-gradient(180deg, #fefefe 0%, #f0f0f0 100%);
  border: 2px solid #d8dde3;
  display: grid;
  place-items: center;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.hand-tile.selected .tile-top {
  border-color: #FF9800;
  background: linear-gradient(180deg, #fffbe7, #fff3c4);
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.5), 0 6px 12px rgba(255, 152, 0, 0.3);
}

.hand-tile .tile-side {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 10px;
  background: linear-gradient(180deg, #c5c8cd, #9ba0a8);
  border-radius: 0 0 8px 8px;
  z-index: 1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.tile-glyph {
  font-size: 22px;
  font-weight: 900;
  font-family: "STKaiti", "KaiTi", "PingFang SC", serif;
  letter-spacing: -1px;
}

.tile-glyph.suit-wan { color: #d32f2f; }
.tile-glyph.suit-tong { color: #1565C0; }
.tile-glyph.suit-tiao { color: #2E7D32; }
.tile-glyph.suit-wind { color: #37474F; }
.tile-glyph.suit-dragon { color: #c62828; }

.hu-mark {
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 3;
  background: linear-gradient(135deg, #f44336, #d32f2f);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 10px;
  border: 1.5px solid #fff;
  box-shadow: 0 2px 6px rgba(244, 67, 54, 0.45);
  letter-spacing: 1px;
}

/* ===== 副露区 ===== */
.melds-panel {
  margin: 12px 14px 0;
  padding: 12px 14px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 14px rgba(33, 150, 243, 0.12);
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(79, 172, 254, 0.18);
  flex-wrap: wrap;
}

.melds-label {
  display: inline-block;
  padding: 5px 12px;
  background: linear-gradient(135deg, #2196F3, #1976D2);
  color: #fff;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(33, 150, 243, 0.3);
}

.melds-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  flex: 1;
}

.meld-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meld-tag {
  padding: 3px 10px;
  border-radius: 10px;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.meld-tag.peng { background: linear-gradient(135deg, #4CAF50, #388E3C); }
.meld-tag.gang,
.meld-tag.angang,
.meld-tag.bugang { background: linear-gradient(135deg, #2196F3, #1976D2); }
.meld-tag.chi { background: linear-gradient(135deg, #FF9800, #F57C00); }

.meld-tiles {
  display: flex;
  gap: 3px;
}

.meld-tile {
  width: 32px;
  height: 44px;
  background: linear-gradient(180deg, #fefefe, #ececec);
  border: 1.5px solid #d0d4da;
  border-radius: 5px;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}

.meld-tile .tile-glyph { font-size: 14px; }

/* ===== 操作按钮 ===== */
.action-bar {
  margin: 14px 14px 0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.action-btn {
  flex: 1;
  min-width: 0;
  height: 48px;
  border: 0;
  border-radius: 24px;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 4px;
  cursor: pointer;
  transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.action-btn:not(:disabled):hover { transform: translateY(-2px); filter: brightness(1.05); }
.action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.act-peng { background: linear-gradient(135deg, #4CAF50, #388E3C); box-shadow: 0 6px 14px rgba(76, 175, 80, 0.36); }
.act-gang { background: linear-gradient(135deg, #2196F3, #1976D2); box-shadow: 0 6px 14px rgba(33, 150, 243, 0.36); }
.act-hu { background: linear-gradient(135deg, #f44336, #d32f2f); box-shadow: 0 6px 14px rgba(244, 67, 54, 0.36); }
.act-discard { background: linear-gradient(135deg, #FF9800, #F57C00); box-shadow: 0 6px 14px rgba(255, 152, 0, 0.36); }
.act-pass { background: linear-gradient(135deg, #78909C, #546E7A); box-shadow: 0 6px 14px rgba(96, 125, 139, 0.32); }

.status-line {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: #4a5e85;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 24px;
  padding: 14px 16px;
  border: 1px dashed rgba(33, 150, 243, 0.35);
}

/* ===== 游戏规则按钮 ===== */
.rules-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px auto 0;
  padding: 10px 28px;
  background: #fff;
  border: 1px solid #cfd8dc;
  border-radius: 20px;
  color: #455a64;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.rules-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(33, 150, 243, 0.16);
}
.rules-icon { font-size: 14px; }

/* ===== 弹窗 ===== */
.rules-overlay,
.result-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: rgba(10, 25, 50, 0.55);
  backdrop-filter: blur(4px);
}

.rules-card,
.result-card {
  width: min(92vw, 380px);
  background: #fff;
  border-radius: 22px;
  padding: 22px 22px 18px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.32);
  text-align: center;
  color: #2c3e6e;
}

.rules-card h3,
.result-card h2 {
  margin: 0 0 12px;
  color: #1976D2;
  font-size: 22px;
}

.rules-card ul {
  margin: 0;
  padding: 0 0 0 22px;
  text-align: left;
  font-size: 14px;
  color: #4a5e85;
  line-height: 1.9;
}

.rules-close {
  margin-top: 16px;
  padding: 10px 28px;
  border: 0;
  border-radius: 22px;
  color: #fff;
  background: linear-gradient(135deg, #4FACFE, #00C6FB);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
}

.result-card p { margin: 6px 0; color: #4a5e85; }
.result-card .summary { color: #FF9800; font-weight: 800; }

.result-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.22s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
  .title { font-size: 18px; letter-spacing: 2px; }
  .info-bar { padding: 8px 10px; border-radius: 18px; }
  .info-item { font-size: 12px; gap: 6px; }
  .info-icon { width: 22px; height: 22px; font-size: 12px; }
  .game-canvas { height: 320px; }
  .hand-tile { width: 42px; height: 70px; }
  .tile-glyph { font-size: 18px; }
  .action-btn { height: 44px; font-size: 14px; letter-spacing: 2px; }
  .melds-panel { padding: 10px; gap: 8px; }
  .meld-tile { width: 26px; height: 36px; }
  .meld-tile .tile-glyph { font-size: 12px; }
}

@media (max-width: 420px) {
  .hand-tile { width: 36px; height: 62px; }
  .tile-glyph { font-size: 15px; }
  .game-canvas { height: 280px; }
}
</style>
