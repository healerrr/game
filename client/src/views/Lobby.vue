<template>
  <main class="lobby-page">
    <div class="lobby-shell">
      <section class="hero-strip">
        <div class="hero-top">
          <div class="brand-lockup">
            <p class="eyebrow">Team Building Arcade</p>
            <h1>小游戏大厅</h1>
          </div>

          <div class="hero-actions">
            <button type="button" class="icon-action" @click="$router.push('/leaderboard')">
              <img src="/assets/lobby/feature-ranking.png" alt="今日排行" />
            </button>
          </div>
        </div>

        <div class="player-row">
          <div class="avatar-badge">{{ playerInitial }}</div>

          <div class="player-copy">
            <div class="player-title">
              <strong>{{ player?.nickname || '游客' }}</strong>
              <span class="bus-tag">{{ player?.busNumber || '-' }}号车</span>
            </div>
            <p>轻松开局，实时积分，随时和机器人来一局。</p>
          </div>
        </div>

        <div class="score-band">
          <div class="score-main">
            <span class="score-kicker">当前积分</span>
            <strong>{{ player?.points ?? 0 }}</strong>
          </div>

          <div class="score-side">
            <button type="button" class="create-room-hero-btn" @click="openCreateRoom">
              <span>创建房间</span>
            </button>
          </div>
        </div>
      </section>

      <section class="games-panel">
        <h2 class="games-heading">快速开始</h2>
        <div class="games-grid">
          <button
            v-for="game in gameCards"
            :key="game.key"
            type="button"
            class="game-tile"
            :aria-label="game.name"
            @click="joinGame(game.key)"
          >
            <div class="game-tile__wrapper">
              <img :src="game.image" :alt="game.name" class="game-tile__image" />
              <div class="game-tile__overlay">
                <span class="game-tile__fee">门票 {{ game.entryFee }}分</span>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section class="utility-panel">
        <button
          v-for="item in utilities"
          :key="item.key"
          type="button"
          class="utility-item"
          @click="handleUtility(item)"
        >
          <img :src="item.icon" :alt="item.label" class="utility-item__icon" />
          <div class="utility-item__copy">
            <strong>{{ item.label }}</strong>
            <span>{{ item.desc }}</span>
          </div>
        </button>
      </section>

      <p class="footer-tip">积极参与，赢取积分，兑换丰厚好礼。</p>

      <transition name="fade">
        <div v-if="matching" class="overlay" @click="cancelMatch">
          <div class="dialog" @click.stop>
            <div class="spinner"></div>
            <h3>正在创建房间</h3>
            <p>{{ selectedGameName }}</p>
            <button type="button" class="dialog-btn" @click="cancelMatch">取消匹配</button>
          </div>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="showRules" class="overlay" @click="showRules = false">
          <div class="dialog dialog--left" @click.stop>
            <h3>活动规则</h3>
            <p>点击任意游戏即可和机器人快速开局，结算后积分会同步更新。</p>
            <p>排行榜实时刷新，积分记录、我的战绩和兑奖区保留入口，后续可继续扩展。</p>
            <button type="button" class="dialog-btn" @click="showRules = false">知道了</button>
          </div>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="showCreateRoom" class="overlay" @click="showCreateRoom = false">
          <div class="dialog dialog--left" @click.stop>
            <h3>创建房间</h3>
            <p>选择游戏后进入候场房，可在房间内邀请在线玩家。</p>
            <div class="create-game-list">
              <button
                v-for="game in gameCards"
                :key="`create-${game.key}`"
                type="button"
                @click="createRoom(game.key)"
              >
                <span>{{ game.name }}</span>
                <strong>{{ game.entryFee }}分</strong>
              </button>
            </div>
          </div>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="showReward" class="overlay" @click="showReward = false">
          <div class="dialog" @click.stop>
            <h3>奖励中心</h3>
            <p>今日继续参与游戏可累计更多积分，用于后续兑奖。</p>
            <div class="reward-stats">
              <div>
                <span>当前积分</span>
                <strong>{{ player?.points ?? 0 }}</strong>
              </div>
              <div>
                <span>今日目标</span>
                <strong>2000</strong>
              </div>
            </div>
            <button type="button" class="dialog-btn" @click="showReward = false">继续加油</button>
          </div>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>
      </transition>
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gameState, getPlayer, getPlayMode, socket } from '../socket'

