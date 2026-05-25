<template>
  <div class="zjh-board">
    <div v-if="!isReady" class="loading">
      <div class="loading-spinner"></div>
      <p>游戏加载中...</p>
    </div>
    <div v-else class="game-container zjh-layout">
      <div class="top-bar zjh-info-strip">
        <div class="pot-info">
          <span class="pot-label">本局底分</span>
          <span class="pot-value">{{ gs.baseScore || gs.currentBet || 100 }} 积分</span>
        </div>
        <div class="round-info">
          <span>游戏人数</span>
          <strong>{{ roomPlayers.length || gs.players?.length || 3 }}人局</strong>
        </div>
        <div class="pot-info reward">
          <span class="pot-label">本轮奖池</span>
          <span class="pot-value">{{ gs.pot || 0 }} 积分</span>
        </div>
      </div>

      <section class="zjh-table">
        <article
          v-if="otherPlayers[0]"
          class="opponent-slot zjh-seat zjh-seat-top"
          :class="{ active: gs.currentPlayer === otherPlayers[0].id, folded: gs.foldedPlayers?.includes(otherPlayers[0].id) }"
        >
          <div class="zjh-avatar">{{ initials(otherPlayers[0]) }}</div>
          <div class="player-info">
            <div class="player-name">{{ otherPlayers[0].nickname || '玩家A' }}</div>
            <div class="player-status">
              <span v-if="gs.foldedPlayers?.includes(otherPlayers[0].id)" class="status-folded">已弃牌</span>
              <span v-else-if="gs.lookedPlayers?.includes(otherPlayers[0].id)" class="status-looked">已看牌</span>
              <span v-else class="status-blind">暗牌</span>
            </div>
          </div>
          <div class="cards-row"><div v-for="i in 3" :key="i" class="card-back"></div></div>
        </article>

        <article
          v-if="otherPlayers[1]"
          class="opponent-slot zjh-seat zjh-seat-left"
          :class="{ active: gs.currentPlayer === otherPlayers[1].id, folded: gs.foldedPlayers?.includes(otherPlayers[1].id) }"
        >
          <div class="zjh-avatar">{{ initials(otherPlayers[1]) }}</div>
          <div class="player-info">
            <div class="player-name">{{ otherPlayers[1].nickname || '玩家B' }}</div>
            <div class="player-status">
              <span v-if="gs.foldedPlayers?.includes(otherPlayers[1].id)" class="status-folded">已弃牌</span>
              <span v-else-if="gs.lookedPlayers?.includes(otherPlayers[1].id)" class="status-looked">已看牌</span>
              <span v-else class="status-blind">暗牌</span>
            </div>
          </div>
          <div class="cards-row side-cards"><div v-for="i in 3" :key="i" class="card-back"></div></div>
        </article>

        <article
          v-if="otherPlayers[2]"
          class="opponent-slot zjh-seat zjh-seat-right"
          :class="{ active: gs.currentPlayer === otherPlayers[2].id, folded: gs.foldedPlayers?.includes(otherPlayers[2].id) }"
        >
          <div class="zjh-avatar">{{ initials(otherPlayers[2]) }}</div>
          <div class="player-info">
            <div class="player-name">{{ otherPlayers[2].nickname || '我' }}</div>
            <div class="player-status">
              <span v-if="gs.foldedPlayers?.includes(otherPlayers[2].id)" class="status-folded">已弃牌</span>
              <span v-else-if="gs.lookedPlayers?.includes(otherPlayers[2].id)" class="status-looked">已看牌</span>
              <span v-else class="status-blind">暗牌</span>
            </div>
          </div>
          <div class="cards-row side-cards"><div v-for="i in 3" :key="i" class="card-back"></div></div>
        </article>

        <div class="pot-display zjh-pot">
          <span class="pot-kicker">本轮奖池</span>
          <strong>{{ gs.pot || 0 }}</strong>
          <span>积分</span>
          <small>底分：{{ gs.baseScore || gs.currentBet || 100 }} 积分</small>
        </div>

        <div class="turn-indicator zjh-turn">
          {{ gs.phase === 'bet' && gs.currentPlayer === player?.id ? '轮到你操作' : (gs.phase === 'look' ? '准备阶段' : `等待 ${getPlayerName(gs.currentPlayer)} 操作`) }}
        </div>

        <div class="my-area zjh-my">
          <div class="my-cards">
            <div
              v-for="(card, index) in displayHand"
              :key="index"
              class="my-card"
              :class="{ revealed: myLooked }"
            >
              <div v-if="myLooked" class="card-front">
                <div class="card-corner top-left">
                  <span class="card-rank">{{ getRankLabel(card.value) }}</span>
                  <span class="card-suit" :class="getSuitColor(card.suit)">{{ getSuitSymbol(card.suit) }}</span>
                </div>
                <div class="card-center" :class="getSuitColor(card.suit)">
                  {{ getSuitSymbol(card.suit) }}
                </div>
                <div class="card-corner bottom-right">
                  <span class="card-rank">{{ getRankLabel(card.value) }}</span>
                  <span class="card-suit" :class="getSuitColor(card.suit)">{{ getSuitSymbol(card.suit) }}</span>
                </div>
              </div>
              <div v-else class="card-back-large"></div>
            </div>
          </div>

          <div v-if="myLooked" class="hand-type">{{ handTypeLabel }}</div>
          <div v-else class="hand-type blind">暗牌中</div>
        </div>
      </section>

      <div class="zjh-toolbar">
        <button class="tool-pill">游戏规则</button>
        <button class="tool-pill">排行榜</button>
        <button class="tool-pill">聊天</button>
        <button class="tool-pill" @click="$emit('back')">退出游戏</button>
      </div>

      <!-- 操作按钮区域 -->
      <div v-if="gs.phase === 'look'" class="action-bar">
        <button v-if="!myLooked" class="btn btn-peek" @click="$emit('action', { type: 'peek' })">
          看牌
        </button>
        <button class="btn btn-ready" @click="$emit('action', { type: 'ready' })">
          准备好了
        </button>
      </div>

      <div v-else-if="gs.phase === 'bet'" class="action-bar">
        <div class="cost-display">
          <span>跟注 {{ callCost }}</span>
          <span>加注 {{ raiseCost }}</span>
          <span>比牌 {{ compareCost }}</span>
        </div>
        
        <div v-if="gs.currentPlayer === player?.id && !gs.foldedPlayers?.includes(player?.id)" class="action-buttons">
          <button v-if="!myLooked" class="btn btn-peek" @click="$emit('action', { type: 'peek' })">
            看牌
          </button>
          <button class="btn btn-fold" @click="$emit('action', { type: 'fold' })">
            弃牌
          </button>
          <button class="btn btn-call" @click="$emit('action', { type: 'call' })">
            跟注
          </button>
          <button class="btn btn-raise" @click="$emit('action', { type: 'raise' })">
            加注
          </button>
          <button class="btn btn-compare" @click="showCompare = !showCompare">
            比牌
          </button>
        </div>
        
        <div v-else class="waiting-text">
          {{ gs.foldedPlayers?.includes(player?.id) ? '你已弃牌' : `等待 ${getPlayerName(gs.currentPlayer)} 操作...` }}
        </div>

        <div v-if="showCompare && activeOpponents.length" class="compare-panel">
          <button
            v-for="pid in activeOpponents"
            :key="pid"
            class="btn btn-compare-target"
            @click="compareWith(pid)"
          >
            比 {{ getPlayerName(pid) }}
          </button>
        </div>
      </div>

      <!-- 结算面板 -->
      <transition name="modal">
        <div v-if="gs.phase === 'finished'" class="result-panel">
          <div class="result-content">
            <div class="result-icon" :class="winnerClass">
              <span v-if="gs.finalWinner === player?.id"></span>
              <span v-else></span>
            </div>
            <h2 class="result-title">{{ resultText }}</h2>
            <p class="result-detail">{{ resultDetail }}</p>
            <div class="result-actions">
              <button class="btn btn-primary" @click="$emit('rematch')">
                再来一局
              </button>
              <button class="btn btn-secondary" @click="$emit('back')">
                返回大厅
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'rematch', 'back'])

