<template>
  <div class="game-wrapper" :class="{ 'force-landscape': isPortrait }">
    <section class="mj-board">
    <!-- 加载状态 -->
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>正在加载麻将牌桌...</p>
    </div>

    <template v-else>
      <!-- 顶部信息栏 -->
      <header class="mj-info-bar">
        <button class="back-btn" @click="$emit('back')" aria-label="返回">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="info-item">第 {{ gs.roundNumber || 1 }} 局</span>
        <span class="info-sep">|</span>
        <span class="info-item">当前: <b>{{ getPlayerName(activeSeat || gs.currentPlayer) }}</b></span>
        <span class="info-sep">|</span>
        <span class="info-item">剩余: <b>{{ gs.remainingTiles ?? 0 }}</b> 张</span>
        <span class="info-sep">|</span>
        <span class="info-item">积分: <b>{{ myScore }}</b></span>
        <button class="rules-toggle-btn" @click="showRules = !showRules">规则</button>
      </header>

      <!-- 中间Canvas牌桌区 -->
      <div class="canvas-area" ref="canvasWrapRef">
        <canvas ref="canvasRef" class="game-canvas"></canvas>
      </div>

      <!-- 底部手牌+操作区 -->
      <div class="bottom-zone">
        <!-- 左侧我方信息 -->
        <div class="my-info">
          <div class="my-avatar" :style="avatarStyle(myId)">{{ playerInitial(myId) }}</div>
          <div class="my-meta">
            <strong>{{ getPlayerName(myId) || '我' }}</strong>
            <span>{{ myHand.length }}张</span>
          </div>
        </div>

        <!-- 中间手牌区 -->
        <div class="hand-area">
          <!-- 副露展示 -->
          <div v-if="myMelds.length" class="melds-row">
            <div v-for="(meld, mi) in myMelds" :key="`meld-${mi}`" class="meld-group">
              <span class="meld-tag" :class="meld.type">{{ meldLabel(meld.type) }}</span>
              <div class="meld-tiles">
                <template v-for="(t, ti) in meld.tiles" :key="`m-${mi}-${ti}`">
                  <img
                    v-if="isMeldTileVisible(meld, ti)"
                    :src="getTileImageUrl(t)"
                    class="meld-tile-img"
                    :alt="getTileAlt(t)"
                  />
                  <img
                    v-else
                    :src="backTileUrl"
                    class="meld-tile-img"
                    alt="牌背"
                  />
                </template>
              </div>
            </div>
          </div>

          <!-- 手牌 -->
          <div
            class="hand-row"
            ref="handRowRef"
          >
            <div
              v-for="(tile, index) in myHand"
              :key="tile.id || `${tile.suit}-${tile.rank}-${index}`"
              class="hand-tile-wrap"
              :class="{
                selected: selectedIndex === index,
                'last-draw': isLastDraw(index),
                disabled: !canDiscard,
                'is-zhong': tile.suit === 'zhong'
              }"
              :data-tile-index="index"
              role="button"
              :aria-label="`${selectedIndex === index ? '打出' : '选择'}${getTileAlt(tile)}`"
              @click.stop="onTileTap(index)"
            >
              <img
                :src="getTileImageUrl(tile)"
                class="hand-tile-img"
                :alt="getTileAlt(tile)"
              />
              <span v-if="canHuTile(tile)" class="hu-mark"></span>
            </div>
            <div v-if="!myHand.length" class="hand-empty">暂无手牌</div>
          </div>
        </div>

        <!-- 右侧操作按钮 -->
        <div class="action-buttons">
          <template v-if="canDiscard">
            <button class="btn-peng" :disabled="!canSelfAction('peng')" @click="emitSelfAction('peng')">碰</button>
            <button class="btn-gang" :disabled="!canSelfAction('gang') && !canSelfAction('angang') && !canSelfAction('bugang')" @click="emitSelfGang">杠</button>
            <button class="btn-hu" :disabled="!canSelfAction('hu')" @click="emitSelfAction('hu')">胡</button>
            <button class="btn-discard" :disabled="selectedIndex === null" @click="discard">出牌</button>
          </template>

          <template v-else-if="showResponsePanel">
            <button v-if="hasResponse('peng')" class="btn-peng" @click="emitResponseByType('peng')">碰</button>
            <button v-if="hasResponse('gang')" class="btn-gang" @click="emitResponseByType('gang')">杠</button>
            <button v-if="hasResponse('hu')" class="btn-hu" @click="emitResponseByType('hu')">{{ isQianggangHu ? '抢杠胡' : '胡' }}</button>
            <button class="btn-pass" @click="emitResponseByType('pass')">过</button>
          </template>

          <template v-else-if="gs.phase === 'finished'">
            <button class="btn-draw" @click="$emit('rematch')">再来</button>
            <button class="btn-pass" @click="$emit('back')">返回</button>
          </template>

          <template v-else>
            <div class="status-label">{{ waitingText }}</div>
          </template>
        </div>
      </div>

      <!-- 规则弹窗 -->
      <transition name="modal">
        <div v-if="showRules" class="rules-overlay" @click.self="showRules = false">
          <div class="rules-card rules-card-wide">
            <h3>红中推倒胡规则</h3>
            <div class="rules-content">
              <div class="rules-section">
                <p>• 使用万、筒、条各36张 + 红中4张，共112张牌</p>
                <p>• 红中为百搭牌，可替代任何数字牌组成面子</p>
                <p>• 禁止吃牌，只能碰、杠</p>
                <p>• 推倒胡：任何合法的4面子+1雀头均可胡牌</p>
                <p>• 四红中自动胡牌</p>
              </div>
              <div class="rules-section">
                <strong>番型说明：</strong>
                <p>• 平胡 1番 | 自摸 +1番 | 杠上开花 +1番</p>
                <p>• 对对胡 2番 | 清一色 4番</p>
                <p>• 七对 4番 | 豪华七对 8番 | 四红中 4番</p>
                <p>• 抢杠胡 +1番 | 全求人 +1番</p>
                <p>• 杀鬼(无红中胡) 番数翻倍</p>
              </div>
              <div class="rules-section">
                <strong>杠分（即时结算）：</strong>
                <p>• 暗杠：三家各赔2分</p>
                <p>• 补杠：三家各赔1分</p>
                <p>• 明杠：放杠者赔3分</p>
              </div>
            </div>
            <button class="rules-close" @click="showRules = false">关闭</button>
          </div>
        </div>
      </transition>

      <!-- 结算弹窗 -->
      <transition name="modal">
        <div v-if="gs.phase === 'finished'" class="result-overlay">
          <div class="result-card">
            <h2>{{ resultText }}</h2>
            <p>{{ resultDetail }}</p>
            <div v-if="gs.winInfo && gs.winInfo.detail" class="fan-detail">
              <div v-for="f in gs.winInfo.detail" :key="f.name" class="fan-item">
                {{ f.name }} <span class="fan-num">{{ f.fan }}番</span>
              </div>
              <div class="fan-total">总计: {{ gs.winInfo.fan }}番</div>
            </div>
            <div v-if="gs.scores" class="score-changes">
              <div v-for="pid in gs.players" :key="pid" class="score-row">
                {{ getPlayerName(pid) }}: <span :class="gs.scores[pid] >= 0 ? 'score-pos' : 'score-neg'">{{ gs.scores[pid] >= 0 ? '+' : '' }}{{ gs.scores[pid] }}分</span>
              </div>
            </div>
            <div class="result-actions">
              <button class="btn-draw" @click="$emit('rematch')">再来一局</button>
              <button class="btn-pass" @click="$emit('back')">返回大厅</button>
            </div>
          </div>
        </div>
      </transition>
    </template>
  </section>
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

