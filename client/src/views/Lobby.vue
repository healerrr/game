<template>
  <main class="lobby-page">
    <div class="lobby-container">
      <!-- 顶部装饰 -->
      <div class="top-decorations">
        <div class="flags">
          <span class="flag flag-1"></span>
          <span class="flag flag-2">🚩</span>
          <span class="flag flag-3">🚩</span>
        </div>
        <div class="balloon">🎈</div>
        <div class="confetti">
          <span class="confetti-piece"></span>
          <span class="confetti-piece"></span>
          <span class="confetti-piece"></span>
        </div>
      </div>

      <!-- 标题 -->
      <h1 class="main-title">游戏平台</h1>

      <!-- 用户信息区 -->
      <div class="user-section">
        <div class="user-info">
          <div class="avatar-wrapper">
            <img :src="playerAvatar" alt="avatar" class="user-avatar" />
          </div>
          <div class="user-details">
            <div class="user-name-row">
              <span class="greeting">Hi, {{ player?.nickname || '游客' }}</span>
              <span class="bus-badge">🚌 {{ player?.busNumber || '-' }}号车</span>
            </div>
            <p class="welcome-text">欢迎来到公司团建小游戏平台！</p>
          </div>
        </div>
        <div class="action-buttons">
          <button class="action-btn" @click="$router.push('/leaderboard')">
            <span class="action-icon"></span>
            <span class="action-text">今日排行</span>
          </button>
          <button class="action-btn" @click="showRuleHint = !showRuleHint">
            <span class="action-icon">📘</span>
            <span class="action-text">活动规则</span>
          </button>
        </div>
      </div>

      <!-- 积分展示区 -->
      <div class="score-section">
        <div class="score-card">
          <div class="score-left">
            <img src="/assets/lobby/score-trophy-left.png" alt="trophy" class="trophy-img" />
          </div>
          <div class="score-center">
            <div class="score-label">
              <span class="star">⭐</span>
              <span>当前积分</span>
              <span class="star">⭐</span>
            </div>
            <div class="score-value">{{ player?.points ?? 0 }}</div>
          </div>
          <div class="score-right">
            <img src="/assets/lobby/score-gift-right.png" alt="gift" class="gift-img" />
          </div>
        </div>
      </div>

      <!-- 游戏网格区 -->
      <div class="games-section">
        <div class="games-grid">
          <div
            v-for="game in gameCards"
            :key="game.key"
            class="game-card"
            @click="joinGame(game.key)"
          >
            <div class="game-image-wrapper">
              <img :src="game.art" :alt="game.name" class="game-image" />
            </div>
            <div class="game-name">{{ game.name }}</div>
          </div>
        </div>
      </div>

      <!-- 宣传横幅 -->
      <div class="promo-banner">
        <img src="/assets/lobby/promo-strip.png" alt="promo" class="promo-image" />
      </div>

      <!-- 底部功能区 -->
      <div class="bottom-section">
        <div class="feature-grid">
          <div class="feature-item" @click="$router.push('/leaderboard')">
            <img src="/assets/lobby/feature-record.png" alt="record" class="feature-icon-img" />
            <div class="feature-text">
              <div class="feature-title">积分记录</div>
              <div class="feature-subtitle">明细查询</div>
            </div>
          </div>
          <div class="feature-item">
            <img src="/assets/lobby/feature-achievement.png" alt="achievement" class="feature-icon-img" />
            <div class="feature-text">
              <div class="feature-title">我的战绩</div>
              <div class="feature-subtitle">历史成绩</div>
            </div>
          </div>
          <div class="feature-item" @click="$router.push('/leaderboard')">
            <img src="/assets/lobby/feature-ranking.png" alt="ranking" class="feature-icon-img" />
            <div class="feature-text">
              <div class="feature-title">排行榜</div>
              <div class="feature-subtitle">实时排名</div>
            </div>
          </div>
          <div class="feature-item" @click="showReward = true">
            <img src="/assets/lobby/feature-reward.png" alt="reward" class="feature-icon-img" />
            <div class="feature-text">
              <div class="feature-title">兑奖区</div>
              <div class="feature-subtitle">兑换好礼</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="footer-note">
        <span class="note-decoration">🎁</span>
        <span>积极参与，赢取积分，兑换丰厚好礼！</span>
        <span class="note-decoration">🎁</span>
      </div>

      <!-- 匹配弹窗 -->
      <transition name="fade">
        <div v-if="matching" class="overlay" @click="cancelMatch">
          <div class="loading-box">
            <div class="spinner"></div>
            <h3>正在创建房间</h3>
            <p>{{ selectedGameName }}</p>
            <button class="confirm-btn" @click.stop="cancelMatch">取消匹配</button>
          </div>
        </div>
      </transition>

      <!-- 奖励弹窗 -->
      <transition name="fade">
        <div v-if="showReward" class="overlay" @click.self="showReward = false">
          <div class="reward-box">
            <h3>奖励中心</h3>
            <p>参与游戏即可累积积分，排名越高，可兑换的奖品越丰富。</p>
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
            <button class="confirm-btn" @click="showReward = false">知道了</button>
          </div>
        </div>
      </transition>

      <!-- 规则提示 -->
      <transition name="fade">
        <div v-if="showRuleHint" class="toast">
          推荐先体验：猜数字、快问快答、掼蛋、红中麻将
        </div>
      </transition>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gameState, getPlayer, socket } from '../socket'