import cardChineseChess from '../../img/card_chinese_chess_transparent.png'
import cardDoudizhu from '../../img/card_doudizhu.png'
import cardEggSmash from '../../img/card_egg_smash.png'
import cardGoldenFlower from '../../img/card_golden_flower_transparent.png'
import cardGomoku from '../../img/card_gomoku.png'
import cardMahjong from '../../img/card_mahjong.png'
import cardQuickQa from '../../img/card_quick_qa_transparent.png'
import cardScissorsRockPaper from '../../img/card_scissors_rock_paper.png'

const router = useRouter()
const route = useRoute()
const player = computed(() => getPlayer())
const matching = ref(false)
const selectedGameKey = ref('')
const showReward = ref(false)
const showRules = ref(false)
const showCreateRoom = ref(false)
const toastMessage = ref('')

let toastTimer = null
let matchedHandler = null
let kickedHandler = null
let requeuedHandler = null

const gameCards = [
  { key: 'rock_paper_scissors', name: '剪刀石头布', image: cardScissorsRockPaper, tag: '双人对战', entryFee: 10 },
  { key: 'quiz', name: '快问快答', image: cardQuickQa, tag: '知识竞速', entryFee: 20 },
  { key: 'gomoku', name: '五子棋', image: cardGomoku, tag: '经典棋盘', entryFee: 30 },
  { key: 'chess', name: '象棋', image: cardChineseChess, tag: '残局博弈', entryFee: 50 },
  { key: 'doudizhu', name: '斗地主', image: cardDoudizhu, tag: '经典扑克', entryFee: 60 },
  { key: 'guandan', name: '掼蛋', image: cardEggSmash, tag: '牌桌欢乐', entryFee: 100 },
  { key: 'zha_jin_hua', name: '炸金花', image: cardGoldenFlower, tag: '运气对决', entryFee: 50 },
  { key: 'mahjong', name: '红中麻将', image: cardMahjong, tag: '休闲搓牌', entryFee: 100 }
]

const utilities = [
  { key: 'leaderboard', label: '排行榜', desc: '实时排名', icon: '/assets/lobby/feature-ranking.png' },
  { key: 'results', label: '我的战绩', desc: '历史成绩', icon: '/assets/lobby/feature-achievement.png' }
]

const isTestMode = computed(() => getPlayMode() === 'test')

const selectedGameName = computed(() => {
  return gameCards.find((item) => item.key === selectedGameKey.value)?.name || '游戏对局'
})

const playerInitial = computed(() => {
  const text = player.value?.nickname || '游'
  return text.slice(0, 1)
})

onMounted(() => {
  if (!player.value) {
    router.push('/')
    return
  }

  matchedHandler = (event) => {
    const room = event.detail
    matching.value = false
    gameState.currentRoom = room
    gameState.currentGame = room.gameState
    router.push(`/game/${room.roomId}`)
  }
  kickedHandler = (event) => {
    matching.value = false
    showToast(event.detail?.message || '已返回大厅')
  }
  requeuedHandler = (event) => {
    selectedGameKey.value = event.detail?.gameType || selectedGameKey.value
    matching.value = true
    showToast(event.detail?.message || '已重新匹配')
  }
  window.addEventListener('game:matched', matchedHandler)
  window.addEventListener('room:kicked', kickedHandler)
  window.addEventListener('match:requeued', requeuedHandler)

  if (route.query.matching) {
    selectedGameKey.value = String(route.query.matching)
    matching.value = true
  }
})

onBeforeUnmount(() => {
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
  if (matchedHandler) window.removeEventListener('game:matched', matchedHandler)
  if (kickedHandler) window.removeEventListener('room:kicked', kickedHandler)
  if (requeuedHandler) window.removeEventListener('match:requeued', requeuedHandler)
})

function showToast(message) {
  toastMessage.value = message
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 2200)
}

function enterQuickPlayRoom(data) {
  gameState.currentRoom = {
    roomId: data.roomId,
    gameType: data.gameType,
    players: data.players,
    gameState: data.gameState
  }
  gameState.currentGame = data.gameState
  socket.emit('room:join', { roomId: data.roomId })
  router.push(`/game/${data.roomId}`)
}

