<template>
  <main class="landing-page">
    <section class="landing-shell">
      <header class="hero-area">
        <p class="hero-ribbon">轻松互动，欢乐同行</p>
        <h1 class="hero-title">
          公司团建
          <span>小游戏</span>
        </h1>
        <p class="hero-subtitle">团队合作，共创精彩</p>

        <div class="team-showcase">
          <div
            v-for="(avatar, index) in heroAvatars"
            :key="avatar.src"
            class="team-member"
            :class="avatar.tone"
            :style="{ '--lift': `${(index % 2) * -10}px` }"
          >
            <img :src="avatar.src" :alt="avatar.label" />
            <span>{{ avatar.label }}</span>
          </div>
        </div>
      </header>

      <section class="entry-card">
        <div class="field-group">
          <label for="nickname" class="field-label">
            <span class="field-icon">👤</span>
            姓名
          </label>
          <input
            id="nickname"
            v-model="nickname"
            type="text"
            maxlength="12"
            class="field-input"
            placeholder="请输入您的姓名"
            @keyup.enter="handleSubmit"
          />
        </div>

        <div class="field-group">
          <label class="field-label">
            <span class="field-icon">🚌</span>
            大巴车
          </label>
          <p class="field-tip">请选择您所在的大巴车</p>

          <div class="bus-grid">
            <button
              v-for="n in busCount"
              :key="n"
              class="bus-item"
              :class="{ active: busNumber === n }"
              @click="busNumber = n"
            >
              <span class="bus-icon">🚌</span>
              <span>{{ n }}号车</span>
              <span v-if="busNumber === n" class="bus-check">✓</span>
            </button>
          </div>
        </div>

        <div class="promo-strip">
          <span>🎯</span>
          <span>🎲</span>
          <span>🕹️</span>
          <span>📣</span>
        </div>

        <button
          class="enter-btn"
          :disabled="!nickname.trim() || !busNumber"
          @click="handleSubmit"
        >
          进入游戏平台
          <span>›</span>
        </button>

        <p class="reward-note">
          <span class="gift-icon">🎁</span>
          提交后自动领取 <strong>1000</strong> 积分
        </p>
      </section>

      <footer class="landing-footer">
        <span>在线 {{ stats.onlinePlayers || 0 }} 人</span>
        <span>已注册 {{ stats.totalPlayers || 0 }} 人</span>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { socket, setPlayer } from '../socket'

const router = useRouter()
const nickname = ref('')
const busNumber = ref(1)
const busCount = ref(4)
const stats = ref({ onlinePlayers: 0, totalPlayers: 0 })
const heroAvatars = [
  { src: '/assets/mahjong-theme/avatars/yun.png', label: '1号车', tone: 'tone-yellow' },
  { src: '/assets/mahjong-theme/avatars/xu.png', label: '2号车', tone: 'tone-blue' },
  { src: '/assets/mahjong-theme/avatars/ling.png', label: '3号车', tone: 'tone-white' },
  { src: '/assets/mahjong-theme/avatars/wan.png', label: '4号车', tone: 'tone-green' }
]

function toLobby(player) {
  setPlayer(player)
  localStorage.setItem(
    'bus_game_player',
    JSON.stringify({
      id: player.id,
      nickname: player.nickname,
      busNumber: player.busNumber
    })
  )
  router.push('/lobby')
}

function restorePlayer() {
  const saved = localStorage.getItem('bus_game_player')
  if (!saved) return

  const player = JSON.parse(saved)
  socket.emit('player:reconnect', { playerId: player.id }, (res) => {
    if (res.player) {
      toLobby(res.player)
    } else {
      localStorage.removeItem('bus_game_player')
    }
  })
}

function handleServerUpdate(data) {
  stats.value = data.stats || {}
}

function handleSubmit() {
  if (!nickname.value.trim() || !busNumber.value) return

  socket.emit(
    'player:register',
    {
      nickname: nickname.value.trim(),
      busNumber: busNumber.value
    },
    (res) => {
      if (res.player) toLobby(res.player)
    }
  )
}

onMounted(() => {
  restorePlayer()
  socket.on('server:update', handleServerUpdate)
})

onUnmounted(() => {
  socket.off('server:update', handleServerUpdate)
})
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  padding: 16px 12px 22px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 28%, rgba(255, 255, 255, 0.46), transparent 18%),
    radial-gradient(circle at 88% 18%, rgba(255, 221, 100, 0.24), transparent 15%),
    linear-gradient(180deg, rgba(0, 93, 234, 0.18), rgba(255, 255, 255, 0.18) 72%);
}

.landing-page::before,
.landing-page::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0.5;
}

.landing-page::before {
  width: 220px;
  height: 220px;
  left: -110px;
  top: 160px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0));
}

.landing-page::after {
  width: 240px;
  height: 240px;
  right: -120px;
  bottom: 120px;
  background: radial-gradient(circle, rgba(144, 255, 237, 0.46), rgba(144, 255, 237, 0));
}

.landing-shell {
  width: min(100%, 430px);
  margin: 0 auto;
  min-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.hero-area {
  position: relative;
  min-height: 318px;
  padding: 42px 18px 20px;
  border-radius: 8px 8px 28px 28px;
  text-align: center;
  color: #fff;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 30%, rgba(255, 255, 255, 0.35) 0 35px, transparent 37px),
    radial-gradient(circle at 90% 22%, rgba(255, 255, 255, 0.32) 0 42px, transparent 44px),
    radial-gradient(circle at 75% 82%, rgba(53, 203, 135, 0.22) 0 80px, transparent 82px),
    linear-gradient(180deg, rgba(40, 133, 255, 0.66), rgba(31, 146, 255, 0.42));
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.24);
}