const router = useRouter()
const player = computed(() => getPlayer())
const matching = ref(false)
const selectedGameKey = ref('')
const showReward = ref(false)
const showRuleHint = ref(false)
const avatarPalette = [
  '/assets/mahjong-theme/avatars/yun.png',
  '/assets/mahjong-theme/avatars/xu.png',
  '/assets/mahjong-theme/avatars/ling.png',
  '/assets/mahjong-theme/avatars/wan.png'
]

const gameCards = [
  { key: 'rock_paper_scissors', name: '剪刀石头布', art: '/assets/lobby/game-rps-card.png' },
  { key: 'guess_number', name: '猜数字', art: '/assets/lobby/game-guess-card.png' },
  { key: 'quiz', name: '快问快答', art: '/assets/lobby/game-quiz-card.png' },
  { key: 'gomoku', name: '五子棋', art: '/assets/lobby/game-gomoku-card.png' },
  { key: 'chess', name: '象棋', art: '/assets/lobby/game-chess-card.png' },
  { key: 'guandan', name: '掼蛋', art: '/assets/lobby/game-guandan-card.png' },
  { key: 'zha_jin_hua', name: '炸金花', art: '/assets/lobby/game-zjh-card.png' },
  { key: 'mahjong', name: '红中麻将', art: '/assets/lobby/game-mahjong-card.png' }
]

const selectedGameName = computed(() => {
  return gameCards.find((item) => item.key === selectedGameKey.value)?.name || '游戏对局'
})

const playerInitial = computed(() => {
  const text = player.value?.nickname || '团'
  return text.slice(0, 1)
})

