<template>
  <div class="spectator">
    <!-- 顶栏 -->
    <div class="room-header">
      <span class="spectator-badge">👁️ 观战中</span>
      <span class="game-label">{{ gameLabel }}</span>
      <span class="room-id">房间 {{ roomId }}</span>
      <button class="back-btn" @click="backToLobby">返回大厅</button>
    </div>

    <!-- 玩家列表 -->
    <div class="players-list">
      <div v-for="p in players" :key="p.id" class="player-card"
        :class="{ active: gs?.currentPlayer === p.id }">
        <div class="player-avatar">{{ p.nickname.charAt(0) }}</div>
        <div class="player-info">
          <span class="player-name">{{ p.nickname }}</span>
          <span class="player-bus">{{ p.busNumber }}号车</span>
        </div>
      </div>
    </div>

    <!-- 游戏状态展示区 -->
    <div class="game-display">
      <div v-if="!gs" class="loading-text">正在获取房间状态...</div>

      <!-- 剪刀石头布 -->
      <div v-else-if="gameType === 'rock_paper_scissors'">
        <div class="rps-display">
          <div v-for="p in players" :key="p.id" class="rps-player">
            <span class="rps-name">{{ p.nickname }}</span>
            <span class="rps-choice">{{ gs.choices?.[p.id] ? moveIcon(gs.choices[p.id]) : '❓' }}</span>
          </div>
        </div>
        <div v-if="gs.result" class="result-text">
          第 {{ gs.result.round }} 回合 — {{ getResultText(gs.result) }}
        </div>
        <div class="score-bar">
          <span v-for="p in players" :key="p.id">{{ p.nickname }}: {{ gs.scores?.[p.id] || 0 }}</span>
        </div>
      </div>

      <!-- 21点 -->
      <div v-else-if="gameType === 'blackjack'">
        <div class="bj-display">
          <div v-for="p in players" :key="p.id" class="bj-player">
            <span class="bj-name">{{ p.nickname }}</span>
            <span class="bj-hand">{{ getBJHand(p.id) }}</span>
            <span class="bj-score">{{ bjValue(p.id) }}</span>
          </div>
        </div>
      </div>

      <!-- 炸金花 -->
      <div v-else-if="gameType === 'zha_jin_hua'">
        <div class="zjh-display">
          <div class="zjh-pot">底池: {{ gs.pot }} 分</div>
          <div class="zjh-info">第 {{ gs.round }} 轮 — 轮到: {{ getPlayerName(gs.currentPlayer) }}</div>
          <div v-if="gs.phase === 'finished'" class="result-text">
            胜者: {{ getPlayerName(gs.finalWinner) }}
          </div>
        </div>
      </div>

      <!-- 知识问答 -->
      <div v-else-if="gameType === 'quiz'">
        <div class="quiz-display">
          <div v-if="gs.currentQuestion" class="quiz-q">
            <div class="quiz-q-text">Q{{ gs.round }}/{{ gs.maxRounds }}: {{ gs.currentQuestion.q }}</div>
            <div class="quiz-options">
              <div v-for="(opt, i) in gs.currentQuestion.options" :key="i" class="quiz-opt"
                :class="{ correct: gs.roundResult?.correct === i }">
                {{ ['A','B','C','D'][i] }}. {{ opt }}
              </div>
            </div>
          </div>
          <div v-if="gs.roundResult" class="quiz-result">
            答对: {{ (gs.roundResult.correctPlayers || []).map(getPlayerName).join(', ') || '无人' }}
          </div>
          <div class="quiz-scores">
            <span v-for="p in players" :key="p.id">{{ p.nickname }}: {{ gs.scores?.[p.id] || 0 }}</span>
          </div>
        </div>
      </div>

      <!-- 掼蛋 -->
      <div v-else-if="gameType === 'guandan'" class="spectator-simple">
        <div class="gd-info">轮到: {{ getPlayerName(gs.currentPlayer) }}</div>
        <div v-for="p in players" :key="p.id" class="gd-hand-info">
          {{ p.nickname }}: {{ gs.hands?.[p.id]?.length || 0 }} 张
        </div>
        <div v-if="gs.lastPlay" class="gd-last">
          上家: {{ getPlayerName(gs.lastPlay.playerId) }} 出了 {{ gs.lastPlay.cards.length }} 张牌
        </div>
      </div>

      <!-- 斗地主 -->
      <div v-else-if="gameType === 'doudizhu'" class="spectator-simple">
        <div class="gd-info">地主: {{ getPlayerName(gs.landlord) }}</div>
        <div class="gd-info">轮到: {{ getPlayerName(gs.currentPlayer) }}</div>
        <div v-for="p in players" :key="p.id" class="gd-hand-info">
          {{ p.nickname }}: {{ gs.handCounts?.[p.id] || 0 }} 张
        </div>
        <div v-if="gs.lastPlay" class="gd-last">
          上家: {{ getPlayerName(gs.lastPlay.playerId) }} 出了 {{ gs.lastPlay.cards.length }} 张牌
        </div>
      </div>

      <!-- 麻将 -->
      <div v-else-if="gameType === 'mahjong'" class="spectator-simple">
        <div class="mj-info">轮到: {{ getPlayerName(gs.currentPlayer) }} — {{ gs.phase === 'draw' ? '摸牌' : '打牌' }}</div>
        <div v-for="p in players" :key="p.id" class="mj-hand-info">
          {{ p.nickname }}: {{ gs.hands?.[p.id]?.length || 0 }} 张
        </div>
        <div v-if="gs.discarded?.length" class="mj-discards-show">
          牌河: {{ gs.discarded.map(c => c.rank).join(' ') }}
        </div>
      </div>
    </div>

    <!-- 观战人数 -->
    <div class="spectator-count">
      当前观战人数: {{ spectatorCount }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { socket, getPlayer } from '../socket'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.roomId)
