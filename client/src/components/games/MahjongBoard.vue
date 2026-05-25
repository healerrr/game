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
        <button class="rules-toggle-btn" @click="showRules = !showRules">📖 规则</button>
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
          <div class="hand-row">
            <div
              v-for="(tile, index) in myHand"
              :key="tile.id || `${tile.suit}-${tile.rank}-${index}`"
              class="hand-tile-wrap"
              :class="{
                selected: selectedIndex === index,
                'last-draw': isLastDraw(index),
                disabled: !canDiscard
              }"
              @click="selectTile(index)"
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
          <template v-if="canDraw">
            <button class="btn-draw" @click="draw">摸牌</button>
          </template>

          <template v-else-if="canDiscard">
            <button class="btn-peng" :disabled="!canSelfAction('peng')" @click="emitSelfAction('peng')">碰</button>
            <button class="btn-gang" :disabled="!canSelfAction('gang') && !canSelfAction('angang') && !canSelfAction('bugang')" @click="emitSelfGang">杠</button>
            <button class="btn-hu" :disabled="!canSelfAction('hu')" @click="emitSelfAction('hu')">胡</button>
            <button class="btn-discard" :disabled="selectedIndex === null" @click="discard">出牌</button>
          </template>

          <template v-else-if="showResponsePanel">
            <button v-if="hasResponse('peng')" class="btn-peng" @click="emitResponseByType('peng')">碰</button>
            <button v-if="hasResponse('gang')" class="btn-gang" @click="emitResponseByType('gang')">杠</button>
            <button v-if="hasResponse('hu')" class="btn-hu" @click="emitResponseByType('hu')">胡</button>
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

      <!-- 结算弹窗 -->
      <transition name="modal">
        <div v-if="gs.phase === 'finished'" class="result-overlay">
          <div class="result-card">
            <h2>{{ resultText }}</h2>
            <p>{{ resultDetail }}</p>
            <p v-if="winSummary" class="summary">{{ winSummary }}</p>
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

  // 万子 (wan / man)
  if (suit === 'wan' || suit === 'man') {
    const n = Number(rank)
    if (Number.isInteger(n) && n >= 1 && n <= 9) return `Man${n}.svg`
    return 'Back.svg'
  }
  // 筒子 (tong / pin)
  if (suit === 'tong' || suit === 'pin') {
    const n = Number(rank)
    if (Number.isInteger(n) && n >= 1 && n <= 9) return `Pin${n}.svg`
    return 'Back.svg'
  }
  // 条子 (tiao / sou)
  if (suit === 'tiao' || suit === 'sou') {
    const n = Number(rank)
    if (Number.isInteger(n) && n >= 1 && n <= 9) return `Sou${n}.svg`
    return 'Back.svg'
  }
  // 风牌
  if (suit === 'wind') {
    const windMap = { east: 'Ton.svg', south: 'Nan.svg', west: 'Shaa.svg', north: 'Pei.svg' }
    return windMap[rank] || 'Back.svg'
  }
  // 三元牌
  if (suit === 'dragon') {
    const dragonMap = { red: 'Chun.svg', green: 'Hatsu.svg', white: 'Haku.svg' }
    return dragonMap[rank] || 'Back.svg'
  }
  return 'Back.svg'
}

function getTileImageUrl(tile) {
  const filename = getTileSvgFilename(tile)
  return new URL(`../../assets/mahjong-tiles/riichi-mahjong-tiles-master/Regular/${filename}`, import.meta.url).href
}

const backTileUrl = new URL('../../assets/mahjong-tiles/riichi-mahjong-tiles-master/Regular/Back.svg', import.meta.url).href

function getTileAlt(tile) {
  if (!tile) return '牌背'
  const { suit, rank } = tile
  if (suit === 'wan' || suit === 'man') return `${rank}万`
  if (suit === 'tong' || suit === 'pin') return `${rank}筒`
  if (suit === 'tiao' || suit === 'sou') return `${rank}条`
  if (suit === 'wind') return ({ east: '东', south: '南', west: '西', north: '北' })[rank] || '风'
  if (suit === 'dragon') return ({ red: '中', green: '发', white: '白' })[rank] || '龙'
  return '牌'
}

// ============== 状态 ==============

const seatOrder = ['south', 'west', 'north', 'east']
const selectedIndex = ref(null)
const showRules = ref(false)
const isPortrait = ref(false)
const canvasRef = ref(null)
const canvasWrapRef = ref(null)
let renderer = null
let rafId = 0
let resizeObserver = null

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
  if (canDraw.value) return '摸牌'
  if (canDiscard.value) return '出牌'
  if (props.gs.phase === 'response') return '等待响应'
  if (props.gs.phase === 'finished') return '结算'
  return '等待中'
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

// ============== 工具函数 ==============

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
  if (type === 'gang' || type === 'angang' || type === 'bugang') return '杠'
  if (type === 'chi') return '吃'
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

  // 中心 "剩余牌数" 标签
  const labelW = 130, labelH = 36
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

  // 底部我方座位信息
  if (bottom) {
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
  const tileW = 22, tileH = 30, gap = 2
  const cols = 7

  const playerByPos = {
    top: seatTop.value,
    left: seatLeft.value,
    right: seatRight.value,
    bottom: seatBottom.value
  }

  const offset = 62

  // 上方弃牌
  const topDiscards = (props.gs.discards?.[playerByPos.top?.id] || []).slice(-cols)
  topDiscards.forEach((tile, i) => {
    const tx = cx - (cols * (tileW + gap) - gap) / 2 + i * (tileW + gap)
    const ty = cy - offset - tileH
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })

  // 下方弃牌
  const bottomDiscards = (props.gs.discards?.[playerByPos.bottom?.id] || []).slice(-cols)
  bottomDiscards.forEach((tile, i) => {
    const tx = cx - (cols * (tileW + gap) - gap) / 2 + i * (tileW + gap)
    const ty = cy + offset
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })

  // 左侧弃牌
  const leftRows = 5
  const leftDiscards = (props.gs.discards?.[playerByPos.left?.id] || []).slice(-leftRows)
  leftDiscards.forEach((tile, i) => {
    const tx = cx - offset - tileW
    const ty = cy - (leftRows * (tileH + gap) - gap) / 2 + i * (tileH + gap)
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })

  // 右侧弃牌
  const rightRows = 5
  const rightDiscards = (props.gs.discards?.[playerByPos.right?.id] || []).slice(-rightRows)
  rightDiscards.forEach((tile, i) => {
    const tx = cx + offset
    const ty = cy - (rightRows * (tileH + gap) - gap) / 2 + i * (tileH + gap)
    renderer.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
  })
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
.meld-tag.bugang { background: linear-gradient(135deg, #2196F3, #1976D2); }
.meld-tag.chi { background: linear-gradient(135deg, #FF9800, #F57C00); }
.meld-tiles {
  display: flex;
  gap: 1px;
}
.meld-tile-img {
  height: 36px;
  width: auto;
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
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

.hand-tile-img {
  height: 75px;
  width: auto;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
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
</style>
