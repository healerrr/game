<template>
  <div class="leaderboard-page">
    <!-- 顶部 -->
    <div class="top-bar">
      <button class="back-btn" @click="$router.push('/lobby')">← 返回</button>
      <h2>排行榜</h2>
      <span class="stats-badge">{{ stats.onlinePlayers }}人在线</span>
    </div>

    <!-- 标签切换 -->
    <div class="tab-bar">
      <button
        :class="['tab-btn', { active: activeTab === 'personal' }]"
        @click="activeTab = 'personal'"
      >个人榜</button>
      <button
        :class="['tab-btn', { active: activeTab === 'bus' }]"
        @click="activeTab = 'bus'"
      >大巴榜</button>
    </div>

    <!-- 个人榜 -->
    <div v-if="activeTab === 'personal'" class="rank-list">
      <div
        v-for="item in personalRank"
        :key="item.id"
        class="rank-item"
        :class="{ 'is-me': item.id === player?.id }"
      >
        <div class="rank-num" :class="rankClass(item.rank)">
          {{ item.rank <= 3 ? ['🥇','🥈','🥉'][item.rank - 1] : item.rank }}
        </div>
        <div class="rank-info">
          <span class="rank-name">{{ item.nickname }}</span>
          <span class="rank-bus">{{ item.busNumber }}号车</span>
        </div>
        <div class="rank-stats">
          <span class="rank-points">{{ item.points }}分</span>
          <span class="rank-record">{{ item.wins }}胜{{ item.totalGames - item.wins }}负</span>
        </div>
      </div>
      <div v-if="personalRank.length === 0" class="empty">
        <p>暂无排行数据</p>
      </div>
    </div>

    <!-- 大巴榜 -->
    <div v-if="activeTab === 'bus'" class="rank-list">
      <div
        v-for="item in busRank"
        :key="item.busNumber"
        class="rank-item"
        :class="{ 'is-me': item.busNumber === player?.busNumber }"
      >
        <div class="rank-num" :class="rankClass(item.rank)">
          {{ item.rank <= 3 ? ['🥇','🥈','🥉'][item.rank - 1] : item.rank }}
        </div>
        <div class="rank-info">
          <span class="rank-name">{{ item.busNumber }}号车</span>
          <span class="rank-bus">{{ item.totalPlayers }}人</span>
        </div>
        <div class="rank-stats">
          <span class="rank-points">{{ item.avgPoints }}</span>
          <span class="rank-label">人均积分</span>
        </div>
      </div>
      <div v-if="busRank.length === 0" class="empty">
        <p>暂无排行数据</p>
      </div>
    </div>

    <!-- 底部导航 -->
    <nav class="bottom-nav">
      <button class="nav-btn" @click="$router.push('/lobby')">
        <span class="nav-icon">🎮</span>
        <span>游戏</span>
      </button>
      <button class="nav-btn active">
        <span class="nav-icon">🏆</span>
        <span>排行</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { gameState, getPlayer } from '../socket'

const activeTab = ref('personal')
const player = computed(() => getPlayer())

const personalRank = computed(() => gameState.personalRank)
const busRank = computed(() => gameState.busRank)
const stats = computed(() => gameState.stats)

function rankClass(rank) {
  if (rank <= 3) return 'top3'
  return ''
}
</script>

<style scoped>
.leaderboard-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.top-bar h2 {
  font-size: var(--font-lg);
  color: var(--text-primary);
}

.back-btn {
  background: transparent;
  color: var(--accent);
  font-size: var(--font-md);
  padding: 8px 0;
}

.stats-badge {
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.tab-bar {
  display: flex;
  padding: 12px 20px;
  gap: 8px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--font-md);
  text-align: center;
}

.tab-btn.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.rank-list {
  padding: 0 16px;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 14px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  gap: 12px;
}

.rank-item.is-me {
  border: 1px solid var(--accent);
}

.rank-num {
  font-size: 20px;
  width: 32px;
  text-align: center;
  color: var(--text-secondary);
}

.rank-num.top3 {
  font-size: 28px;
}

.rank-info {
  flex: 1;
}

.rank-name {
  display: block;
  font-size: var(--font-md);
  color: var(--text-primary);
  font-weight: 500;
}

.rank-bus {
  font-size: 12px;
  color: var(--text-muted);
}