const showCompare = ref(false)

const isReady = computed(() => {
  return props.gs && props.gs.hands && props.gs.players
})

const myId = computed(() => props.player?.id || '')
const myLooked = computed(() => !!props.player?.id && !!props.gs.lookedPlayers?.includes(props.player.id))
const displayHand = computed(() => {
  if (!props.player?.id) return []
  return props.gs.hands?.[props.player.id] || []
})

const otherPlayers = computed(() => {
  return (props.roomPlayers || []).filter(p => p.id !== props.player?.id)
})

const activeOpponents = computed(() => {
  return (props.gs.activePlayers || []).filter(pid => pid !== props.player?.id)
})

const callCost = computed(() => (props.gs.currentBet || 0) * (myLooked.value ? 1 : 2))
const raiseCost = computed(() => ((props.gs.currentBet || 0) + (props.gs.raiseStep || 10)) * (myLooked.value ? 1 : 2))
const compareCost = computed(() => callCost.value * 2)

const winnerClass = computed(() => {
  if (props.gs.finalWinner === myId.value) return 'winner'
  return 'loser'
})

const resultText = computed(() => {
  if (!props.gs.finalWinner) return ''
  if (props.gs.finalWinner === myId.value) return '你赢了'
  return '你输了'
})

const resultDetail = computed(() => {
  if (!props.gs.finalWinner) return ''
  if (props.gs.finalWinner === myId.value) return '恭喜！赢得本局！'
  return '再接再厉，下一局会更好'
})

function getPlayerName(pid) {
  const item = (props.roomPlayers || []).find(p => p.id === pid)
  return item?.nickname || '未知'
}

