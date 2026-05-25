<template>
  <div class="admin-page">
    <div class="admin-header">
      <button class="back-btn" @click="$router.push('/lobby')">← 大厅</button>
      <h2>主持人面板</h2>
      <span class="online-badge">{{ players.filter(p => p.online).length }}/{{ players.length }} 在线</span>
    </div>

    <!-- 快捷操作 -->
    <div class="admin-actions">
      <button class="admin-btn broadcast" @click="showBroadcast = true">📢 全服广播</button>
    </div>

    <!-- 广播弹窗 -->
    <div v-if="showBroadcast" class="modal-overlay" @click.self="showBroadcast = false">
      <div class="modal-box">
        <h3>发送广播</h3>
        <textarea v-model="broadcastMsg" placeholder="输入广播消息..." rows="3"></textarea>
        <div class="modal-btns">
          <button class="modal-btn cancel" @click="showBroadcast = false">取消</button>
          <button class="modal-btn confirm" @click="sendBroadcast" :disabled="!broadcastMsg.trim()">发送</button>
        </div>
      </div>
    </div>

    <!-- 发积分弹窗 -->
    <div v-if="showGivePoints" class="modal-overlay" @click.self="showGivePoints = false">
      <div class="modal-box">
        <h3>发放积分给 {{ giveTarget?.nickname }}</h3>
        <input v-model="giveAmount" type="number" placeholder="积分数量" />
        <input v-model="giveReason" type="text" placeholder="理由（可选）" />
        <div class="modal-btns">
          <button class="modal-btn cancel" @click="showGivePoints = false">取消</button>
          <button class="modal-btn confirm" @click="doGivePoints" :disabled="!giveAmount">确认发放</button>
        </div>
      </div>
    </div>

    <!-- 玩家列表 -->
    <div class="player-section">
      <h3>玩家列表</h3>
      <div class="player-list">
        <div v-for="p in sortedPlayers" :key="p.id" class="admin-player">
          <div class="ap-info">
            <span class="ap-name">{{ p.nickname }}</span>
            <span class="ap-bus">{{ p.busNumber }}号车</span>
            <span class="ap-status" :class="{ online: p.online }">{{ p.online ? '在线' : '离线' }}</span>
          </div>
          <div class="ap-stats">
            <span class="ap-points" :class="{ negative: p.points < 0 }">{{ p.points }}分</span>
            <span class="ap-record">{{ p.wins }}胜{{ p.totalGames - p.wins }}负</span>
          </div>
          <button class="ap-give-btn" @click="openGivePoints(p)">+分</button>
        </div>
      </div>
    </div>

    <!-- 服务器统计 -->
    <div class="stats-section">
      <h3>服务器状态</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ stats.totalPlayers }}</span>
          <span class="stat-label">总玩家</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.onlinePlayers }}</span>
          <span class="stat-label">在线</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.activeRooms }}</span>
          <span class="stat-label">进行中</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { socket, gameState } from '../socket'

const showBroadcast = ref(false)
const broadcastMsg = ref('')
const showGivePoints = ref(false)
const giveTarget = ref(null)
const giveAmount = ref(null)
const giveReason = ref('')
const players = ref([])
const stats = ref({ totalPlayers: 0, onlinePlayers: 0, activeRooms: 0 })

const sortedPlayers = computed(() => {
  return [...players.value].sort((a, b) => b.points - a.points)
})

onMounted(async () => {
  // 定期刷新玩家列表
  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/admin/players')
      const data = await res.json()
      players.value = data.players
      stats.value = data.stats
    } catch (e) {}
  }
  fetchPlayers()
  const interval = setInterval(fetchPlayers, 5000)

  socket.on('server:update', (data) => {
    stats.value = data.stats || {}
  })

  onUnmounted(() => clearInterval(interval))
})

async function sendBroadcast() {
  if (!broadcastMsg.value.trim()) return
  await fetch('/api/admin/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: broadcastMsg.value.trim() })
  })
  broadcastMsg.value = ''
  showBroadcast.value = false
}

function openGivePoints(player) {
  giveTarget.value = player
  giveAmount.value = null
  giveReason.value = ''
  showGivePoints.value = true
}

async function doGivePoints() {
  if (!giveAmount.value || !giveTarget.value) return
  await fetch('/api/admin/give-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: giveTarget.value.id,
      amount: parseInt(giveAmount.value),
      reason: giveReason.value
    })
  })
  showGivePoints.value = false
  // 刷新列表
  const res = await fetch('/api/admin/players')
  const data = await res.json()
  players.value = data.players
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: var(--bg-primary);
  padding-bottom: 20px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.admin-header h2 {
  font-size: var(--font-lg);
  color: var(--text-primary);
}

.back-btn {
  background: transparent;
  color: var(--accent);
  font-size: var(--font-md);
  padding: 8px 0;
}

.online-badge {
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
}

.admin-actions {
  padding: 12px 20px;
}

.admin-btn {
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  font-weight: 600;
}

.admin-btn.broadcast {
  background: var(--accent);
  color: #fff;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-box {
  background: var(--bg-secondary);
  padding: 24px;
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 340px;
}

.modal-box h3 {
  font-size: var(--font-md);
  color: var(--text-primary);
  margin-bottom: 16px;
}

.modal-box textarea, .modal-box input {
  width: 100%;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-md);
  outline: none;
  margin-bottom: 12px;
  resize: none;
  font-family: inherit;
}

.modal-box textarea:focus, .modal-box input:focus {
  border-color: var(--accent);
}

.modal-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: var(--font-md);
}

.modal-btn.cancel {
  background: rgba(255,255,255,0.1);
  color: var(--text-secondary);
}

.modal-btn.confirm {
  background: var(--accent);
  color: #fff;
}

.modal-btn:disabled {
  opacity: 0.5;
}

.player-section {
  padding: 12px 20px;
}

.player-section h3, .stats-section h3 {
  font-size: var(--font-sm);
  color: var(--text-muted);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.player-list {
  max-height: 400px;
  overflow-y: auto;
}

.admin-player {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  gap: 8px;
}

.ap-info {
  flex: 1;
}

.ap-name {
  display: block;
  font-size: var(--font-sm);
  color: var(--text-primary);
  font-weight: 600;
}

.ap-bus {
  font-size: 11px;
  color: var(--text-muted);
}

.ap-status {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 8px;
}

.ap-status.online {
  color: var(--success);
}

.ap-stats {
  text-align: right;
}

.ap-points {
  display: block;
  font-size: var(--font-md);
  font-weight: 700;
  color: var(--gold-light);
}

.ap-points.negative {
  color: var(--danger);
}

.ap-record {
  font-size: 11px;
  color: var(--text-muted);
}

.ap-give-btn {
  padding: 6px 12px;
  background: rgba(46,213,115,0.15);
  color: var(--success);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
}

.stats-section {
  padding: 12px 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 16px;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