// ============== SVG Tile Image Mapping ==============

function getTileSvgFilename(tile) {
  if (!tile) return 'Back.svg'
  const { suit, rank } = tile

  // 红中
  if (suit === 'zhong') {
    return 'Chun.svg'
  }
  // 万子
  if (suit === 'wan') {
    const n = Number(rank)
    if (Number.isInteger(n) && n >= 1 && n <= 9) return `Man${n}.svg`
    return 'Back.svg'
  }
  // 筒子
  if (suit === 'tong') {
    const n = Number(rank)
    if (Number.isInteger(n) && n >= 1 && n <= 9) return `Pin${n}.svg`
    return 'Back.svg'
  }
  // 条子
  if (suit === 'tiao') {
    const n = Number(rank)
    if (Number.isInteger(n) && n >= 1 && n <= 9) return `Sou${n}.svg`
    return 'Back.svg'
  }
  return 'Back.svg'
}

function getTileImageUrl(tile) {
  const filename = getTileSvgFilename(tile)
  return `/assets/mahjong-tiles/Regular/${filename}`
}

const backTileUrl = '/assets/mahjong-tiles/Regular/Back.svg'

function getTileAlt(tile) {
  if (!tile) return '牌背'
  const { suit, rank } = tile
  if (suit === 'zhong') return '红中'
  if (suit === 'wan') return `${rank}万`
  if (suit === 'tong') return `${rank}筒`
  if (suit === 'tiao') return `${rank}条`
  return '牌'
}

// ============== 状态 ==============

const seatOrder = ['south', 'west', 'north', 'east']
const selectedIndex = ref(null)
const showRules = ref(false)
const isPortrait = ref(false)
const canvasRef = ref(null)
const canvasWrapRef = ref(null)
const handRowRef = ref(null)
let renderer = null
let rafId = 0
let resizeObserver = null
let autoDrawTimer = null