function joinGame(gameType) {
  if (!player.value || matching.value) return

  selectedGameKey.value = gameType
  matching.value = true

  if (!isTestMode.value) {
    socket.emit('match:join', { gameType }, (res) => {
      if (res?.error) {
        matching.value = false
        if (res.currentRoom?.roomId) {
          gameState.currentRoom = res.currentRoom
          gameState.currentGame = res.currentRoom.gameState
          router.push(`/game/${res.currentRoom.roomId}`)
          return
        }
        showToast(res.error)
      }
    })
    return
  }

  fetch('/api/bots/quick-play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: player.value.id, gameType })
  })
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '启动失败')
      return data
    })
    .then((data) => {
      matching.value = false
      enterQuickPlayRoom(data)
    })
    .catch((err) => {
      matching.value = false
      showToast(err.message || '启动游戏失败')
    })
}

function createRoom(gameType) {
  showCreateRoom.value = false
  selectedGameKey.value = gameType
  socket.emit('room:create', { gameType }, (res) => {
    if (res?.error) {
      showToast(res.error)
      return
    }
    if (res?.room) {
      gameState.currentRoom = res.room
      gameState.currentGame = res.room.gameState
      socket.emit('room:join', { roomId: res.room.roomId })
      router.push(`/game/${res.room.roomId}`)
    }
  })
}

function openCreateRoom() {
  showCreateRoom.value = true
}

function cancelMatch() {
  socket.emit('match:cancel', { gameType: selectedGameKey.value || 'rock_paper_scissors' }, () => {
    matching.value = false
  })
}

function handleUtility(item) {
  if (item.key === 'leaderboard') {
    router.push('/leaderboard')
    return
  }

  if (item.key === 'results') {
    router.push('/results')
    return
  }

  if (item.key === 'create') {
    openCreateRoom()
    return
  }

  if (item.key === 'reward') {
    showReward.value = true
    return
  }

  const messages = {
    record: '积分记录功能即将开放',
    results: '我的战绩功能即将开放'
  }
  showToast(messages[item.key] || `${item.label} 即将开放`)
}
</script>

<style scoped>
.lobby-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.34), transparent 28%),
    linear-gradient(180deg, #0a63ef 0%, #2aa6ff 36%, #e8f8ff 100%);
  padding: 14px 10px 22px;
  overflow-x: hidden;
}

.lobby-shell {
  width: min(100%, 430px);
  margin: 0 auto;
}

.hero-strip {
  position: relative;
  padding: 16px 16px 14px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 16% 16%, rgba(255, 255, 255, 0.22), transparent 18%),
    radial-gradient(circle at 86% 10%, rgba(255, 210, 95, 0.28), transparent 14%),
    linear-gradient(165deg, #136cff 0%, #068be8 52%, #4cc2ff 100%);
  color: #fff;
  box-shadow: 0 18px 36px rgba(3, 74, 180, 0.24);
  overflow: hidden;
}

.hero-strip::before,
.hero-strip::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.hero-strip::before {
  width: 140px;
  height: 140px;
  right: -46px;
  top: -54px;
  background: rgba(255, 255, 255, 0.1);
}

.hero-strip::after {
  width: 120px;
  height: 120px;
  left: -42px;
  bottom: -58px;
  background: rgba(255, 255, 255, 0.08);
}

.hero-top,
.player-row,
.score-band {
  position: relative;
  z-index: 1;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.brand-lockup h1,
.brand-lockup p,
.player-copy p,
.player-title,
.score-band {
  margin: 0;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.78;
}

.brand-lockup h1 {
  margin-top: 4px;
  font-size: 30px;
  line-height: 1.05;
  font-weight: 900;
}

.hero-actions {
  display: flex;
  gap: 8px;
}

.icon-action {
  border: none;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24);
  padding: 6px;
}

.icon-action img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.player-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}

.avatar-badge {
  width: 56px;
  height: 56px;
  border-radius: 20px;
  background: linear-gradient(180deg, #fff3d5, #ffc866);
  color: #0a58e9;
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 900;
  box-shadow: 0 10px 18px rgba(0, 51, 133, 0.16);
}

.player-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.player-title strong {
  font-size: 21px;
  line-height: 1.1;
}

.bus-tag {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
}

.player-copy p {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.88);
}