.rank-stats {
  text-align: right;
}

.rank-points {
  display: block;
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--gold-light);
}

.rank-record, .rank-label {
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--bg-secondary);
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 8px;
}

.nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  border-radius: var(--radius-sm);
}

.nav-btn.active {
  color: var(--accent);
}

.nav-icon {
  font-size: 22px;
}

/* Reference-art refresh */
.leaderboard-page {
  min-height: 100vh;
  padding: 16px 12px 96px;
  background:
    radial-gradient(circle at 15% 12%, rgba(255, 255, 255, 0.36), transparent 22%),
    linear-gradient(180deg, rgba(0, 94, 235, 0.12), rgba(255, 255, 255, 0.25) 72%);
  color: var(--text-primary);
}

.top-bar {
  position: relative;
  top: auto;
  width: min(100%, 720px);
  margin: 0 auto;
  min-height: 62px;
  border-radius: 24px;
  padding: 8px 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 243, 255, 0.96));
  border: 2px solid var(--panel-border);
  box-shadow: var(--shadow-soft);
}

.top-bar h2 {
  margin: 0;
  text-align: center;
  font-size: 28px;
  font-weight: 900;
  color: #145bd8;
  text-shadow: 0 2px 0 #fff;
}

.back-btn {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff, #e6f1ff);
  color: #145bd8;
  font-size: 15px;
  font-weight: 900;
  box-shadow: 0 8px 16px rgba(14, 79, 181, 0.12);
}

.stats-badge {
  min-height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: linear-gradient(180deg, #fff5d9, #ffffff);
  border: 1px solid #f7d682;
  color: #d07300;
  font-size: 13px;
  font-weight: 900;
}

.tab-bar {
  width: min(100%, 720px);
  margin: 14px auto 0;
  padding: 6px;
  gap: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(210, 230, 255, 0.92);
  box-shadow: var(--shadow-soft);
}

.tab-btn {
  min-height: 46px;
  border-radius: 999px;
  padding: 0 12px;
  background: transparent;
  color: #426396;
  font-size: 17px;
  font-weight: 900;
}

.tab-btn.active {
  background: linear-gradient(180deg, #2f92ff, #0758ef);
  color: #fff;
  box-shadow: var(--shadow-button);
}

.rank-list {
  width: min(100%, 720px);
  margin: 14px auto 0;
  padding: 14px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 247, 255, 0.98));
  border: 2px solid var(--panel-border);
  box-shadow: var(--shadow-soft);
}

.rank-item {
  min-height: 78px;
  padding: 12px 14px;
  border-radius: 18px;
  margin-bottom: 10px;
  gap: 12px;
  background: #fff;
  border: 1px solid #dceafb;
  box-shadow: 0 8px 16px rgba(11, 74, 173, 0.08);
}

.rank-item:last-child {
  margin-bottom: 0;
}

.rank-item.is-me {
  border: 2px solid #2f8dff;
  background: linear-gradient(180deg, #fefefe, #eaf4ff);
}

.rank-num {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #edf5ff, #dbeaff);
  color: #175bd2;
  font-size: 19px;
  font-weight: 900;
}

.rank-num.top3 {
  background: linear-gradient(180deg, #fff3bc, #ffd257);
  color: #9b5b00;
  font-size: 27px;
}

.rank-name {
  color: #18325f;
  font-size: 18px;
  font-weight: 900;
}

.rank-bus {
  font-size: 13px;
  color: #6683ad;
  font-weight: 700;
}

.rank-points {
  color: #ff8a00;
  font-size: 23px;
  font-weight: 900;
}

.rank-record,
.rank-label {
  color: #7b92b8;
  font-size: 12px;
  font-weight: 700;
}

.empty {
  border-radius: 20px;
  background: #fff;
  color: #6683ad;
}

.bottom-nav {
  left: 12px;
  right: 12px;
  bottom: 12px;
  width: min(calc(100% - 24px), 720px);
  margin: 0 auto;
  border-radius: 24px;
  border: 2px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: var(--shadow-strong);
}

.nav-btn {
  border-radius: 18px;
  color: #6a83ad;
  font-weight: 900;
}

.nav-btn.active {
  color: #0c62ee;
  background: #eaf3ff;
}
</style>