// ============== 计算属性 ==============

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
  if (pending.type === 'qianggang') return pending.queue?.[0]?.playerId === myId.value
  return pending.queue?.[0]?.playerId === myId.value
})

const isQianggangHu = computed(() => {
  const pending = props.gs.pendingAction
  return pending?.type === 'qianggang'
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
  const melds = props.gs.fulu?.[myId.value] || props.gs.melds?.[myId.value] || []
  return melds.map((m) => ({
    type: m.type || 'peng',
    tiles: m.cards || m.tiles || []
  }))
})

const lastDiscard = computed(() => props.gs.lastDiscard || null)

const waitingText = computed(() => {
  if (canDraw.value) return '自动摸牌中'
  if (canDiscard.value) return '出牌'
  if (props.gs.phase === 'response') return '等待响应'
  if (props.gs.phase === 'finished') return '结算'
  return '等待中'
})

const huTilesSet = computed(() => {
  const set = new Set()
  const myTing = props.gs.tingInfo?.[myId.value]
  if (myTing && Array.isArray(myTing)) {
    myTing.forEach((t) => set.add(`${t.suit}-${t.rank}`))
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
  const { winnerId, sourcePlayerId, fan } = props.gs.winInfo
  if (sourcePlayerId && sourcePlayerId !== winnerId) {
    return `${getPlayerName(winnerId)} 点炮胡牌 · ${fan}番`
  }
  return `${getPlayerName(winnerId)} 自摸胡牌 · ${fan}番`
})

// ============== 工具函数 ==============

function concealedCount(playerId) {
  const count = props.gs.handCounts?.[playerId] ?? (props.gs.hands?.[playerId] || []).length
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

function playerInitial(pid) {
  const name = getPlayerName(pid) || '我'
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

function meldLabel(type) {
  if (type === 'peng') return '碰'
  if (type === 'gang' || type === 'angang' || type === 'bugang' || type === 'minggang') return '杠'
  return type
}

function isMeldTileVisible(meld, tileIndex) {
  // 暗杠: 中间两张面朝下
  if (meld.type === 'angang') {
    return tileIndex === 0 || tileIndex === 3
  }
  return true
}

function canHuTile(tile) {
  if (!tile) return false
  return huTilesSet.value.has(`${tile.suit}-${tile.rank}`)
}

function isLastDraw(index) {
  // 最后摸的牌在手牌最末尾
  if (!props.gs.lastDraw) return false
  return index === myHand.value.length - 1
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

function onTileTap(index) {
  if (!canDiscard.value) return
  if (selectedIndex.value === index) {
    discard()
    return
  }
  selectedIndex.value = index
}

function discard() {
  const card = myHand.value[selectedIndex.value]
  if (!card) return
  emit('action', { type: 'discard', card })
  selectedIndex.value = null
}

// ============== Canvas 渲染 ==============

function queueAutoDraw() {
  if (autoDrawTimer || !canDraw.value) return
  autoDrawTimer = window.setTimeout(() => {
    autoDrawTimer = null
    if (canDraw.value) emit('action', { type: 'draw' })
  }, 120)
}

function scheduleRedraw() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = 0
    drawTable()
  })
}

function ensureCanvasSize() {
  if (!renderer || !canvasWrapRef.value) return
  const w = canvasWrapRef.value.clientWidth || 800
  const h = canvasWrapRef.value.clientHeight || 300
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

  // 木质外框 + 绿色毡面
  renderer.drawWoodFrame(0, 0, W, H, 10)

  const ctx = renderer._ctx
  // 装饰椭圆
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(W / 2, H / 2, W * 0.30, H * 0.32, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  const padding = 10
  const innerX = padding
  const innerY = padding
  const innerW = W - padding * 2
  const innerH = H - padding * 2

  const top = seatTop.value
  const left = seatLeft.value
  const right = seatRight.value
  const bottom = seatBottom.value
  const activeId = activeSeat.value || props.gs.currentPlayer

  // 顶部玩家 (横排牌背)
  if (top) {
    const tileW = 22, tileH = 30, gap = 2
    const count = Math.min(concealedCount(top.id), 13)
    const totalW = count * (tileW + gap) - gap
    const startX = innerX + (innerW - totalW) / 2
    const tilesY = innerY + 56
    for (let i = 0; i < count; i++) {
      renderer.drawMahjongBack(startX + i * (tileW + gap), tilesY, tileW, tileH, { tilt: false })
    }
    renderer.drawSeatInfo(innerX + innerW / 2 - 20, innerY + 4, {
      name: top.nickname,
      score: getPlayerScore(top.id),
      isCurrentTurn: top.id === activeId
    })
  }

  // 左侧玩家 (竖排牌背)
  if (left) {
    const tileW = 24, tileH = 18, gap = 2
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

  // 右侧玩家 (竖排牌背)
  if (right) {
    const tileW = 24, tileH = 18, gap = 2
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

  // 中心剩余牌数保持轻量，避免盖住弃牌区。
  if (innerH >= 260) {
    const labelW = 92, labelH = 30
    const labelX = innerX + innerW / 2 - labelW / 2
    const labelY = innerY + innerH / 2 - labelH / 2
    renderer.drawRoundRect(labelX, labelY, labelW, labelH, 15, 'rgba(12, 55, 38, 0.55)', 'rgba(255, 220, 130, 0.45)', 1)
    renderer.drawText('剩余', labelX + labelW / 2 - 13, labelY + 9, {
      font: 'bold 11px "PingFang SC", sans-serif',
      color: '#dff5e3',
      align: 'right',
      baseline: 'middle'
    })
    renderer.drawText(String(props.gs.remainingTiles ?? 0), labelX + labelW / 2 - 7, labelY + 9, {
      font: 'bold 15px "PingFang SC", sans-serif',
      color: '#FFD54F',
      align: 'left',
      baseline: 'middle'
    })
  }

  // 底部我方座位信息
  if (bottom && innerH >= 240) {
    const seatX = innerX + innerW / 2 - 20
    const seatY = innerY + innerH - 70
    renderer.drawSeatInfo(seatX, seatY, {
      name: bottom.nickname,
      score: getPlayerScore(bottom.id),
      isCurrentTurn: bottom.id === activeId
    })
    const tagW = 36, tagH = 16
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
  const compact = innerH < 235
  const tileH = compact ? 18 : Math.min(26, Math.max(20, Math.floor(innerH * 0.095)))
  const tileW = Math.round(tileH * 0.72)
  const gap = compact ? 1 : 2
  const pad = compact ? 4 : 6
  const hCols = compact ? 6 : 7
  const hRows = compact ? 2 : 3
  const vCols = compact ? 3 : 4
  const vRows = compact ? 4 : 5
  const hPanelW = hCols * tileW + (hCols - 1) * gap + pad * 2
  const hPanelH = hRows * tileH + (hRows - 1) * gap + pad * 2
  const vPanelW = vCols * tileW + (vCols - 1) * gap + pad * 2
  const vPanelH = vRows * tileH + (vRows - 1) * gap + pad * 2

  const playerByPos = {
    top: seatTop.value,
    left: seatLeft.value,
    right: seatRight.value,
    bottom: seatBottom.value
  }

  const topY = innerY + (compact ? 92 : 108)
  const sideY = cy - vPanelH / 2
  const sideInset = compact ? 88 : 108
  const bottomY = innerY + innerH - hPanelH - (compact ? 8 : 14)

  drawDiscardRiver(playerByPos.top, cx - hPanelW / 2, topY, hCols, hRows, tileW, tileH, gap, pad)
  drawDiscardRiver(playerByPos.left, innerX + sideInset, sideY, vCols, vRows, tileW, tileH, gap, pad)
  drawDiscardRiver(playerByPos.right, innerX + innerW - sideInset - vPanelW, sideY, vCols, vRows, tileW, tileH, gap, pad)
  drawDiscardRiver(playerByPos.bottom, cx - hPanelW / 2, bottomY, hCols, hRows, tileW, tileH, gap, pad)
}

function drawDiscardRiver(player, x, y, cols, rows, tileW, tileH, gap, pad) {
  if (!player) return
  const maxTiles = cols * rows
  const tiles = (props.gs.discards?.[player.id] || []).slice(-maxTiles)
  if (!tiles.length) return
  const usedRows = Math.ceil(tiles.length / cols)
  const panelW = cols * tileW + (cols - 1) * gap + pad * 2
  const panelH = usedRows * tileH + Math.max(usedRows - 1, 0) * gap + pad * 2

  renderer.drawRoundRect(x, y, panelW, panelH, 8, 'rgba(4, 34, 23, 0.52)', 'rgba(218, 186, 99, 0.24)', 1)

  tiles.forEach((tile, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const tx = x + pad + col * (tileW + gap)
    const ty = y + pad + row * (tileH + gap)
    const imageUrl = getTileImageUrl(tile)
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile, imageUrl)
    if (isLastDiscard(player.id, tile)) {
      renderer.drawRoundRect(tx - 1, ty - 1, tileW + 2, tileH + 2, 4, null, '#FFD54F', 2)
    }
  })
}

function isLastDiscard(playerId, tile) {
  const last = lastDiscard.value
  if (!last || last.playerId !== playerId) return false
  const card = last.card || last.tile
  return card?.id === tile?.id || (card?.suit === tile?.suit && card?.rank === tile?.rank)
}

// ============== 生命周期 ==============

function checkOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth && window.innerWidth < 768
}

onMounted(async () => {
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {})
    }
  } catch (e) { /* ignore */ }
  await nextTick()
  if (canvasRef.value && canvasWrapRef.value) {
    const w = canvasWrapRef.value.clientWidth || 800
    const h = canvasWrapRef.value.clientHeight || 300
    renderer = new CanvasRenderer(canvasRef.value, { width: w, height: h })
    
    // 预加载所有麻将牌图片
    await preloadAllTiles()
    
    drawTable()
  }
  if (typeof ResizeObserver !== 'undefined' && canvasWrapRef.value) {
    resizeObserver = new ResizeObserver(() => scheduleRedraw())
    resizeObserver.observe(canvasWrapRef.value)
  } else {
    window.addEventListener('resize', scheduleRedraw)
  }
})