function compareWith(pid) {
  showCompare.value = false
  emit('action', { type: 'compare', targetId: pid })
}

function initials(item) {
  return (item?.nickname || '玩').slice(0, 1)
}

function getRankLabel(value) {
  const labels = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  }
  return labels[value] || value
}

function getSuitSymbol(suit) {
  const symbols = {
    spade: '♠',
    heart: '♥',
    club: '♣',
    diamond: '♦'
  }
  return symbols[suit] || suit
}

function getSuitColor(suit) {
  return (suit === 'heart' || suit === 'diamond') ? 'red' : 'black'
}

const handTypeLabel = computed(() => {
  const hand = displayHand.value
  if (!hand || hand.length !== 3) return ''
  
  // 确保 value 是数字类型
  const sorted = [...hand].sort((a, b) => Number(b.value) - Number(a.value))
  const v = sorted.map(card => Number(card.value))
  const s = sorted.map(card => card.suit)
  
  const flush = s[0] === s[1] && s[1] === s[2]
  const straight = (v[0] - v[1] === 1 && v[1] - v[2] === 1) || (v[0] === 14 && v[1] === 3 && v[2] === 2)
  const three = v[0] === v[1] && v[1] === v[2]
  const pair = v[0] === v[1] || v[1] === v[2]

  if (three) return '豹子'
  if (flush && straight) return '同花顺'
  if (flush) return '同花'
  if (straight) return '顺子'
  if (pair) return '对子'
  return '单张'
})
</script>

<style scoped>
.zjh-board {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: 
    radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(251, 191, 36, 0.1) 0%, transparent 50%),
    linear-gradient(180deg, #0a0e1a 0%, #1a1f35 50%, #0a0e1a 100%);
  color: #fff;
  overflow: hidden;
  position: relative;
}

.zjh-board::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #9ca3af;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.loading p {
  font-size: 16px;
  color: #9ca3af;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #fbbf24;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.game-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 12px;
  gap: 12px;
  position: relative;
  z-index: 1;
}

/* 顶部信息栏 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(30, 41, 59, 0.6);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}

.top-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.pot-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.pot-label {
  font-size: 14px;
  color: #9ca3af;
  padding: 4px 12px;
  background: rgba(156, 163, 175, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.pot-value {
  font-size: 24px;
  font-weight: 700;
  color: #fbbf24;
  text-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
}

.round-info {
  font-size: 14px;
  color: #6b7280;
  padding: 4px 12px;
  background: rgba(107, 114, 128, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(107, 114, 128, 0.3);
}

/* 对手区域 */
.opponents-area {
  display: flex;
  justify-content: space-around;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}

.opponents-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.2) 0%, transparent 100%);
  border-radius: 12px;
  pointer-events: none;
}

.opponent-slot {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 12px;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
}

.opponent-slot::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.opponent-slot.active {
  background: rgba(251, 191, 36, 0.15);
  border: 2px solid #fbbf24;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
  animation: activePulse 1.5s ease-in-out infinite;
}

@keyframes activePulse {
  0%, 100% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.2); }
  50% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.4); }
}

.opponent-slot.folded {
  opacity: 0.4;
  filter: grayscale(0.5);
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.player-info::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.player-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.player-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.status-looked {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-blind {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.status-folded {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.1);
  border: 1px solid rgba(107, 114, 128, 0.3);
}

.player-bet {
  font-size: 12px;
  color: #f59e0b;
  padding: 2px 8px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.cards-row {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.cards-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.card-back {
  width: 40px;
  height: 56px;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.card-back:hover {
  transform: translateY(-4px);
}

.card-back::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
}

.card-back::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
}

/* 中央区域 */
.center-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.center-area::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.pot-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}

.pot-display::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.pot-chips {
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  border-radius: 50%;
  box-shadow: 
    0 0 30px rgba(251, 191, 36, 0.4),
    inset 0 -4px 8px rgba(0, 0, 0, 0.2);
  position: relative;
  animation: potPulse 2s ease-in-out infinite;
}

.pot-chips::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  border: 3px dashed rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

@keyframes potPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.pot-amount {
  font-size: 20px;
  font-weight: 700;
  color: #fbbf24;
  text-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
}

/* 自己的手牌区域 */
.my-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}

.my-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.turn-indicator {
  font-size: 16px;
  font-weight: 700;
  color: #fbbf24;
  animation: pulse 1.5s ease-in-out infinite;
  padding: 8px 20px;
  background: rgba(251, 191, 36, 0.15);
  border-radius: 20px;
  border: 2px solid rgba(251, 191, 36, 0.4);
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
  text-shadow: 0 1px 2px rgba(251, 191, 36, 0.3);
}

@keyframes pulse {
  0%, 100% { 
    opacity: 1;
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
  }
  50% { 
    opacity: 0.7;
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.4);
  }
}

