<template>
  <div class="app-container">
    <router-view />

    <div v-if="gameState.broadcastMessage" class="broadcast-banner">
      <span class="broadcast-icon">📣</span>
      <span class="broadcast-text">{{ gameState.broadcastMessage.message }}</span>
    </div>

    <div v-if="activeInvite" class="invite-banner">
      <div>
        <strong>{{ activeInvite.from?.nickname || '玩家' }} 邀请你加入房间</strong>
        <span>{{ activeInvite.room?.gameName || '游戏对局' }}</span>
      </div>
      <button type="button" @click="acceptInvite(activeInvite)">加入</button>
      <button type="button" class="ghost" @click="dismissInvite(activeInvite)">忽略</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { gameState, socket } from './socket'

const router = useRouter()
const activeInvite = computed(() => gameState.invitations[0] || null)

window.addEventListener('error', (e) => {
  console.error('App Error:', e.error?.message || e.message)
})

function dismissInvite(invite) {
  gameState.invitations = gameState.invitations.filter(item => item !== invite)
}

function acceptInvite(invite) {
  socket.emit('room:invite:accept', { roomId: invite.room?.roomId }, (res) => {
    if (res?.error) {
      window.alert(res.error)
      dismissInvite(invite)
      return
    }
    if (res?.room) {
      gameState.currentRoom = res.room
      gameState.currentGame = res.room.gameState
      socket.emit('room:join', { roomId: res.room.roomId })
      dismissInvite(invite)
      router.push(`/game/${res.room.roomId}`)
    }
  })
}
</script>

<style>
:root {
  --bg-primary: #0676ff;
  --bg-secondary: #edf7ff;
  --bg-card: #ffffff;
  --bg-card-soft: #eaf5ff;
  --bg-card-hover: #f8fbff;
  --accent: #0875ff;
  --accent-light: #57b0ff;
  --accent-strong: #0356ef;
  --gold: #ffae22;
  --gold-light: #ffe27a;
  --orange: #ff8a25;
  --green: #21bf63;
  --panel-border: rgba(214, 235, 255, 0.96);
  --panel-glass: rgba(255, 255, 255, 0.9);
  --text-primary: #18325f;
  --text-secondary: #4f6c98;
  --text-muted: #7f97bc;
  --danger: #ff4e4e;
  --success: #2eb87f;
  --warning: #ff9d1f;
  --shadow-soft: 0 12px 26px rgba(8, 82, 184, 0.16);
  --shadow-strong: 0 18px 38px rgba(7, 80, 190, 0.28);
  --shadow-button: inset 0 2px 0 rgba(255, 255, 255, 0.58), 0 10px 0 rgba(3, 72, 190, 0.22), 0 16px 24px rgba(6, 86, 201, 0.26);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --font-sm: 14px;
  --font-md: 16px;
  --font-lg: 22px;
  --font-xl: 30px;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  min-height: 100%;
}

body {
  background: #0786ff;
  color: var(--text-primary);
  line-height: 1.4;
  overflow-x: hidden;
}

.app-container {
  position: relative;
  overflow-x: hidden;
  min-height: 100vh;
}


.app-container > * {
  position: relative;
  z-index: 1;
}

button {
  font-family: inherit;
  border: none;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}

button:active {
  transform: scale(0.98);
}

button:disabled {
  cursor: not-allowed;
}

input {
  font-family: inherit;
  font-size: var(--font-md);
}

.broadcast-banner {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #2d7dff, #1162f7);
  color: #fff;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: var(--font-md);
  font-weight: 600;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: slideDown 0.3s ease-out;
  max-width: min(92vw, 560px);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: var(--shadow-strong);
}

.broadcast-icon {
  font-size: 20px;
}

.invite-banner {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 10000;
  width: min(92vw, 420px);
  transform: translateX(-50%);
  padding: 12px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #cfe2fb;
  box-shadow: var(--shadow-strong);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
}

.invite-banner strong,
.invite-banner span {
  display: block;
}

.invite-banner strong {
  color: #17315d;
  font-size: 14px;
}

.invite-banner span {
  margin-top: 2px;
  color: #6b82ac;
  font-size: 12px;
}

.invite-banner button {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 12px;
  background: #1764df;
  color: #fff;
  font-weight: 900;
}

.invite-banner .ghost {
  background: #eef5ff;
  color: #1764df;
}

@keyframes slideDown {
  from {
    transform: translateX(-50%) translateY(-60px);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}
</style>
