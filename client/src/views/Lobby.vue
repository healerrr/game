<template>
  <main class="lobby-page">
    <section class="lobby-shell">
      <header class="hero-panel">
        <div class="hero-top">
          <div class="title-wrap">
            <p class="hero-ribbon">轻松互动，欢乐同行</p>
            <h1 class="page-title">游戏平台</h1>
          </div>

          <div class="score-pill">
            <span class="coin">⭐</span>
            <span>积分 {{ player?.points ?? 0 }}</span>
          </div>
        </div>

        <div class="player-row">
          <div class="player-card">
            <div class="avatar">
              <img :src="playerAvatar" alt="avatar" />
            </div>
            <div class="player-copy">
              <div class="name-row">
                <strong>{{ player?.nickname || '游客' }}</strong>
                <span class="bus-tag">🚌 {{ player?.busNumber || '-' }}号车</span>
              </div>
              <p>欢迎来到公司团建小游戏平台</p>
            </div>
          </div>

          <div class="hero-actions">
            <button class="hero-btn" @click="$router.push('/leaderboard')">
              <span class="hero-btn-icon">🏆</span>
              <span>今日排行</span>
            </button>
            <button class="hero-btn" @click="showRuleHint = !showRuleHint">
              <span class="hero-btn-icon">📘</span>
              <span>活动规则</span>
            </button>
          </div>
        </div>

        <section class="score-banner">
          <span class="score-accent accent-left">🏆</span>
          <div class="score-copy">
            <span>当前积分</span>
            <strong>{{ player?.points ?? 0 }}</strong>
          </div>
          <span class="score-accent accent-right">🎁</span>
        </section>
      </header>

      <section class="game-grid-panel">
        <article
          v-for="game in gameCards"
          :key="game.key"
          class="game-card"
          :class="game.tone"
          :title="game.desc"
          @click="joinGame(game.key)"
        >
          <div class="game-visual">
            <img :src="game.art" :alt="game.name" />
            <span class="game-icon">{{ game.icon }}</span>
          </div>
          <h3>{{ game.name }}</h3>
        </article>
      </section>

      <section class="slogan-banner">
        <span class="slogan-mascot">📣</span>
        <div>
          <strong>轻松互动，欢乐同行</strong>
          <p>团队合作 共创精彩</p>
        </div>
        <span class="slogan-tail">🎯</span>
      </section>

      <nav class="feature-nav">
        <button class="feature-btn" @click="$router.push('/leaderboard')">
          <span class="feature-icon">📋</span>
          <span class="title">积分记录</span>
          <span class="sub">明细查询</span>
        </button>
        <button class="feature-btn">
          <span class="feature-icon">🎖️</span>
          <span class="title">我的战绩</span>
          <span class="sub">历史成绩</span>
        </button>
        <button class="feature-btn" @click="$router.push('/leaderboard')">
          <span class="feature-icon">🏅</span>
          <span class="title">排行榜</span>
          <span class="sub">实时排名</span>
        </button>
        <button class="feature-btn" @click="showReward = true">
          <span class="feature-icon">🎁</span>
          <span class="title">兑奖区</span>
          <span class="sub">兑换好礼</span>
        </button>
      </nav>

      <footer class="page-note">积极参与，赢取积分，兑换丰厚好礼！</footer>

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

      <transition name="fade">
        <div v-if="showRuleHint" class="toast">
          推荐先体验：猜数字、快问快答、掼蛋、红中麻将
        </div>
      </transition>
    </section>
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
  { key: 'rock_paper_scissors', name: '剪刀石头布', icon: '✊', art: '/assets/ui-ref/rps.png', tone: 'tone-mint', desc: '轻量快开，2 人对战' },
  { key: 'guess_number', name: '猜数字', icon: '7', art: '/assets/ui-ref/guess.png', tone: 'tone-violet', desc: '1 到 100 猜谜博弈' },
  { key: 'quiz', name: '快问快答', icon: 'Q', art: '/assets/ui-ref/quiz.png', tone: 'tone-blue', desc: '限时抢答，冲刺积分' },
  { key: 'gomoku', name: '五子棋', icon: '●', art: '/assets/ui-ref/gomoku.png', tone: 'tone-gold', desc: '经典黑白棋' },
  { key: 'chess', name: '象棋', icon: '象', art: '/assets/ui-ref/chess.png', tone: 'tone-orange', desc: '楚河汉界策略对弈' },
  { key: 'guandan', name: '掼蛋', icon: 'A', art: '/assets/ui-ref/guandan.png', tone: 'tone-green', desc: '双人组队出牌' },
  { key: 'zha_jin_hua', name: '炸金花', icon: '♦', art: '/assets/ui-ref/zjh.png', tone: 'tone-purple', desc: '看牌比牌，刺激上头' },
  { key: 'mahjong', name: '红中麻将', icon: '中', art: '/assets/ui-ref/mahjong.png', tone: 'tone-cyan', desc: '四人经典麻将局' }
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
  padding: 16px 12px 22px;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(0, 92, 240, 0.08), rgba(255, 255, 255, 0.24) 76%),
    radial-gradient(circle at 52% 21%, rgba(255, 255, 255, 0.36), transparent 24%);
}