.score-band {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.score-kicker {
  display: block;
  font-size: 12px;
  font-weight: 700;
  opacity: 0.82;
}

.score-main strong {
  display: block;
  margin-top: 4px;
  font-size: 42px;
  line-height: 0.92;
  font-weight: 900;
  color: #fff2be;
  text-shadow: 0 4px 14px rgba(0, 52, 135, 0.26);
}

.score-side {
  flex: 0 0 auto;
}

.create-room-hero-btn {
  min-width: 112px;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #dff0ff);
  color: #1162e8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.9),
    0 8px 0 rgba(6, 84, 198, 0.22),
    0 14px 22px rgba(0, 61, 153, 0.18);
}

.create-room-hero-btn span {
  font-size: 16px;
  line-height: 1.1;
  font-weight: 900;
  white-space: nowrap;
}

.games-panel {
  margin-top: 14px;
  padding: 12px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 34px rgba(8, 72, 167, 0.12);
}

.games-heading {
  margin: 0 0 10px;
  color: #153260;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 8px;
}

.game-tile {
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
}

.game-tile__wrapper {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  padding-bottom:16px;
}

.game-tile__image {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 20px;
}

.game-tile__overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 4px 8px;
  display: flex;
  justify-content: center;
  border-radius: 0 0 20px 20px;
}

.game-tile__fee {
  font-size: 10px;
  font-weight: 900;
  color: #ffd700;
  line-height: 1.1;
}

.utility-panel {
  margin-top: 12px;
  padding: 10px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  box-shadow: 0 14px 34px rgba(8, 72, 167, 0.12);
}

.utility-item {
  min-height: 72px;
  padding: 10px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fbff, #eef6ff);
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  text-align: left;
}

.utility-item__icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.utility-item__copy strong,
.utility-item__copy span {
  display: block;
}

.utility-item__copy strong {
  color: #153260;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 800;
}

.utility-item__copy span {
  margin-top: 4px;
  color: #7a94bc;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 700;
}

.footer-tip {
  margin: 12px 0 0;
  text-align: center;
  color: #eff8ff;
  font-size: 12px;
  font-weight: 700;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(8, 28, 66, 0.48);
  display: grid;
  place-items: center;
  padding: 20px;
}

.dialog {
  width: min(92vw, 360px);
  border-radius: 24px;
  padding: 20px 18px;
  text-align: center;
  background: linear-gradient(180deg, #ffffff, #f4f8ff);
  color: var(--text-primary);
  border: 2px solid #d6e5f8;
  box-shadow: 0 18px 30px rgba(7, 49, 129, 0.18);
}

.dialog--left {
  text-align: left;
}

.dialog h3 {
  margin: 0;
  font-size: 22px;
}

.dialog p {
  margin: 10px 0 0;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.5;
}

.spinner {
  width: 48px;
  height: 48px;
  margin: 2px auto 12px;
  border-radius: 50%;
  border: 4px solid #d5e6ff;
  border-top-color: #1f6bff;
  animation: spin 0.9s linear infinite;
}

.dialog-btn {
  margin-top: 16px;
  min-height: 44px;
  padding: 0 22px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(180deg, #2e8dff, #0a59ef);
  font-size: 15px;
  font-weight: 800;
}

.reward-stats {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.reward-stats div {
  border-radius: 14px;
  border: 1px solid #d9e8fb;
  background: #fff;
  padding: 12px 8px;
}

.reward-stats span {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.reward-stats strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  color: #0f5de8;
}

.create-game-list {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 280px;
  overflow: auto;
}

.create-game-list button {
  min-height: 52px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid #d9e8fb;
  background: #fff;
  color: #17315d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 900;
}

.create-game-list button span {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
}

.create-game-list button strong {
  color: #0f5de8;
  white-space: nowrap;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 40;
  background: rgba(13, 76, 202, 0.95);
  color: #fff;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  box-shadow: var(--shadow-strong);
  white-space: nowrap;
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
  to { transform: rotate(360deg); }
}

@media (max-width: 390px) {
  .lobby-page {
    padding-inline: 8px;
  }

  .brand-lockup h1 {
    font-size: 28px;
  }

  .player-title strong {
    font-size: 19px;
  }

  .score-main strong {
    font-size: 38px;
  }

  .games-grid {
    gap: 8px 6px;
  }

  .utility-item {
    min-height: 68px;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 8px;
  }

  .utility-item__icon {
    width: 36px;
    height: 36px;
  }
}
</style>
