<template>
  <main class="results-page">
    <header class="results-topbar">
      <button type="button" class="back-btn" @click="$router.push('/lobby')">返回</button>
      <div class="results-title">
        <h1>我的战绩</h1>
        <p>查看每局积分变化和对手信息</p>
      </div>
      <span class="results-count">{{ records.length }}场</span>
    </header>

    <section class="results-summary">
      <article class="summary-chip">
        <span>当前积分</span>
        <strong>{{ player?.points ?? 0 }}</strong>
      </article>
      <article class="summary-chip">
        <span>总场次</span>
        <strong>{{ player?.totalGames ?? 0 }}</strong>
      </article>
      <article class="summary-chip">
        <span>胜率</span>
        <strong>{{ winRate }}</strong>
      </article>
    </section>

    <section v-if="loading" class="results-state">
      <p>正在加载战绩...</p>
    </section>

    <section v-else-if="error" class="results-state results-state--error">
      <p>{{ error }}</p>
      <button type="button" class="retry-btn" @click="loadResults">重新加载</button>
    </section>

    <section v-else-if="records.length === 0" class="results-state">
      <p>还没有历史战绩，先去开一局吧。</p>
    </section>

    <section v-else class="results-list">
      <article
        v-for="record in records"
        :key="record.id"
        class="result-card"
      >
        <div class="result-card__top">
          <div>
            <div class="result-card__title">
              <strong>{{ record.gameName }}</strong>
              <span :class="['result-badge', `result-badge--${record.result}`]">
                {{ resultLabel(record.result) }}
              </span>
            </div>
            <p class="result-card__time">{{ formatTime(record.createdAt) }}</p>
          </div>
          <div :class="['delta-pill', record.scoreDelta >= 0 ? 'delta-pill--up' : 'delta-pill--down']">
            {{ formatDelta(record.scoreDelta) }}
          </div>
        </div>

        <div class="result-meta">
          <div class="meta-row">
            <span class="meta-label">对手</span>
            <span class="meta-value">{{ formatPlayers(record.opponents, '暂无') }}</span>
          </div>
          <div v-if="record.teammates?.length" class="meta-row">
            <span class="meta-label">队友</span>
            <span class="meta-value">{{ formatPlayers(record.teammates, '无') }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">积分变化</span>
            <span class="meta-value">{{ record.pointsBefore }} -> {{ record.pointsAfter }}</span>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getPlayer } from '../socket'

const router = useRouter()
const player = computed(() => getPlayer())
const records = ref([])
const loading = ref(false)
const error = ref('')

const winRate = computed(() => {
  const totalGames = Number(player.value?.totalGames || 0)
  const wins = Number(player.value?.wins || 0)
  if (!totalGames) return '0%'
  return `${Math.round((wins / totalGames) * 100)}%`
})

onMounted(() => {
  if (!player.value?.id) {
    router.push('/')
    return
  }
  loadResults()
})

async function loadResults() {
  if (!player.value?.id) return

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`/api/players/${player.value.id}/results?limit=50`)
    const data = await response.json()

    if (!response.ok || data.error) {
      throw new Error(data.error || '加载战绩失败')
    }

    records.value = Array.isArray(data.records) ? data.records : []
  } catch (err) {
    error.value = err.message || '加载战绩失败'
  } finally {
    loading.value = false
  }
}

function resultLabel(result) {
  return {
    win: '胜利',
    loss: '失利',
    draw: '平局'
  }[result] || '对局'
}

function formatPlayers(players, fallback) {
  if (!Array.isArray(players) || players.length === 0) {
    return fallback
  }
  return players.map((item) => item.nickname || '未知玩家').join('、')
}

function formatDelta(delta) {
  const value = Number(delta || 0)
  return `${value >= 0 ? '+' : ''}${value}`
}

function formatTime(value) {
  if (!value) return '--'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}
</script>

<style scoped>
.results-page {
  min-height: 100vh;
  padding: 18px 14px 28px;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.26), transparent 24%),
    linear-gradient(180deg, #1380ff 0%, #69c4ff 42%, #eff8ff 100%);
}

.results-topbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  color: #fff;
}

.back-btn,
.retry-btn {
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
}

.back-btn {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.results-title h1,
.results-title p {
  margin: 0;
}

.results-title h1 {
  font-size: 24px;
  line-height: 1.1;
}

.results-title p {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.86;
}

.results-count {
  min-width: 58px;
  padding: 8px 10px;
  border-radius: 999px;
  text-align: center;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.results-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.summary-chip {
  padding: 14px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 30px rgba(19, 84, 180, 0.12);
}

.summary-chip span {
  display: block;
  font-size: 12px;
  color: #5b77a2;
}

.summary-chip strong {
  display: block;
  margin-top: 8px;
  font-size: 22px;
  color: #16396b;
}

.results-state {
  margin-top: 18px;
  padding: 28px 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  text-align: center;
  color: #4a5f85;
}

.results-state p {
  margin: 0;
}

.results-state--error {
  color: #a93e4c;
}

.retry-btn {
  margin-top: 14px;
  background: #1f7bff;
  color: #fff;
}

.results-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.result-card {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 28px rgba(10, 73, 168, 0.14);
}

.result-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.result-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.result-card__title strong {
  font-size: 18px;
  color: #15386d;
}

.result-card__time {
  margin: 6px 0 0;
  font-size: 12px;
  color: #7b8eaf;
}

.result-badge,
.delta-pill {
  min-width: 62px;
  padding: 6px 10px;
  border-radius: 999px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.result-badge--win,
.delta-pill--up {
  background: rgba(37, 191, 125, 0.14);
  color: #0f9962;
}

.result-badge--loss,
.delta-pill--down {
  background: rgba(255, 107, 107, 0.14);
  color: #d14458;
}

.result-badge--draw {
  background: rgba(77, 135, 255, 0.14);
  color: #2d69d5;
}

.result-meta {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.meta-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 10px;
  align-items: start;
}

.meta-label {
  font-size: 12px;
  color: #7b8eaf;
}

.meta-value {
  font-size: 14px;
  line-height: 1.5;
  color: #1f3557;
  word-break: break-word;
}

@media (max-width: 420px) {
  .results-page {
    padding-inline: 12px;
  }

  .results-summary {
    grid-template-columns: 1fr;
  }

  .results-topbar {
    grid-template-columns: 1fr;
  }

  .results-count {
    justify-self: start;
  }
}
</style>