// 预加载所有麻将牌图片
async function preloadAllTiles() {
  if (!renderer) return
  
  // 生成所有可能的麻将牌
  const allTiles = []
  
  // 万子 1-9
  for (let i = 1; i <= 9; i++) {
    allTiles.push({ suit: 'wan', rank: String(i) })
  }
  // 筒子 1-9
  for (let i = 1; i <= 9; i++) {
    allTiles.push({ suit: 'tong', rank: String(i) })
  }
  // 条子 1-9
  for (let i = 1; i <= 9; i++) {
    allTiles.push({ suit: 'tiao', rank: String(i) })
  }
  // 红中
  allTiles.push({ suit: 'zhong', rank: '' })
  
  // 预加载所有图片
  const loadPromises = allTiles.map(tile => {
    const imageUrl = getTileImageUrl(tile)
    return renderer.loadImage(imageUrl).catch(() => {})
  })
  
  await Promise.all(loadPromises)
  
  // 图片加载完成后重新渲染
  scheduleRedraw()
}

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (autoDrawTimer) window.clearTimeout(autoDrawTimer)
  if (resizeObserver) resizeObserver.disconnect()
  else window.removeEventListener('resize', scheduleRedraw)
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
  try {
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock()
    }
  } catch (e) { /* ignore */ }
})