const players = ref([])
const gs = ref(null)
const gameType = ref('')
const spectatorCount = ref(0)

const gameLabel = computed(() => {
  const map = {
    rock_paper_scissors: '✌️ 剪刀石头布',
    blackjack: '🃏 21点',
    zha_jin_hua: '♠️ 炸金花',
    quiz: '🧠 知识问答',
    guandan: '🃏 掼蛋',
    doudizhu: '🃏 斗地主',
    mahjong: '🀄 麻将'
  }
  return map[gameType.value] || gameType.value
})

let mounted = false
let joinTimeout = null

onMounted(() => {
  mounted = true
  joinTimeout = null

  function tryJoinRoom() {
    console.log('[Spectator] 尝试加入观战房间:', roomId.value)
    socket.emit('spectator:join', { roomId: roomId.value }, (res) => {
      if (!mounted) return
      if (joinTimeout) clearTimeout(joinTimeout)

      if (res.error) {
        console.log('[Spectator] spectator:join 失败:', res.error)
        // 如果未注册，自动注册为匿名观战者
        if (res.error.includes('注册')) {
          const anonName = '观战者_' + Math.random().toString(36).slice(2, 6)
          console.log('[Spectator] 自动注册匿名观战者:', anonName)
          socket.emit('player:register', { nickname: anonName, busNumber: 99 }, (regRes) => {
            if (!mounted) return
            if (regRes.player) {
              console.log('[Spectator] 匿名注册成功，重试观战')
              // 注册成功，再次尝试加入观战
              socket.emit('spectator:join', { roomId: roomId.value }, (res2) => {
                if (!mounted) return
                if (res2.error) {
                  console.error('[Spectator] 二次观战失败:', res2.error)
                  alert(res2.error)
                  router.push('/lobby')
                } else {
                  console.log('[Spectator] 观战加入成功:', res2.gameType)
                  gameType.value = res2.gameType
                  players.value = res2.players
                  gs.value = res2.gameState
                }
              })
            } else {
              console.error('[Spectator] 匿名注册失败:', regRes.error)
              alert('注册失败: ' + (regRes.error || '未知错误'))
              router.push('/lobby')
            }
          })
        } else {
          console.error('[Spectator] 观战失败:', res.error)
          alert(res.error)
          router.push('/lobby')
        }
      } else {
        console.log('[Spectator] 观战加入成功:', res.gameType)
        gameType.value = res.gameType
        players.value = res.players
        gs.value = res.gameState
      }
    })

    // 超时保护：3秒后如果还没收到回调，提示失败
    joinTimeout = setTimeout(() => {
      if (!mounted || gs.value) return
      console.error('[Spectator] 观战加入超时')
      alert('获取房间状态超时，请返回重试')
      router.push('/lobby')
    }, 3000)
  }

  // 确保 socket 连接就绪后再尝试
  function ensureConnection(callback) {
    if (socket.connected) {
      callback()
    } else {
      console.log('[Spectator] socket 未连接，等待连接...')
      // 使用 once 避免重复调用
      const onConnect = () => {
        console.log('[Spectator] socket 已连接')
        callback()
      }
      socket.once('connect', onConnect)
      // 如果 5 秒内还没连接上，直接尝试（让服务器返回错误提示）
      const connTimeout = setTimeout(() => {
        socket.off('connect', onConnect)
        console.warn('[Spectator] socket 连接等待超时，直接尝试')
        callback()
      }, 5000)
    }
  }

  ensureConnection(tryJoinRoom)

  socket.on('game:state', handleState)
})