.my-cards {
  display: flex;
  gap: 12px;
  padding: 8px;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.my-cards::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.my-card {
  width: 80px;
  height: 112px;
  perspective: 1000px;
  transition: transform 0.3s ease;
}

.my-card:hover {
  transform: translateY(-8px);
}

.my-card.revealed {
  animation: cardReveal 0.5s ease;
}

@keyframes cardReveal {
  0% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
}

.card-front {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 8px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 2px solid #e5e7eb;
  position: relative;
  overflow: hidden;
}

.card-front::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
  pointer-events: none;
}

.card-corner {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  position: relative;
  z-index: 1;
}

.top-left {
  align-items: flex-start;
}

.bottom-right {
  align-items: flex-end;
  transform: rotate(180deg);
}

.card-rank {
  font-size: 16px;
  font-weight: 700;
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  line-height: 1;
}

.card-suit {
  font-size: 14px;
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  line-height: 1;
}

.card-suit.red {
  color: #dc2626;
  text-shadow: 0 1px 2px rgba(220, 38, 38, 0.2);
}

.card-suit.black {
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(31, 41, 55, 0.2);
}

.card-center {
  font-size: 40px;
  text-align: center;
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  line-height: 1;
}

.card-center.red {
  color: #dc2626;
  text-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
}

.card-center.black {
  color: #1f2937;
  text-shadow: 0 2px 4px rgba(31, 41, 55, 0.2);
}

.card-back-large {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
  border-radius: 8px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease;
}

.card-back-large:hover {
  transform: translateY(-4px);
}

.card-back-large::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.card-back-large::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
}

.hand-type {
  font-size: 18px;
  font-weight: 700;
  color: #fbbf24;
  text-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
  padding: 8px 16px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 20px;
  border: 1px solid rgba(251, 191, 36, 0.3);
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
}

.hand-type.blind {
  color: #6b7280;
  text-shadow: none;
  background: rgba(107, 114, 128, 0.1);
  border: 1px solid rgba(107, 114, 128, 0.3);
  box-shadow: none;
}