const playerAvatar = computed(() => {
  const seed = `${player.value?.id || ''}${player.value?.nickname || ''}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash += seed.charCodeAt(i)
  return avatarPalette[hash % avatarPalette.length]
})

onMounted(() => {
  if (!player.value) router.push('/')
})

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
      alert(err.message || '启动游戏失败')
    })
}

function cancelMatch() {
  socket.emit('match:cancel', { gameType: selectedGameKey.value || 'rock_paper_scissors' }, () => {
    matching.value = false
  })
}
</script>

<style scoped>
.lobby-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1e90ff 0%, #87ceeb 100%);
  position: relative;
  overflow-x: hidden;
  padding-bottom: 20px;
}

.lobby-container {
  max-width: 750px;
  margin: 0 auto;
  padding: 0 16px;
  position: relative;
}

/* 顶部装饰 */
.top-decorations {
  position: relative;
  height: 60px;
  margin-bottom: 10px;
}

.flags {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  gap: 15px;
}

.flag {
  font-size: 24px;
  animation: wave 2s ease-in-out infinite;
}

.flag-1 {
  animation-delay: 0s;
}

.flag-2 {
  animation-delay: 0.3s;
}

.flag-3 {
  animation-delay: 0.6s;
}

.balloon {
  position: absolute;
  top: 0;
  right: 20px;
  font-size: 40px;
  animation: float 3s ease-in-out infinite;
}

.confetti {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
}

.confetti-piece {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin: 0 5px;
  border-radius: 2px;
  animation: confetti-fall 2s ease-in-out infinite;
}

.confetti-piece:nth-child(1) {
  background: #ff6b6b;
  animation-delay: 0s;
}

.confetti-piece:nth-child(2) {
  background: #ffd93d;
  animation-delay: 0.5s;
}

.confetti-piece:nth-child(3) {
  background: #6bcb77;
  animation-delay: 1s;
}

/* 主标题 */
.main-title {
  text-align: center;
  font-size: 48px;
  font-weight: 900;
  color: #fff;
  text-shadow: 
    0 4px 0 #1a73e8,
    0 8px 0 #1557b0,
    0 12px 20px rgba(0, 0, 0, 0.3);
  margin: 0 0 20px;
  letter-spacing: 4px;
}

/* 用户信息区 */
.user-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 15px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.avatar-wrapper {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-details {
  color: #fff;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.greeting {
  font-size: 20px;
  font-weight: 700;
}

.bus-badge {
  background: rgba(255, 255, 255, 0.9);
  color: #1a73e8;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

.welcome-text {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.action-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.action-text {
  font-size: 12px;
  color: #333;
  font-weight: 600;
}

/* 积分展示区 */
.score-section {
  margin-bottom: 20px;
}

.score-card {
  background: linear-gradient(135deg, #1a73e8 0%, #4a90e2 100%);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}

.score-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: shimmer 3s infinite;
}

.score-left,
.score-right {
  flex: 0 0 auto;
}

.trophy-img,
.gift-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.score-center {
  flex: 1;
  text-align: center;
  color: #fff;
  position: relative;
  z-index: 1;
}

.score-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 600;
}

.star {
  color: #ffd700;
}

.score-value {
  font-size: 64px;
  font-weight: 900;
  color: #ffd700;
  text-shadow: 0 4px 0 #b8860b, 0 8px 10px rgba(0, 0, 0, 0.3);
  line-height: 1;
}

/* 游戏网格区 */
.games-section {
  margin-bottom: 20px;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.game-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.game-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.game-image-wrapper {
  height: 100px;
  overflow: hidden;
}

.game-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-name {
  padding: 10px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

/* 宣传横幅 */
.promo-banner {
  margin-bottom: 20px;
}

.promo-image {
  width: 100%;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 底部功能区 */
.bottom-section {
  margin-bottom: 20px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.feature-item:hover {
  transform: translateY(-2px);
}

.feature-icon-img {
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
}

.feature-text {
  text-align: center;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.feature-subtitle {
  font-size: 12px;
  color: #666;
}

/* 底部提示 */
.footer-note {
  text-align: center;
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.note-decoration {
  font-size: 16px;
}

/* 弹窗样式 */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(8, 28, 66, 0.48);
  display: grid;
  place-items: center;
  padding: 20px;
}

.loading-box,
.reward-box {
  width: min(92vw, 360px);
  border-radius: 22px;
  padding: 20px 18px;
  text-align: center;
  background: linear-gradient(180deg, #ffffff, #f4f8ff);
  color: var(--text-primary);
  border: 2px solid #d6e5f8;
  box-shadow: 0 18px 30px rgba(7, 49, 129, 0.18);
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

.loading-box h3,
.reward-box h3 {
  margin: 0;
  font-size: 22px;
}

.loading-box p,
.reward-box p {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.45;
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

.confirm-btn {
  margin-top: 14px;
  min-height: 44px;
  padding: 0 22px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(180deg, #2e8dff, #0a59ef);
  font-size: 15px;
  font-weight: 800;
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
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 动画 */
@keyframes wave {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes confetti-fall {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(10px) rotate(180deg); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
  100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .games-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .main-title {
    font-size: 36px;
  }
  
  .score-value {
    font-size: 48px;
  }
}

@media (max-width: 480px) {
  .user-section {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .action-buttons {
    width: 100%;
    justify-content: space-around;
  }
  
  .games-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .main-title {
    font-size: 32px;
  }
  
  .score-value {
    font-size: 40px;
  }
}
</style>