watch(
  () => [props.gs, props.roomPlayers, myId.value],
  () => { scheduleRedraw() },
  { deep: true }
)

watch(canDraw, (value) => {
  if (!value && autoDrawTimer) {
    window.clearTimeout(autoDrawTimer)
    autoDrawTimer = null
  }
  if (value) queueAutoDraw()
}, { immediate: true })

watch([() => props.gs.phase, () => props.gs.currentPlayer, myHand], () => {
  if (!canDiscard.value) selectedIndex.value = null
  if (selectedIndex.value !== null && selectedIndex.value >= myHand.value.length) selectedIndex.value = null
})
</script>

<style scoped>
/* 强制横屏外层容器 */
.game-wrapper {
  width: 100%;
  height: 100vh;
  height: 100dvh;
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

.mj-board {
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #0a2e1a;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #fff;
}

/* 加载 */
.loading {
  flex: 1;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 16px;
  color: #aaa;
}
.loading-spinner {
  width: 50px; height: 50px;
  border: 4px solid rgba(79, 172, 254, 0.18);
  border-top-color: #4FACFE;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 顶部信息栏 ===== */
.mj-info-bar {
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: linear-gradient(180deg, #4FACFE 0%, #00C6FB 100%);
  border-bottom: 1px solid rgba(255,255,255,0.15);
  font-size: 13px;
  z-index: 10;
}
.back-btn {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.2); color: #fff;
  display: grid; place-items: center; cursor: pointer;
  transition: background 0.15s;
}
.back-btn:hover { background: rgba(255,255,255,0.35); }
.info-item { color: #fff; white-space: nowrap; }
.info-item b { color: #FFD700; font-weight: 700; }
.info-sep { color: rgba(255,255,255,0.4); }
.rules-toggle-btn {
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 14px;
  background: rgba(255,255,255,0.15);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.rules-toggle-btn:hover { background: rgba(255,255,255,0.3); }

/* ===== Canvas牌桌区 ===== */
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

/* ===== 底部手牌+操作区 ===== */
.bottom-zone {
  flex: 0 0 auto;
  min-height: 120px;
  max-height: 35vh;
  display: flex;
  align-items: stretch;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-top: 1px solid rgba(79, 172, 254, 0.25);
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
  border: 2px solid rgba(79, 172, 254, 0.6);
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
.my-meta { text-align: center; line-height: 1.2; }
.my-meta strong { display: block; font-size: 12px; color: #e0e0e0; }
.my-meta span { font-size: 10px; color: #7aa3c7; }

/* 中间手牌区 */
.hand-area {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-width: 0;
  overflow: hidden;
}

/* 副露展示 */
.melds-row {
  display: flex;
  gap: 8px;
  max-width: 100%;
  padding: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  flex-shrink: 0;
}
.melds-row::-webkit-scrollbar { height: 3px; }
.melds-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }
.meld-group {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.meld-tag {
  padding: 2px 6px;
  border-radius: 6px;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}
.meld-tag.peng { background: linear-gradient(135deg, #4CAF50, #388E3C); }
.meld-tag.gang,
.meld-tag.angang,
.meld-tag.bugang,
.meld-tag.minggang { background: linear-gradient(135deg, #2196F3, #1976D2); }
.meld-tiles {
  display: flex;
  gap: 1px;
}
.meld-tile-img {
  height: 36px;
  width: auto;
  background: #FFFFFF;
  border-radius: 3px;
  padding: 1px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  border: 1px solid #d0d0d0;
}

/* 手牌行 */
.hand-row {
  display: flex;
  align-items: flex-end;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 8px 12px;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  min-height: 80px;
}
.hand-row::-webkit-scrollbar { height: 3px; }
.hand-row::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }

.hand-tile-wrap {
  position: relative;
  flex-shrink: 0;
  margin-left: -3px;
  cursor: pointer;
  transition: transform 0.15s ease;
  z-index: 1;
}
.hand-tile-wrap:first-child { margin-left: 0; }

/* 扩大触摸热区 */
.hand-tile-wrap::after {
  content: '';
  position: absolute;
  inset: -8px -4px;
  z-index: -1;
}

.hand-tile-wrap.last-draw {
  margin-left: 12px;
}

.hand-tile-wrap:hover,
.hand-tile-wrap:active {
  z-index: 10;
}

.hand-tile-wrap:not(.disabled):hover {
  transform: translateY(-4px);
}

.hand-tile-wrap.selected {
  transform: translateY(-12px);
  z-index: 11;
}
.hand-tile-wrap.selected .hand-tile-img {
  filter: brightness(1.1);
  box-shadow: 0 0 8px rgba(255, 152, 0, 0.6), 0 4px 10px rgba(0,0,0,0.3);
}

.hand-tile-wrap.disabled {
  cursor: default;
  opacity: 0.8;
}

/* 红中特殊标记 */
.hand-tile-wrap.is-zhong {
  border: 2px solid #FFD700;
  border-radius: 6px;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
}
.hand-tile-wrap.is-zhong .hand-tile-img {
  border-color: #FFD700;
}

.hand-tile-img {
  height: 75px;
  width: auto;
  background: #FFFFFF;
  border-radius: 4px;
  padding: 2px;
  box-shadow: 1px 2px 3px rgba(0,0,0,0.3);
  border: 1px solid #d0d0d0;
  transition: filter 0.15s, box-shadow 0.15s;
}

.hu-mark {
  position: absolute;
  top: -2px;
  right: -2px;
  z-index: 5;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f44336, #d32f2f);
  border: 1.5px solid #fff;
  box-shadow: 0 0 6px rgba(244, 67, 54, 0.6);
  animation: hu-pulse 1.2s ease-in-out infinite alternate;
}
@keyframes hu-pulse {
  from { box-shadow: 0 0 4px rgba(244, 67, 54, 0.4); }
  to { box-shadow: 0 0 10px rgba(244, 67, 54, 0.9); }
}

.hand-empty {
  width: 100%;
  text-align: center;
  color: #556;
  font-size: 13px;
  padding: 20px 0;
}

/* ===== 右侧操作按钮 ===== */
.action-buttons {
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.action-buttons button {
  min-width: 62px;
  min-height: 44px;
  width: 62px;
  height: 48px;
  border-radius: 24px;
  border: none;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: 2px;
  transition: transform 0.12s, opacity 0.2s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.32);
}
.action-buttons button:not(:disabled):hover { transform: scale(1.06); }
.action-buttons button:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-peng { background: linear-gradient(135deg, #4CAF50, #388E3C); box-shadow: 0 4px 10px rgba(76, 175, 80, 0.36); }
.btn-gang { background: linear-gradient(135deg, #2196F3, #1976D2); box-shadow: 0 4px 10px rgba(33, 150, 243, 0.36); }
.btn-hu { background: linear-gradient(135deg, #f44336, #d32f2f); box-shadow: 0 4px 10px rgba(244, 67, 54, 0.36); }
.btn-discard { background: linear-gradient(135deg, #FF9800, #F57C00); box-shadow: 0 4px 10px rgba(255, 152, 0, 0.36); }
.btn-draw { background: linear-gradient(135deg, #FF9800, #F57C00); box-shadow: 0 4px 10px rgba(255, 152, 0, 0.36); }
.btn-pass { background: linear-gradient(135deg, #78909C, #546E7A); box-shadow: 0 4px 10px rgba(96, 125, 139, 0.32); }

.status-label {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #7aa3c7;
  padding: 8px 4px;
  line-height: 1.4;
}

/* ===== 弹窗 ===== */
.rules-overlay,
.result-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  background: rgba(10, 25, 50, 0.6);
  backdrop-filter: blur(4px);
}
.rules-card,
.result-card {
  width: min(92vw, 380px);
  background: #fff;
  border-radius: 22px;
  padding: 22px 22px 18px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.32);
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
  margin: 0; padding: 0 0 0 22px;
  text-align: left; font-size: 14px;
  color: #4a5e85; line-height: 1.9;
}
.rules-card-wide {
  width: min(92vw, 460px);
  max-height: 80vh;
  overflow-y: auto;
}
.rules-content {
  text-align: left;
  font-size: 13px;
  color: #4a5e85;
  line-height: 1.7;
}
.rules-section {
  margin-bottom: 10px;
}
.rules-section strong {
  color: #1976D2;
  font-size: 14px;
}
.rules-section p {
  margin: 2px 0;
}
.rules-close {
  margin-top: 16px;
  padding: 10px 28px;
  border: 0; border-radius: 22px;
  color: #fff;
  background: linear-gradient(135deg, #4FACFE, #00C6FB);
  font-weight: 800; cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
}
.result-card p { margin: 6px 0; color: #4a5e85; }
.result-card .summary { color: #FF9800; font-weight: 800; }
.fan-detail {
  margin: 10px 0;
  padding: 10px;
  background: #f8f9fc;
  border-radius: 12px;
  text-align: left;
}
.fan-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  font-size: 14px;
  color: #4a5e85;
}
.fan-item .fan-num {
  color: #FF9800;
  font-weight: 700;
}
.fan-total {
  margin-top: 6px;
  padding: 6px 8px;
  border-top: 1px solid #e0e0e0;
  font-weight: 800;
  font-size: 15px;
  color: #1976D2;
}
.score-changes {
  margin: 10px 0;
  text-align: left;
}
.score-row {
  padding: 3px 8px;
  font-size: 13px;
  color: #4a5e85;
}
.score-pos { color: #4CAF50; font-weight: 700; }
.score-neg { color: #f44336; font-weight: 700; }
.result-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
  justify-content: center;
}
.result-actions button {
  flex: 1;
  max-width: 140px;
  height: 48px;
  border-radius: 24px;
  border: none;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  letter-spacing: 2px;
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.22s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }

/* ===== 横屏提示 (旧覆盖层已移除，使用 CSS 强制横屏) ===== */

/* Responsive */
@media (max-height: 600px) {
  .bottom-zone { min-height: 100px; max-height: 140px; }
  .hand-tile-img { height: 60px; }
  .meld-tile-img { height: 30px; }
  .action-buttons button { width: 56px; height: 40px; min-height: 40px; font-size: 12px; }
}

@media (max-width: 414px) {
  .bottom-zone {
    min-height: 100px;
    max-height: 140px;
    padding: 4px;
  }
  .hand-tile-img {
    height: 60px;
  }
  .hand-tile-wrap {
    margin-left: -2px;
  }
  .meld-tile-img {
    height: 28px;
  }
  .action-buttons {
    gap: 6px;
  }
  .action-buttons button {
    min-width: 52px;
    min-height: 42px;
    width: 52px;
    height: 42px;
    font-size: 12px;
    padding: 4px 8px;
  }
  .melds-row {
    max-width: 100%;
    overflow-x: auto;
  }
  .top-info-bar,
  .mj-info-bar {
    font-size: 12px;
    height: 36px;
    flex: 0 0 36px;
  }
}

@media (max-width: 375px) {
  .bottom-zone {
    min-height: 90px;
    max-height: 120px;
  }
  .hand-tile-img {
    height: 52px;
  }
  .hand-tile-wrap {
    margin-left: 0;
  }
  .action-buttons button {
    min-width: 48px;
    min-height: 38px;
    width: 48px;
    height: 38px;
    font-size: 11px;
  }
}

/* Expert compact mahjong table pass */
.mj-board {
  background:
    radial-gradient(circle at 50% 8%, rgba(46, 188, 119, 0.16), transparent 32%),
    linear-gradient(180deg, #0b4a2c 0%, #061f14 100%);
}

.mj-info-bar {
  flex-basis: 36px;
  min-height: 36px;
  background: linear-gradient(180deg, rgba(15, 91, 57, 0.98), rgba(8, 60, 38, 0.98));
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.rules-toggle-btn {
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 800;
}

.canvas-area {
  margin: 4px 6px 0;
  border-radius: 14px;
  border: 1px solid rgba(255, 214, 114, 0.22);
}

.bottom-zone {
  position: relative;
  flex: 0 0 clamp(112px, 28vh, 132px);
  min-height: 112px;
  max-height: 132px;
  display: grid;
  grid-template-columns: clamp(50px, 8vw, 62px) minmax(0, 1fr);
  gap: 6px;
  margin: 4px 6px 5px;
  padding: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(16, 63, 43, 0.98), rgba(8, 38, 27, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 12px 24px rgba(0, 0, 0, 0.2);
}

.my-info {
  flex: none;
  min-width: 0;
  align-self: stretch;
  justify-content: flex-end;
  padding: 5px 3px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.09);
}

.my-avatar {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.78);
  font-size: 13px;
}

.my-meta strong {
  max-width: 54px;
  color: #fff;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-meta span {
  color: #8ee9b8;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.hand-area {
  min-width: 0;
  padding-top: 32px;
  overflow: hidden;
}

.melds-row {
  min-height: 0;
  max-height: 24px;
  padding: 0 2px 1px;
  gap: 4px;
  scrollbar-width: none;
}

.melds-row::-webkit-scrollbar {
  display: none;
}

.meld-tile-img {
  height: 22px;
  border-radius: 3px;
}

.meld-tag {
  padding: 2px 5px;
  border-radius: 999px;
  font-size: 10px;
}

.hand-row {
  min-height: 58px;
  padding: 4px 4px 1px;
  overflow-x: auto;
  overflow-y: visible;
  touch-action: pan-x;
  scrollbar-width: none;
}

.hand-row::-webkit-scrollbar {
  display: none;
}

.hand-tile-wrap {
  margin-left: -3px;
  touch-action: pan-x;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  filter: drop-shadow(0 7px 8px rgba(0, 0, 0, 0.16));
}

.hand-tile-wrap:not(.disabled) {
  touch-action: manipulation;
}

.hand-tile-wrap:first-child {
  margin-left: 0;
}

.hand-tile-wrap.last-draw {
  margin-left: 7px;
}

.hand-tile-wrap.selected {
  transform: translateY(-7px);
}

.hand-tile-img {
  height: clamp(48px, 12.8vh, 58px);
  padding: 1px;
  border-radius: 5px;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.hand-tile-wrap.is-zhong {
  border-width: 1px;
  border-radius: 6px;
}

.hu-mark {
  width: 11px;
  height: 11px;
}

.action-buttons {
  position: absolute;
  top: 6px;
  left: clamp(62px, 9vw, 76px);
  right: 8px;
  z-index: 12;
  flex: none;
  height: 28px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  pointer-events: none;
}

.action-buttons button {
  flex: 0 1 76px;
  width: auto;
  min-width: 50px;
  max-width: 86px;
  height: 28px;
  min-height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 13px;
  letter-spacing: 0;
  line-height: 1;
  pointer-events: auto;
}

.btn-draw,
.btn-discard {
  background: linear-gradient(180deg, #ffbd51, #ec8616);
}

.btn-peng {
  background: linear-gradient(180deg, #5fdc89, #1f9e54);
}

.btn-gang {
  background: linear-gradient(180deg, #53c9ff, #197ed6);
}

.btn-hu {
  background: linear-gradient(180deg, #ff6d62, #d9342b);
}

.btn-pass {
  background: linear-gradient(180deg, #a8b3b8, #69777e);
}

.status-label {
  min-width: 108px;
  padding: 8px 14px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.76);
  background: rgba(0, 0, 0, 0.24);
  pointer-events: auto;
}

@media (min-width: 900px) {
  .hand-row {
    justify-content: center;
  }
}

@media (max-width: 720px) {
  .mj-info-bar {
    gap: 5px;
    padding: 0 8px;
  }

  .info-sep {
    display: none;
  }

  .info-item {
    font-size: 11px;
  }

  .back-btn {
    width: 24px;
    height: 24px;
  }

  .rules-toggle-btn {
    padding: 3px 8px;
    font-size: 11px;
  }
}

@media (max-height: 500px) {
  .mj-info-bar {
    flex-basis: 32px;
    min-height: 32px;
    gap: 5px;
    padding: 0 8px;
    font-size: 12px;
  }

  .canvas-area {
    margin: 3px 5px 0;
  }

  .bottom-zone {
    flex-basis: 104px;
    min-height: 104px;
    max-height: 104px;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 5px;
    margin: 3px 5px 4px;
    padding: 5px;
  }

  .my-avatar {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .my-meta strong {
    max-width: 42px;
    font-size: 10px;
  }

  .my-meta span {
    font-size: 10px;
  }

  .hand-area {
    padding-top: 29px;
  }

  .action-buttons {
    top: 5px;
    left: 58px;
    right: 7px;
    height: 26px;
    gap: 5px;
  }

  .action-buttons button {
    flex-basis: 66px;
    max-width: 74px;
    min-width: 46px;
    height: 26px;
    min-height: 26px;
    padding: 0 7px;
    font-size: 12px;
  }

  .melds-row {
    max-height: 20px;
  }

  .meld-tile-img {
    height: 18px;
  }

  .hand-row {
    min-height: 52px;
    padding-top: 3px;
  }

  .hand-tile-img {
    height: clamp(42px, 11.8vh, 50px);
  }

  .hand-tile-wrap.selected {
    transform: translateY(-6px);
  }
}
</style>