/* 操作按钮区域 */
.action-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.cost-display {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 16px;
  background: rgba(30, 41, 59, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.cost-display::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.cost-display span {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.cost-display span::before {
  content: '•';
  color: #fbbf24;
  font-size: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 8px;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.action-buttons::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.waiting-text {
  font-size: 14px;
  color: #6b7280;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(107, 114, 128, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(107, 114, 128, 0.3);
  position: relative;
  overflow: hidden;
}

.waiting-text::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.waiting-text::after {
  content: '';
  width: 8px;
  height: 8px;
  background: #6b7280;
  border-radius: 50%;
  animation: waitingPulse 1.5s ease-in-out infinite;
}

@keyframes waitingPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.compare-panel {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 8px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(139, 92, 246, 0.3);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
  position: relative;
  overflow: hidden;
}

.compare-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fff;
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.btn:hover::before {
  left: 100%;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.btn:active {
  transform: translateY(0);
}

.btn-peek {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.btn-ready {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-fold {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-call {
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-raise {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-compare {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-compare-target {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 结算面板 */
.result-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.result-panel .result-content {
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.result-content {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  max-width: 360px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.result-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.result-icon {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  margin: 0 auto 16px;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.result-icon::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 50%;
  border: 2px solid transparent;
}

.result-icon.winner {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);
}

.result-icon.winner::before {
  border-color: rgba(251, 191, 36, 0.6);
  animation: winnerRing 2s ease-in-out infinite;
}

@keyframes winnerRing {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.5; }
}

.result-icon.loser {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.result-title {
  color: #fff;
  font-size: 24px;
  margin-bottom: 8px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
}

.result-detail {
  color: #9ca3af;
  margin-bottom: 24px;
  font-size: 14px;
  padding: 8px 16px;
  background: rgba(156, 163, 175, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(156, 163, 175, 0.3);
  position: relative;
  overflow: hidden;
}

.result-detail::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 8px;
  background: rgba(30, 41, 59, 0.3);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.result-actions::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
  pointer-events: none;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .opponents-area {
    flex-wrap: wrap;
  }
  
  .opponent-slot {
    min-width: 120px;
  }
  
  .my-card {
    width: 70px;
    height: 98px;
  }
  
  .card-center {
    font-size: 32px;
  }
  
  .card-rank {
    font-size: 14px;
  }
  
  .card-suit {
    font-size: 12px;
  }
  
  .btn {
    padding: 10px 16px;
    font-size: 13px;
  }
  
  .pot-chips {
    width: 60px;
    height: 60px;
  }
  
  .pot-amount {
    font-size: 18px;
  }
  
  .hand-type {
    font-size: 16px;
  }
  
  .top-bar {
    flex-direction: column;
    gap: 8px;
  }
  
  .pot-info {
    width: 100%;
    justify-content: center;
  }
  
  .round-info {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .game-container {
    padding: 8px;
    gap: 8px;
  }
  
  .top-bar {
    padding: 8px 12px;
  }
  
  .pot-value {
    font-size: 20px;
  }
  
  .my-card {
    width: 60px;
    height: 84px;
  }
  
  .card-center {
    font-size: 28px;
  }
  
  .card-rank {
    font-size: 12px;
  }
  
  .card-suit {
    font-size: 10px;
  }
  
  .btn {
    padding: 8px 12px;
    font-size: 12px;
  }
  
  .cost-display {
    font-size: 12px;
    gap: 12px;
    flex-direction: column;
    align-items: center;
  }
  
  .action-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .action-buttons .btn {
    width: 100%;
  }
}

/* Reference-art refresh */
.zjh-board {
  min-height: calc(100vh - 88px);
  padding: 8px 0 22px;
  background:
    radial-gradient(circle at 20% 8%, rgba(255, 255, 255, 0.36), transparent 24%),
    linear-gradient(180deg, rgba(0, 96, 240, 0.1), rgba(255, 255, 255, 0.22) 78%);
  color: #24477d;
}

.zjh-board::before {
  background:
    linear-gradient(rgba(14, 102, 240, 0.18), rgba(14, 102, 240, 0.18)),
    url('/assets/ui-ref/zjh.png') center top / cover no-repeat;
  background-size: cover;
  opacity: 0.3;
}

.game-container {
  width: min(100%, 940px);
  height: auto;
  min-height: calc(100vh - 110px);
  margin: 0 auto;
  padding: 0;
  gap: 12px;
}

.top-bar,
.opponent-slot,
.my-area,
.action-bar {
  border: 2px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(235, 247, 255, 0.96));
  color: #24477d;
  box-shadow: var(--shadow-soft);
}

.top-bar {
  border-radius: 26px;
  padding: 12px 16px;
}

.pot-info,
.round-info,
.player-info,
.cards-row,
.my-cards,
.cost-display,
.action-buttons,
.compare-panel,
.waiting-text {
  background: #fff;
  border: 1px solid #dceafb;
}

.pot-label,
.round-info,
.player-status,
.waiting-text,
.cost-display {
  color: #4f6c98;
}

.pot-value,
.pot-amount,
.hand-type {
  color: #ff8a00;
  text-shadow: 0 2px 0 rgba(255, 255, 255, 0.8);
}

.opponents-area::before,
.top-bar::before,
.opponent-slot::before,
.player-info::before,
.cards-row::before,
.pot-display::before,
.my-area::before,
.my-cards::before,
.cost-display::before,
.action-buttons::before,
.waiting-text::before,
.compare-panel::before,
.result-content::before {
  display: none;
}

.opponent-slot {
  border-radius: 22px;
}

.opponent-slot.active {
  background: linear-gradient(180deg, #fff9df, #ffffff);
  border-color: #ffd85c;
  box-shadow: 0 0 0 4px rgba(255, 216, 92, 0.22), var(--shadow-soft);
}

.player-name {
  color: #18325f;
  font-weight: 900;
}

.center-area {
  min-height: 260px;
  border-radius: 30px;
  border: 10px solid #c78343;
  background:
    radial-gradient(circle at 50% 45%, rgba(66, 225, 191, 0.22), transparent 45%),
    linear-gradient(180deg, #17bb96, #0e8f70);
  box-shadow:
    inset 0 0 0 4px rgba(255, 222, 164, 0.24),
    var(--shadow-strong);
}

.pot-display {
  background: rgba(255, 255, 255, 0.86);
  border: 2px solid rgba(255, 226, 143, 0.8);
}

.card-back,
.card-back-large {
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2) 0 16px, transparent 17px),
    linear-gradient(135deg, #55a8ff 0%, #1264ec 100%);
  border-color: rgba(255, 255, 255, 0.65);
}

.my-area {
  border-radius: 26px;
}

.turn-indicator {
  color: #145bd8;
  background: #eaf4ff;
  border-color: #9fc8ff;
  text-shadow: none;
}

.action-bar {
  border-radius: 26px;
}

.btn {
  min-height: 50px;
  border-radius: 16px;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: 900;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.42),
    0 8px 0 rgba(0, 0, 0, 0.12),
    0 14px 20px rgba(7, 72, 166, 0.14);
}

.btn-ready,
.btn-primary,
.btn-call {
  background: linear-gradient(180deg, #2f92ff, #0758ef);
}

.btn-peek {
  background: linear-gradient(180deg, #48d3c2, #13a98e);
}

.btn-raise {
  background: linear-gradient(180deg, #ffcc54, #f39d11);
}

.result-content {
  border-radius: 26px;
  border: 2px solid var(--panel-border);
  background: linear-gradient(180deg, #ffffff, #eef7ff);
  color: #24477d;
  box-shadow: var(--shadow-strong);
}

.result-title {
  color: #145bd8;
  font-weight: 900;
  text-shadow: none;
}

.result-detail {
  color: #4f6c98;
  background: #fff;
}

/* Layout stability fixes */
.zjh-board {
  overflow-x: hidden;
}

.zjh-board::before {
  display: none;
}

.game-container,
.top-bar,
.opponents-area,
.center-area,
.my-area,
.action-bar {
  box-sizing: border-box;
}

.my-cards,
.cost-display,
.action-buttons,
.compare-panel {
  max-width: 100%;
}

@media (max-width: 760px) {
  .zjh-board {
    min-height: auto;
    padding: 0 0 14px;
  }

  .game-container {
    width: 100%;
    min-height: auto;
    padding: 0;
    gap: 10px;
  }

  .top-bar {
    gap: 8px;
    padding: 10px;
    border-radius: 20px;
  }

  .opponents-area {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 0;
  }

  .opponent-slot {
    min-width: 0;
    border-radius: 18px;
    padding: 10px;
  }

  .cards-row {
    width: 100%;
    justify-content: center;
  }

  .center-area {
    min-height: 176px;
    border-width: 6px;
    border-radius: 22px;
  }

  .pot-display {
    padding: 12px;
  }

  .pot-chips {
    width: 56px;
    height: 56px;
  }

  .my-area,
  .action-bar {
    border-radius: 20px;
    padding: 10px;
  }

  .my-cards {
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px;
    -webkit-overflow-scrolling: touch;
  }

  .my-card {
    flex: 0 0 auto;
    width: 64px;
    height: 90px;
  }

  .cost-display {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 8px;
  }

  .cost-display span {
    justify-content: center;
  }

  .action-buttons,
  .compare-panel {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .action-buttons .btn,
  .compare-panel .btn {
    width: 100%;
    min-height: 48px;
    padding: 8px 10px;
    font-size: 15px;
  }

  .result-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .action-buttons,
  .compare-panel {
    grid-template-columns: 1fr;
  }
}

/* Reference layout pass */
.zjh-board {
  padding: 0 0 18px;
  color: #12366e;
  background:
    radial-gradient(circle at 10% 10%, rgba(255, 255, 255, 0.44), transparent 20%),
    radial-gradient(circle at 88% 12%, rgba(255, 211, 78, 0.24), transparent 20%),
    linear-gradient(180deg, #0a75f4 0%, #48b8ff 38%, #edf9ff 100%);
}

.zjh-layout {
  width: min(100%, 930px);
  gap: 12px;
}

.zjh-info-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-radius: 24px;
  padding: 10px 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 244, 255, 0.96));
  border: 2px solid rgba(211, 232, 255, 0.9);
  box-shadow: 0 12px 26px rgba(8, 75, 177, 0.18);
}

.zjh-info-strip .pot-info,
.zjh-info-strip .round-info {
  min-height: 56px;
  padding: 4px 12px;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.zjh-info-strip .round-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
}

.zjh-info-strip > * + * {
  border-left: 1px solid #d6e7fb;
}

.zjh-info-strip .pot-label,
.zjh-info-strip .round-info span {
  color: #6b85ae;
  font-size: 14px;
  font-weight: 800;
}

.zjh-info-strip .pot-value,
.zjh-info-strip .round-info strong {
  color: #173a74;
  font-size: 22px;
  font-weight: 900;
}

.zjh-table {
  position: relative;
  min-height: min(620px, calc(100vh - 220px));
  border-radius: 52% 52% 34px 34px / 16% 16% 34px 34px;
  padding: 34px 24px 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.16), transparent 38%),
    linear-gradient(180deg, #53a9ff 0%, #1975ef 58%, #0961d8 100%);
  border: 14px solid #e4b36c;
  box-shadow:
    inset 0 0 0 4px rgba(255, 246, 220, 0.44),
    inset 0 22px 50px rgba(255, 255, 255, 0.16),
    0 22px 40px rgba(7, 76, 178, 0.28);
}

.zjh-table::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: inherit;
  border: 2px solid rgba(255, 255, 255, 0.2);
  pointer-events: none;
}

.zjh-seat {
  position: absolute;
  z-index: 2;
  width: 160px;
  min-width: 0;
  padding: 0;
  gap: 6px;
  background: transparent;
  border: 0;
  box-shadow: none;
  overflow: visible;
}

.zjh-seat-top {
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
}

.zjh-seat-left {
  left: 12px;
  top: 45%;
  transform: translateY(-50%);
}

.zjh-seat-right {
  right: 12px;
  top: 45%;
  transform: translateY(-50%);
}

.zjh-avatar {
  width: 76px;
  height: 76px;
  margin: 0 auto -12px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #135ee6;
  font-size: 28px;
  font-weight: 900;
  background: radial-gradient(circle at 42% 34%, #fff, #dcecff);
  border: 4px solid #fff;
  box-shadow: 0 8px 18px rgba(7, 73, 176, 0.22);
}

.zjh-seat .player-info {
  min-width: 112px;
  margin: 0 auto;
  padding: 8px 10px;
  border-radius: 16px;
  background: linear-gradient(180deg, #2f8dff, #0c58db);
  border: 2px solid rgba(255, 255, 255, 0.56);
  color: #fff;
  box-shadow: 0 8px 14px rgba(8, 65, 157, 0.22);
}

.zjh-seat .player-name,
.zjh-seat .player-status,
.zjh-seat .status-looked,
.zjh-seat .status-blind,
.zjh-seat .status-folded {
  color: #fff;
  text-shadow: none;
}

.zjh-seat .player-status {
  background: rgba(255, 255, 255, 0.16);
}

.zjh-seat .cards-row {
  margin: 6px auto 0;
  justify-content: center;
  border: 0;
  background: transparent;
}

.zjh-seat-left .side-cards,
.zjh-seat-right .side-cards {
  flex-direction: column;
  align-items: center;
}

.zjh-seat .card-back {
  width: 42px;
  height: 60px;
  border-radius: 7px;
  border: 2px solid rgba(255, 255, 255, 0.72);
}

.zjh-pot {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -50%);
  width: min(72%, 320px);
  min-height: 150px;
  justify-content: center;
  border-radius: 24px;
  background: linear-gradient(180deg, #fff5c7, #ffe1a0);
  border: 3px solid rgba(255, 255, 255, 0.8);
  color: #7b3900;
  box-shadow: 0 12px 24px rgba(107, 67, 12, 0.22);
}

.zjh-pot .pot-kicker {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  min-height: 36px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  color: #fff;
  font-weight: 900;
  background: linear-gradient(180deg, #3d92ff, #0d5bdc);
  box-shadow: 0 8px 16px rgba(9, 78, 181, 0.24);
}

.zjh-pot strong {
  color: #f36a22;
  font-size: 56px;
  line-height: 1;
  text-shadow: 0 3px 0 rgba(255, 255, 255, 0.8);
}

.zjh-pot small {
  color: #7b4a14;
  font-size: 14px;
  font-weight: 800;
}

.zjh-turn {
  position: absolute;
  left: 50%;
  top: 59%;
  transform: translateX(-50%);
  z-index: 3;
  min-height: 46px;
  padding: 0 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  color: #fff56d;
  background: linear-gradient(180deg, #237fff, #0751d4);
  border: 2px solid rgba(255, 255, 255, 0.62);
  font-size: 22px;
  font-weight: 900;
  text-shadow: 0 2px 0 rgba(0, 54, 154, 0.56);
}

.zjh-my {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 3;
  width: min(78%, 360px);
  padding: 0;
  gap: 8px;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.zjh-my .my-cards {
  justify-content: center;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
}

.zjh-my .my-card {
  width: clamp(58px, 12vw, 80px);
  height: clamp(82px, 17vw, 112px);
}

.zjh-my .hand-type {
  margin: 0 auto;
  color: #fff;
  background: rgba(14, 90, 198, 0.92);
  border: 2px solid rgba(255, 255, 255, 0.54);
}

.zjh-toolbar {
  min-height: 72px;
  padding: 8px 12px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  background: rgba(255, 255, 255, 0.96);
  border: 2px solid #d7e8fb;
  box-shadow: 0 12px 24px rgba(8, 75, 177, 0.14);
}

.tool-pill {
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fcff, #edf6ff);
  border: 1px solid #d5e6fb;
  color: #1c5fc8;
  font-size: 14px;
  font-weight: 900;
}

.zjh-layout > .action-bar {
  border-radius: 24px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.96);
  border: 2px solid #d7e8fb;
}

.zjh-layout .action-buttons {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
}

.zjh-layout .action-buttons .btn,
.zjh-layout > .action-bar > .btn {
  min-height: 70px;
  border-radius: 18px;
  font-size: 24px;
}

.zjh-layout .btn-fold {
  background: linear-gradient(180deg, #ff6767, #e73737);
}

.zjh-layout .btn-compare {
  background: linear-gradient(180deg, #ffc955, #f1980e);
}

@media (max-width: 760px) {
  .zjh-info-strip {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 8px;
  }

  .zjh-info-strip > * + * {
    border-left: 0;
    border-top: 1px solid #d6e7fb;
  }

  /* 移动端：将椭圆牌桌从绝对定位重构为 CSS Grid */
  .zjh-table {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr);
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
      ". top-seat ."
      "left-seat pot right-seat"
      "turn turn turn"
      "my-area my-area my-area";
    align-items: center;
    justify-items: center;
    gap: 10px;
    min-height: 0;
    height: auto;
    padding: 16px 10px 18px;
    border-width: 8px;
    border-radius: 36px 36px 24px 24px;
  }

  .zjh-table::before {
    inset: 10px;
  }

  .zjh-seat,
  .zjh-pot,
  .zjh-turn,
  .zjh-my {
    position: static;
    transform: none;
    left: auto;
    right: auto;
    top: auto;
    bottom: auto;
    width: 100%;
    max-width: 100%;
    margin: 0;
  }

  .zjh-seat-top { grid-area: top-seat; width: auto; max-width: 220px; }
  .zjh-seat-left { grid-area: left-seat; width: auto; max-width: 100%; }
  .zjh-seat-right { grid-area: right-seat; width: auto; max-width: 100%; }
  .zjh-pot { grid-area: pot; width: 100%; min-height: auto; }
  .zjh-turn { grid-area: turn; width: auto; max-width: 100%; }
  .zjh-my { grid-area: my-area; width: 100%; }

  .zjh-avatar {
    width: 56px;
    height: 56px;
    margin-bottom: -10px;
    font-size: 22px;
  }

  .zjh-seat .player-info {
    min-width: 0;
    padding: 6px 8px;
  }

  .zjh-seat .player-name {
    font-size: 13px;
  }

  .zjh-seat .player-status {
    font-size: 11px;
  }

  .zjh-seat .card-back {
    width: 28px;
    height: 40px;
  }

  .zjh-seat-left .side-cards,
  .zjh-seat-right .side-cards {
    flex-direction: row;
  }

  .zjh-pot {
    padding: 10px 12px;
    border-radius: 18px;
  }

  .zjh-pot .pot-kicker {
    top: -16px;
    min-height: 28px;
    padding: 0 12px;
    font-size: 12px;
  }

  .zjh-pot strong {
    font-size: 36px;
  }

  .zjh-pot small {
    font-size: 12px;
  }

  .zjh-turn {
    min-height: 38px;
    padding: 0 14px;
    font-size: 16px;
  }

  .zjh-my .my-cards {
    gap: 8px;
    justify-content: center;
    overflow: visible;
  }

  .zjh-my .my-card {
    width: clamp(58px, 16vw, 74px);
    height: clamp(82px, 22vw, 104px);
  }

  .zjh-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    min-height: auto;
  }

  .zjh-layout .action-buttons {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  }

  .zjh-layout .action-buttons .btn,
  .zjh-layout > .action-bar > .btn {
    min-height: 52px;
    font-size: 18px;
  }

  .compare-panel {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }

  .compare-panel .btn,
  .compare-panel button {
    min-width: 70px;
    min-height: 44px;
    flex: 1 1 auto;
  }
}

@media (max-width: 480px) {
  .zjh-table {
    padding: 12px 8px 14px;
    gap: 8px;
    border-width: 7px;
    border-radius: 30px 30px 20px 20px;
  }

  .zjh-avatar {
    width: 48px;
    height: 48px;
    margin-bottom: -8px;
    font-size: 18px;
  }

  .zjh-seat .player-info {
    padding: 4px 6px;
  }

  .zjh-seat .player-name {
    font-size: 12px;
  }

  .zjh-seat .player-status {
    font-size: 10px;
  }

  .zjh-seat .card-back {
    width: 24px;
    height: 34px;
  }

  .zjh-pot strong {
    font-size: 30px;
  }

  .zjh-turn {
    font-size: 14px;
    min-height: 34px;
    padding: 0 12px;
  }

  .zjh-my .my-card {
    width: clamp(56px, 15vw, 64px);
    height: clamp(78px, 21vw, 90px);
  }

  .zjh-layout .action-buttons,
  .zjh-toolbar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .zjh-layout .action-buttons .btn,
  .zjh-layout > .action-bar > .btn {
    min-height: 44px;
    font-size: 14px;
    border-radius: 14px;
  }

  .tool-pill {
    font-size: 13px;
    min-height: 40px;
  }
}

@media (max-width: 375px) {
  .zjh-table {
    padding: 10px 6px 12px;
    gap: 6px;
    border-width: 6px;
    border-radius: 24px 24px 18px 18px;
  }

  .zjh-avatar {
    width: 40px;
    height: 40px;
    margin-bottom: -6px;
    font-size: 16px;
  }

  .zjh-seat .card-back {
    width: 22px;
    height: 30px;
  }

  .zjh-pot strong {
    font-size: 26px;
  }

  .zjh-pot small,
  .zjh-pot .pot-kicker {
    font-size: 11px;
  }

  .zjh-turn {
    font-size: 13px;
    min-height: 30px;
  }

  .zjh-my .my-card {
    width: clamp(50px, 14vw, 56px);
    height: clamp(70px, 19vw, 78px);
  }

  .zjh-layout .action-buttons .btn,
  .zjh-layout > .action-bar > .btn {
    min-height: 40px;
    font-size: 13px;
  }
}

/* 竖屏低高度设备进一步收紧间距 */
@media (max-height: 667px) and (orientation: portrait) {
  .zjh-table {
    gap: 6px;
    padding: 10px 8px;
  }

  .zjh-info-strip {
    padding: 6px 10px;
  }
}
</style>