.lobby-page::before,
.lobby-page::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.lobby-page::before {
  width: 240px;
  height: 240px;
  left: -120px;
  top: 160px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0));
}

.lobby-page::after {
  width: 280px;
  height: 280px;
  right: -140px;
  bottom: 110px;
  background: radial-gradient(circle, rgba(118, 255, 229, 0.36), rgba(118, 255, 229, 0));
}

.lobby-shell {
  width: min(100%, 430px);
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.hero-panel {
  color: #fff;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hero-ribbon {
  margin: 0 0 8px;
  width: fit-content;
  min-height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: linear-gradient(180deg, rgba(87, 154, 255, 0.98), rgba(25, 91, 241, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.52);
  box-shadow: var(--shadow-strong);
  font-size: 13px;
  font-weight: 800;
}

.page-title {
  margin: 0;
  font-size: clamp(38px, 10vw, 58px);
  line-height: 0.96;
  font-weight: 900;
  letter-spacing: 0;
  -webkit-text-stroke: 2px rgba(255, 255, 255, 0.82);
  text-shadow:
    0 5px 0 rgba(4, 61, 173, 0.94),
    0 10px 0 rgba(3, 61, 165, 0.34),
    0 14px 28px rgba(5, 58, 150, 0.3);
}

.score-pill {
  flex: 0 0 auto;
  min-height: 50px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 2px solid rgba(255, 255, 255, 0.48);
  background: rgba(255, 255, 255, 0.92);
  color: #2363f5;
  font-size: 15px;
  font-weight: 900;
  box-shadow: var(--shadow-soft);
}

.coin {
  font-size: 20px;
}

.player-row {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: stretch;
}

.player-card {
  min-height: 112px;
  border-radius: 24px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.44);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(91, 176, 255, 0.28));
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-soft);
}

.avatar {
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #fdfefe, #ebf4ff);
  color: #2065f4;
  border: 2px solid rgba(255, 255, 255, 0.72);
  font-size: 32px;
  font-weight: 900;
  box-shadow: inset 0 2px 12px rgba(115, 159, 255, 0.2);
  overflow: hidden;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-copy strong {
  font-size: 26px;
  line-height: 1.05;
  font-weight: 900;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bus-tag {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.92);
  color: #2264f6;
  font-size: 14px;
  font-weight: 900;
}

.player-copy p {
  margin: 8px 0 0;
  color: rgba(255, 255, 255, 0.94);
  font-size: 15px;
  font-weight: 700;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-btn {
  width: 88px;
  min-height: 88px;
  border-radius: 20px;
  border: 1px solid #d8e8fb;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(231, 241, 255, 0.95));
  color: #1b4f97;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: var(--shadow-soft);
  font-size: 14px;
  font-weight: 900;
}

.hero-btn-icon {
  font-size: 30px;
}

.score-banner {
  margin-top: 14px;
  min-height: 148px;
  border-radius: 30px;
  border: 2px solid rgba(219, 233, 255, 0.92);
  background:
    radial-gradient(circle at 50% -10%, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 38%),
    linear-gradient(180deg, #4aa2ff, #1f6aff);
  display: grid;
  grid-template-columns: 52px 1fr 52px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  box-shadow: var(--shadow-strong);
}

.score-copy {
  text-align: center;
}

.score-copy span {
  display: block;
  font-size: 22px;
  font-weight: 900;
}

.score-copy strong {
  display: block;
  margin-top: 6px;
  font-size: 78px;
  line-height: 0.92;
  color: #ffd567;
  font-weight: 900;
  text-shadow: 0 5px 0 rgba(193, 116, 16, 0.56);
}

.score-accent {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
}

.game-grid-panel {
  margin-top: 16px;
  padding: 14px;
  border-radius: 30px;
  border: 2px solid #dceafb;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(239, 247, 255, 0.98) 100%);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  box-shadow: var(--shadow-soft);
}

.game-card {
  overflow: hidden;
  border-radius: 18px;
  border: 2px solid #dbeafb;
  background: #fff;
  color: #17386d;
  box-shadow: 0 10px 18px rgba(14, 63, 143, 0.12);
  transform: translateZ(0);
}

.game-visual {
  height: 108px;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
}

.game-visual img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 28%;
  transform: scale(1.18);
  filter: saturate(1.12) brightness(1.03);
}

.game-visual::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.16)),
    radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.42), transparent 38%);
}