.hero-area::before,
.hero-area::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.hero-area::before {
  left: 20px;
  right: 20px;
  top: 14px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.58), transparent);
}

.hero-area::after {
  left: 50%;
  bottom: -48px;
  width: 420px;
  height: 124px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: rgba(223, 249, 255, 0.2);
}

.hero-ribbon {
  margin: 0 auto;
  width: fit-content;
  min-height: 36px;
  padding: 0 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(78, 155, 255, 0.98), rgba(20, 91, 239, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.58);
  box-shadow: 0 10px 20px rgba(5, 67, 164, 0.2);
  font-size: 14px;
  font-weight: 900;
}

.hero-title {
  margin: 16px 0 8px;
  font-size: 44px;
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: 0;
  -webkit-text-stroke: 2px rgba(255, 255, 255, 0.82);
  text-shadow:
    0 5px 0 #0752c7,
    0 10px 0 rgba(8, 54, 172, 0.42),
    0 16px 28px rgba(3, 56, 148, 0.34);
}

.hero-title span {
  display: block;
  margin-top: 8px;
  color: #ffd256;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.5);
  text-shadow:
    0 5px 0 rgba(192, 105, 5, 0.95),
    0 14px 28px rgba(3, 56, 148, 0.26);
}

.hero-subtitle {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  text-shadow: 0 3px 12px rgba(6, 58, 156, 0.28);
}

.team-showcase {
  position: relative;
  z-index: 1;
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}

.team-member {
  min-width: 0;
  min-height: 72px;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.62);
  box-shadow: 0 10px 18px rgba(6, 67, 166, 0.16);
}

.team-member {
  transform: none;
  padding: 7px 4px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  overflow: hidden;
}

.team-member img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.88);
  border: 2px solid rgba(255, 255, 255, 0.78);
}

.team-member span {
  min-height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.86);
  color: #1b5fd8;
  white-space: nowrap;
}

.team-member.tone-yellow {
  background: linear-gradient(180deg, #ffc54b, #ffa62d);
}

.team-member.tone-blue {
  background: linear-gradient(180deg, #53a7ff, #236cff);
}

.team-member.tone-white {
  background: linear-gradient(180deg, #ffffff, #eff5ff);
  color: #245ff4;
}

.team-member.tone-green {
  background: linear-gradient(180deg, #34d6bb, #00b99e);
}

.team-member.tone-orange {
  background: linear-gradient(180deg, #ff9d52, #ff6d37);
}

.entry-card {
  margin-top: -10px;
  background: linear-gradient(180deg, #ffffff 0%, #f3f9ff 100%);
  border-radius: 30px;
  border: 2px solid rgba(218, 233, 252, 0.98);
  box-shadow: var(--shadow-strong);
  padding: 22px 18px 20px;
}

.field-group + .field-group {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed #d9e8fb;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 18px;
  font-weight: 900;
  color: var(--text-primary);
}

.field-icon {
  font-size: 18px;
}

.field-tip {
  margin: -4px 0 12px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.field-input {
  width: 100%;
  min-height: 60px;
  padding: 0 16px;
  border: 2px solid #d5e4f9;
  border-radius: 16px;
  outline: none;
  color: var(--text-primary);
  font-size: 18px;
  background: #fbfdff;
}

.field-input:focus {
  border-color: #67a1ff;
  box-shadow: 0 0 0 4px rgba(103, 161, 255, 0.16);
}

.bus-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.bus-item {
  position: relative;
  min-height: 112px;
  border-radius: 18px;
  border: 2px solid #d6e3f7;
  background: #fff;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 900;
  box-shadow: 0 10px 18px rgba(13, 72, 168, 0.08);
}

.bus-icon {
  font-size: 30px;
}

.bus-item.active {
  color: #fff;
  background: linear-gradient(180deg, #2f8dff, #0a5ff4);
  border-color: #2a7eff;
  box-shadow: var(--shadow-button);
}

.bus-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.36);
  font-size: 12px;
}

.promo-strip {
  margin: 18px 0 16px;
  min-height: 82px;
  border-radius: 18px;
  border: 1px solid #cde5ff;
  background:
    radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 22%),
    linear-gradient(120deg, #d8f6ff, #f4fbff 52%, #cff0ff);
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  color: #2963b8;
  font-size: 28px;
}

.enter-btn {
  width: 100%;
  min-height: 64px;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(180deg, #2d8cff, #0352eb);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 24px;
  font-weight: 900;
  text-shadow: 0 2px 12px rgba(6, 62, 160, 0.42);
  box-shadow: var(--shadow-button);
}

.enter-btn span {
  font-size: 34px;
  line-height: 1;
}

.enter-btn:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  box-shadow: none;
  filter: grayscale(0.28);
}

.reward-note {
  margin: 14px 0 0;
  text-align: center;
  color: #384f7e;
  font-size: 17px;
  font-weight: 700;
}

.gift-icon {
  margin-right: 6px;
}

.reward-note strong {
  color: #ff6f12;
}

.landing-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #eff7ff;
  font-size: 14px;
  font-weight: 700;
  text-shadow: 0 2px 12px rgba(10, 67, 160, 0.38);
}

@media (max-width: 390px) {
  .landing-page {
    padding-inline: 8px;
  }

  .landing-shell {
    width: 100%;
  }

  .hero-area {
    min-height: 308px;
    padding: 40px 14px 18px;
  }

  .hero-title {
    font-size: 40px;
  }

  .team-showcase {
    gap: 8px;
  }

  .team-member {
    min-height: 68px;
    font-size: 11px;
  }

  .team-member img {
    width: 36px;
    height: 36px;
  }

  .bus-item {
    min-height: 94px;
    font-size: 14px;
  }

  .landing-footer {
    flex-direction: column;
  }
}
</style>
