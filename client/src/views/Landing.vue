<template>
  <main class="landing-page">
    <section class="landing-shell">
      <h1 class="sr-only">公司团建小游戏</h1>

      <header class="hero-area" aria-hidden="true"></header>

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

        <div class="field-group field-group-bus">
          <label class="field-label">
            <span class="field-icon">🚌</span>
            大巴车
          </label>

          <p class="field-tip">请选择您所在的大巴车</p>

          <div class="bus-grid">
            <button
              v-for="n in busCount"
              :key="n"
              type="button"
              class="bus-item"
              :class="{ active: busNumber === n }"
              @click="busNumber = n"
            >
              <span class="bus-icon">🚌</span>
              <strong>{{ n }}号车</strong>
              <span v-if="busNumber === n" class="bus-check">✓</span>
            </button>
          </div>
        </div>

        <div class="reference-banner" aria-hidden="true"></div>

        <button
          class="enter-btn"
          :disabled="!nickname.trim() || !busNumber"
          @click="handleSubmit"
        >
          <span>进入游戏平台</span>
          <i>›</i>
        </button>

        <p class="reward-note">
          <span class="gift-icon">🎁</span>
          提交后自动领取 <strong>1000</strong> 积分
        </p>
      </section>
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
  padding: 0 14px 30px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #0a64ef 0%, #47b4ff 46%, #eef9ff 88%);
}

.landing-page::before,
.landing-page::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 0;
}

.landing-page::before {
  top: 0;
  height: 430px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.04)),
    url('/assets/ui-ref/landing.png') center top / 100% auto no-repeat;
}

.landing-page::after {
  bottom: 0;
  height: 220px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(238, 249, 255, 0.1)),
    url('/assets/ui-ref/landing.png') center bottom / 100% auto no-repeat;
}

.landing-shell {
  width: min(100%, 460px);
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  z-index: 1;
  padding-top: 10px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.hero-area {
  width: 100%;
  aspect-ratio: 941 / 648;
  background: url('/assets/ui-ref/landing.png') center top / 100% auto no-repeat;
}

.entry-card {
  margin-top: -16px;
  padding: 28px 22px 20px;
  border-radius: 36px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(228, 237, 250, 0.96);
  box-shadow:
    0 22px 44px rgba(10, 74, 170, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.field-group + .field-group {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px dashed #d7e4f7;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #1f3562;
  font-size: 18px;
  font-weight: 900;
}

.field-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(31, 111, 255, 0.12), rgba(32, 197, 192, 0.14));
  font-size: 18px;
}

.field-tip {
  margin: -4px 0 14px;
  color: #6b82ac;
  font-size: 14px;
  line-height: 1.5;
}

.field-input {
  width: 100%;
  min-height: 60px;
  padding: 0 18px;
  border: 1px solid #d2e0f4;
  border-radius: 18px;
  outline: none;
  background: #fbfdff;
  color: #17315d;
  font-size: 18px;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.field-input:focus {
  border-color: #4d95ff;
  box-shadow: 0 0 0 4px rgba(77, 149, 255, 0.14);
}

.bus-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.bus-item {
  position: relative;
  min-height: 118px;
  padding: 14px 8px 12px;
  border-radius: 20px;
  border: 1px solid #d9e4f5;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #20355f;
  box-shadow: 0 10px 18px rgba(7, 84, 178, 0.08);
}

.bus-icon {
  font-size: 30px;
}

.bus-item strong {
  font-size: 17px;
  line-height: 1;
}

.bus-item.active {
  border-color: rgba(28, 113, 255, 0.32);
  background: linear-gradient(180deg, #318cff, #115df3);
  color: #fff;
  box-shadow: 0 18px 28px rgba(10, 90, 212, 0.22);
}

.bus-check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  font-size: 14px;
  font-weight: 900;
}

.reference-banner {
  margin-top: 22px;
  width: 100%;
  aspect-ratio: 754 / 166;
  border-radius: 22px;
  background: url('/assets/landing/banner-strip.png') center / cover no-repeat;
  border: 1px solid rgba(208, 228, 247, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.enter-btn {
  margin-top: 26px;
  width: 100%;
  min-height: 68px;
  padding: 0 22px;
  border-radius: 24px;
  border: 1px solid rgba(22, 108, 255, 0.18);
  background: linear-gradient(180deg, #3291ff, #145ff2);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  font-size: 24px;
  font-weight: 900;
  box-shadow:
    0 16px 26px rgba(10, 90, 212, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.enter-btn i {
  font-style: normal;
  font-size: 34px;
  line-height: 1;
}

.enter-btn:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  box-shadow: none;
  filter: grayscale(0.2);
}

.reward-note {
  margin: 18px 0 0;
  text-align: center;
  color: #2f456e;
  font-size: 16px;
  font-weight: 700;
}

.gift-icon {
  margin-right: 8px;
}

.reward-note strong {
  color: #f06d00;
}

@media (max-width: 390px) {
  .landing-page {
    padding-inline: 10px;
  }

  .entry-card {
    padding: 24px 16px 18px;
  }

  .bus-grid {
    gap: 10px;
  }

  .bus-item {
    min-height: 108px;
    border-radius: 18px;
  }

  .bus-item strong {
    font-size: 15px;
  }

  .reference-banner {
    border-radius: 18px;
  }

  .enter-btn {
    min-height: 62px;
    font-size: 21px;
  }
}
</style>