.game-icon {
  position: relative;
  z-index: 1;
  min-width: 48px;
  height: 48px;
  padding: 0 10px;
  border-radius: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.86);
  color: #125ee8;
  font-size: 28px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(17, 72, 164, 0.18);
}

.game-card h3 {
  margin: 0;
  padding: 12px 6px 14px;
  text-align: center;
  font-size: 15px;
  line-height: 1.2;
  font-weight: 900;
}

.game-card.tone-mint .game-visual {
  background: linear-gradient(180deg, #d9fff0, #f5fffb);
}

.game-card.tone-violet .game-visual {
  background: linear-gradient(180deg, #eadfff, #f9f5ff);
}

.game-card.tone-blue .game-visual {
  background: linear-gradient(180deg, #dcebff, #f4f9ff);
}

.game-card.tone-gold .game-visual {
  background: linear-gradient(180deg, #ffefca, #fffaf0);
}

.game-card.tone-orange .game-visual {
  background: linear-gradient(180deg, #ffe4c7, #fff8ef);
}

.game-card.tone-green .game-visual {
  background: linear-gradient(180deg, #e0ffd2, #f7fff2);
}

.game-card.tone-purple .game-visual {
  background: linear-gradient(180deg, #f0e2ff, #fbf7ff);
}

.game-card.tone-cyan .game-visual {
  background: linear-gradient(180deg, #ddfff7, #f4fffd);
}

.slogan-banner {
  margin-top: 16px;
  min-height: 96px;
  border-radius: 20px;
  padding: 0 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  background:
    radial-gradient(circle at 8% 84%, rgba(58, 193, 119, 0.34), transparent 28%),
    radial-gradient(circle at 92% 78%, rgba(255, 174, 34, 0.24), transparent 26%),
    linear-gradient(90deg, #c8f0ff, #eff9ff 45%, #d8f6ff);
  border: 1px solid #cce7ff;
  color: #2260c8;
}

.slogan-mascot,
.slogan-tail {
  font-size: 34px;
}

.slogan-banner strong {
  display: block;
  font-size: 22px;
  line-height: 1.2;
}

.slogan-banner p {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 800;
}

.feature-nav {
  margin-top: 16px;
  border-radius: 24px;
  border: 2px solid #dce9f8;
  background: #fff;
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.feature-btn {
  min-height: 94px;
  padding: 12px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  color: #1a3f74;
}

.feature-btn + .feature-btn {
  border-left: 1px solid #e5edf8;
}

.feature-icon {
  font-size: 30px;
}

.feature-btn .title {
  font-size: 15px;
  font-weight: 900;
}

.feature-btn .sub {
  font-size: 12px;
  color: #6a88b3;
  font-weight: 700;
}

.page-note {
  margin: 14px 0 4px;
  text-align: center;
  color: #eff8ff;
  font-size: 16px;
  font-weight: 800;
  text-shadow: 0 2px 12px rgba(9, 67, 167, 0.36);
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 390px) {
  .lobby-page {
    padding-inline: 10px;
  }

  .page-title {
    font-size: 44px;
  }

  .player-row {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: row;
  }

  .hero-btn {
    width: auto;
    flex: 1;
    min-height: 76px;
  }

  .score-banner {
    min-height: 132px;
    grid-template-columns: 44px 1fr 44px;
  }

  .score-copy span {
    font-size: 18px;
  }

  .score-copy strong {
    font-size: 64px;
  }

  .game-grid-panel {
    padding: 10px;
    gap: 8px;
  }

  .game-visual {
    height: 88px;
  }

  .game-card h3 {
    padding: 10px 4px 12px;
    font-size: 13px;
  }

  .feature-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .feature-btn + .feature-btn {
    border-left: 0;
  }

  .feature-btn:nth-child(2n) {
    border-left: 1px solid #e5edf8;
  }

  .feature-btn:nth-child(n + 3) {
    border-top: 1px solid #e5edf8;
  }
}
</style>
