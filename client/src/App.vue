<template>
  <div class="app-container">
    <router-view />

    <div v-if="gameState.broadcastMessage" class="broadcast-banner">
      <span class="broadcast-icon">📣</span>
      <span class="broadcast-text">{{ gameState.broadcastMessage.message }}</span>
    </div>
  </div>
</template>

<script setup>
import { gameState } from './socket'

window.addEventListener('error', (e) => {
  console.error('App Error:', e.error?.message || e.message)
})
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
  background:
    radial-gradient(circle at 18% 2%, rgba(255, 255, 255, 0.48), transparent 25%),
    radial-gradient(circle at 82% 12%, rgba(255, 223, 92, 0.3), transparent 18%),
    linear-gradient(180deg, #0063f0 0%, #108cff 37%, #91dcff 74%, #eaf9ff 100%);
}

.app-container::before,
.app-container::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 0;
}

.app-container::before {
  top: 0;
  height: 48vh;
  background:
    radial-gradient(circle at 9% 20%, rgba(255, 255, 255, 0.78) 0 28px, transparent 30px),
    radial-gradient(circle at 17% 23%, rgba(255, 255, 255, 0.44) 0 50px, transparent 52px),
    radial-gradient(circle at 89% 16%, rgba(255, 255, 255, 0.68) 0 34px, transparent 36px),
    radial-gradient(circle at 80% 19%, rgba(255, 255, 255, 0.38) 0 56px, transparent 58px),
    radial-gradient(circle at 62% 10%, rgba(255, 227, 95, 0.26) 0 8px, transparent 9px),
    radial-gradient(circle at 28% 12%, rgba(255, 123, 111, 0.26) 0 6px, transparent 7px),
    linear-gradient(180deg, rgba(255, 255, 255, 0) 58%, rgba(136, 205, 255, 0.28) 100%);
  opacity: 0.76;
}

.app-container::after {
  bottom: -1px;
  height: 170px;
  background:
    radial-gradient(circle at 8% 100%, #18a978 0 58px, transparent 60px),
    radial-gradient(circle at 18% 105%, #51c97b 0 78px, transparent 80px),
    radial-gradient(circle at 82% 105%, #4fbd73 0 76px, transparent 78px),
    radial-gradient(circle at 93% 100%, #13996f 0 62px, transparent 64px),
    linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(226, 255, 239, 0.9) 70%, #ecfff4);
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