onUnmounted(() => {
  mounted = false
  if (joinTimeout) clearTimeout(joinTimeout)
  if (roomId.value) {
    socket.emit('spectator:leave', { roomId: roomId.value }, () => {})
  }
  socket.off('game:state', handleState)
})

function handleState(data) {
  gs.value = data.gameState
  if (data.players) players.value = data.players
}

function getPlayerName(pid) {
  if (!pid) return '未知'
  const p = players.value?.find(p => p.id === pid)
  return p?.nickname || pid
}

function moveIcon(choice) {
  return { rock: '✊', paper: '🖐️', scissors: '✌️' }[choice] || '❓'
}

function getResultText(result) {
  if (!result) return ''
  const winner = getPlayerName(result.winner)
  return `${winner} 赢了这回合`
}

function getBJHand(pid) {
  const hand = gs.value?.hands?.[pid]
  if (!hand) return '无牌'
  return hand.map(c => c.rank + c.suit.charAt(0)).join(' ')
}

function bjValue(pid) {
  const hand = gs.value?.hands?.[pid]
  if (!hand) return 0
  let total = 0, aces = 0
  for (const c of hand) {
    total += c.value
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total > 21 ? `${total} 爆!` : total
}

function backToLobby() {
  socket.emit('spectator:leave', { roomId: roomId.value })
  router.push('/lobby')
}
</script>

<style scoped>
.spectator {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.room-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-wrap: wrap;
}

.spectator-badge {
  background: var(--accent);
  color: #fff;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.game-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.room-id {
  font-size: 12px;
  color: var(--text-muted);
}

.back-btn {
  margin-left: auto;
  padding: 6px 16px;
  background: rgba(255,255,255,0.1);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.players-list {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  background: rgba(0,0,0,0.2);
}

.player-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  min-width: 120px;
  transition: all 0.3s;
}

.player-card.active {
  border: 2px solid var(--accent);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
}

.player-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name {
  font-size: 13px;
  font-weight: 600;
}

.player-bus {
  font-size: 11px;
  color: var(--text-muted);
}

.game-display {
  padding: 20px 16px;
}

.loading-text {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}

.result-text {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  padding: 16px;
  color: var(--gold-light);
}

.rps-display {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 16px;
}

.rps-player {
  text-align: center;
}

.rps-name {
  display: block;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--text-secondary);
}

.rps-choice {
  font-size: 40px;
}

.score-bar {
  display: flex;
  justify-content: center;
  gap: 24px;
  font-size: 14px;
  color: var(--text-secondary);
}

.bj-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bj-player {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.bj-name { font-weight: 600; margin-bottom: 4px; }
.bj-hand { font-size: 14px; color: var(--text-secondary); }
.bj-score { font-size: 18px; font-weight: 700; color: var(--gold-light); }

.zjh-display { text-align: center; }

.zjh-pot {
  font-size: 24px;
  font-weight: 700;
  color: var(--gold-light);
  margin-bottom: 8px;
}

.zjh-info { font-size: 14px; color: var(--text-secondary); }

.reveal-text, .quiz-result {
  text-align: center;
  padding: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.quiz-q-text {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quiz-opt {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.quiz-opt.correct {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  font-weight: 600;
}

.quiz-scores {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

.spectator-simple {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gd-info, .mj-info {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent);
}

.gd-hand-info, .mj-hand-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.gd-last {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.mj-discards-show {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 8px 12px;
  background: rgba(0,0,0,0.3);
  border-radius: var(--radius-sm);
  word-break: break-all;
}

.spectator-count {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px solid rgba(255,255,255,0.05);
  margin-top: 20px;
}
</style>
