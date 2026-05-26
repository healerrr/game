<template>
  <main
    class="game-room"
    :class="{
      'fullscreen-game': isFullscreenGame,
      'quiz-layout': gameType === 'quiz',
      'rps-layout': gameType === 'rock_paper_scissors',
      'guess-layout': gameType === 'guess_number',
      'board-layout': ['gomoku', 'chess', 'zha_jin_hua', 'undercover'].includes(gameType)
    }"
  >
    <header class="game-header">
      <button class="back-btn" @click="backToLobby">‹</button>
      <h1>{{ gameLabel }}</h1>
      <div class="point-pill"><span class="coin-dot"></span>积分 {{ player?.points ?? 0 }}</div>
    </header>

    <section v-if="gameType === 'rock_paper_scissors'" class="mode-card rps-mode">
      <div class="profile-row">
        <div class="side side-me">
          <div class="avatar-circle">{{ playerInitial }}</div>
          <div>
            <strong>{{ player?.nickname }}</strong>
            <p>🚌 {{ player?.busNumber }}号车</p>
          </div>
        </div>
        <div class="vs-tag">VS</div>
        <div class="side side-opponent">
          <div>
            <strong>{{ opponentName }}</strong>
            <p>🚌 {{ opponentBus }}号车</p>
          </div>
          <div class="avatar-circle muted">{{ opponentInitial }}</div>
        </div>
      </div>

      <div class="result-line">
        <span>我方胜局 {{ myScore }}</span>
        <span>对手胜局 {{ opponentScore }}</span>
      </div>

      <div class="play-zone">
        <template v-if="gs.phase === 'choose'">
          <div class="ring-wrap">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(31,107,255,.18)" stroke-width="8" />
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                :stroke="timerColor"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="270"
                :stroke-dashoffset="timerOffset"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <strong>{{ timeLeft }}s</strong>
          </div>
          <p class="phase-copy">请选择出拳，战胜对手赢积分</p>
          <div class="move-row">
            <button
              v-for="move in moves"
              :key="move.key"
              class="move-btn"
              :class="{ selected: selectedMove === move.key }"
              @click="selectMove(move.key)"
            >
              <span class="emoji">{{ move.icon }}</span>
              <span>{{ move.label }}</span>
            </button>
          </div>
        </template>

        <template v-else-if="gs.phase === 'reveal'">
          <div class="reveal-row">
            <div class="reveal-piece">
              <span>{{ moveIcon(myChoice) }}</span>
              <small>我方</small>
            </div>
            <div class="vs-tag big">VS</div>
            <div class="reveal-piece">
              <span>{{ moveIcon(opponentChoice) }}</span>
              <small>对手</small>
            </div>
          </div>
          <div class="round-result" :class="roundResult">{{ roundResultText }}</div>
          <button class="primary-btn next-round-btn" @click="nextRound">开始下一轮</button>
        </template>

        <template v-else-if="gs.phase === 'finished'">
          <div class="round-result large" :class="{ win: gs.finalWinner === player?.id, lose: gs.finalWinner !== player?.id }">
            {{ gs.finalWinner === player?.id ? '恭喜获胜' : '再接再厉' }}
          </div>
          <div class="dual-btns">
            <button class="primary-btn" @click="rematch">再来一局</button>
            <button class="secondary-btn" @click="backToLobby">返回大厅</button>
          </div>
        </template>
      </div>
    </section>

    <section v-else-if="gameType === 'guess_number'" class="mode-card guess-mode">
      <div class="profile-row compact">
        <div class="side side-me">
          <div class="avatar-circle">{{ playerInitial }}</div>
          <div>
            <strong>{{ player?.nickname }}</strong>
            <p>🚌 {{ player?.busNumber }}号车</p>
          </div>
        </div>
        <button class="small-action" @click="$router.push('/leaderboard')">🏆 今日排行</button>
      </div>

      <div class="hero-strip">猜出 1~100 的神秘数字</div>

      <div class="status-chips">
        <span>范围 {{ gs.range?.low ?? 1 }} - {{ gs.range?.high ?? 100 }}</span>
        <span>剩余次数 {{ remainingChances }}</span>
        <span>上一轮 {{ lastGuessLabel }}</span>
      </div>

      <div class="number-screen">{{ guessNum || '0' }}</div>

      <div class="num-pad" v-if="gs.phase === 'guess' && gs.currentPlayer === player?.id">
        <button v-for="n in [1,2,3,4,5,6,7,8,9,0]" :key="`n-${n}`" @click="appendDigit(n)">
          {{ n }}
        </button>
        <button class="erase" @click="removeDigit">⌫</button>
      </div>

      <div class="hint-line">
        {{ gs.currentPlayer === player?.id ? '请输入你的数字并提交' : `等待 ${opponentName} 猜测中...` }}
      </div>

      <div class="dual-btns">
        <button
          class="primary-btn"
          :disabled="!guessNum || gs.phase !== 'guess' || gs.currentPlayer !== player?.id"
          @click="makeGuess"
        >
          提交答案
        </button>
        <button class="secondary-btn" @click="guessNum = ''">重新输入</button>
      </div>

      <div v-if="gs.phase === 'finished'" class="final-box">
        <p>正确答案：<strong>{{ gs.secret }}</strong></p>
        <p>{{ gs.winner === player?.id ? '你猜中了，太厉害了！' : `${opponentName} 先一步猜中` }}</p>
        <div class="dual-btns">
          <button class="primary-btn" @click="rematch">再来一局</button>
          <button class="secondary-btn" @click="backToLobby">返回大厅</button>
        </div>
      </div>
    </section>

    <section v-else-if="gameType === 'quiz'" class="mode-card quiz-mode">
      <div class="profile-row compact">
        <div class="side side-me">
          <div class="avatar-circle">{{ playerInitial }}</div>
          <div>
            <strong>{{ player?.nickname }}</strong>
            <p>🚌 {{ player?.busNumber }}号车</p>
          </div>
        </div>
        <button class="small-action" @click="$router.push('/leaderboard')">🏆 今日排行</button>
      </div>

      <div class="quiz-head">
        <span>当前第 {{ gs.round || 1 }} 题 / 共 {{ gs.maxRounds || 10 }} 题</span>
        <span>答对 +20 积分</span>
      </div>

      <div v-if="gs.phase === 'question'" class="quiz-panel">
        <div class="ring-wrap small">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(31,107,255,.18)" stroke-width="8" />
            <circle
              cx="50"
              cy="50"
              r="43"
              fill="none"
              stroke="#1f6bff"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="270"
              :stroke-dashoffset="270 * (1 - quizTimerPercent)"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <strong>{{ quizTimeLeft }}s</strong>
        </div>

        <h3>{{ gs.currentQuestion?.q }}</h3>

        <div class="quiz-options">
          <button
            v-for="(opt, i) in (gs.currentQuestion?.options || [])"
            :key="`${i}-${opt}`"
            :disabled="gs.answeredPlayers?.includes(player?.id)"
            :class="{ selected: quizAnswer === i }"
            @click="quizSubmitAnswer(i)"
          >
            <span class="letter">{{ ['A', 'B', 'C', 'D'][i] }}</span>
            <span>{{ opt }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="gs.phase === 'answer'" class="final-box">
        <p>
          正确答案：
          <strong>{{ ['A', 'B', 'C', 'D'][gs.roundResult?.correct] }}</strong>
        </p>
        <p>{{ gs.currentQuestion?.options?.[gs.roundResult?.correct] }}</p>
        <button class="primary-btn" @click="quizNextRound">
          {{ gs.round >= gs.maxRounds ? '查看结算' : '下一题' }}
        </button>
      </div>

      <div v-else-if="gs.phase === 'finished'" class="final-box">
        <p>{{ gs.finalWinner === player?.id ? '恭喜你获得本轮第一' : `${getPlayerName(gs.finalWinner)} 获得本轮第一` }}</p>
        <div class="score-list">
          <div v-for="pid in gs.players || []" :key="pid" class="score-item">
            <span>{{ getPlayerName(pid) }}</span>
            <strong>{{ gs.scores?.[pid] || 0 }}</strong>
          </div>
        </div>
        <div class="dual-btns">
          <button class="primary-btn" @click="rematch">再来一局</button>
          <button class="secondary-btn" @click="backToLobby">返回大厅</button>
        </div>
      </div>
    </section>

    <ZhaJinHuaBoard
      v-else-if="gameType === 'zha_jin_hua'"
      :gs="gs"
      :player="player"
      :room-players="roomPlayers"
      @action="emitGameAction"
      @rematch="rematch"
      @back="backToLobby"
    />

    <GuandanBoard
      v-else-if="gameType === 'guandan'"
      :gs="gs"
      :player="player"
      :room-players="roomPlayers"
      @action="emitGameAction"
      @rematch="rematch"
      @back="backToLobby"
    />

    <MahjongBoard
      v-else-if="gameType === 'mahjong'"
      :gs="gs"
      :player="player"
      :room-players="roomPlayers"
      @action="emitGameAction"
      @rematch="rematch"
      @back="backToLobby"
    />

    <GomokuBoard
      v-else-if="gameType === 'gomoku'"
      :gs="gs"
      :player="player"
      :room-players="roomPlayers"
      @action="emitGameAction"
      @rematch="rematch"
      @back="backToLobby"
    />

    <ChessBoard
      v-else-if="gameType === 'chess'"
      :gs="gs"
      :player="player"
      :room-players="roomPlayers"
      @action="emitGameAction"
      @rematch="rematch"
      @back="backToLobby"
    />

    <UndercoverGame
      v-else-if="gameType === 'undercover'"
      :gs="gs"
      :player="player"
      :roomPlayers="roomPlayers"
      @back="backToLobby"
      @rematch="rematch"
    />

    <section v-else class="mode-card fallback">
      <h3>该游戏暂未启用新 UI</h3>
      <button class="primary-btn" @click="backToLobby">返回大厅</button>
    </section>

    <transition name="fade">
      <div v-if="opponentDisconnected" class="dc-overlay">
        <p>玩家掉线，正在等待重连...</p>
      </div>
    </transition>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gameState, getPlayer, socket } from '../socket'
import UndercoverGame from '../components/UndercoverGame.vue'
import ZhaJinHuaBoard from '../components/games/ZhaJinHuaBoard.vue'
import GuandanBoard from '../components/games/GuandanBoard.vue'
import MahjongBoard from '../components/games/MahjongBoard.vue'
import GomokuBoard from '../components/games/GomokuBoard.vue'
import ChessBoard from '../components/games/ChessBoard.vue'

const route = useRoute()
const router = useRouter()

const roomId = computed(() => route.params.roomId)
const player = computed(() => getPlayer())
const gs = ref({})
const opponentDisconnected = ref(false)
const selectedMove = ref(null)
const guessNum = ref('')
const timeLeft = ref(5)
const quizAnswer = ref(null)
const quizTimeLeft = ref(15)

let timerInterval = null
let stateHandler = null
let resultHandler = null
let dcHandler = null

const gameType = computed(() => gameState.currentRoom?.gameType)
const roomPlayers = computed(() => gameState.currentRoom?.players || [])
const isFullscreenGame = computed(() => ['guandan', 'mahjong'].includes(gameType.value))

const gameLabel = computed(() => {
  const labels = {
    rock_paper_scissors: '剪刀石头布',
    guess_number: '猜数字',
    blackjack: '21点',
    zha_jin_hua: '炸金花',
    undercover: '谁是卧底',
    quiz: '快问快答',
    guandan: '掼蛋',
    mahjong: '红中麻将',
    gomoku: '五子棋',
    chess: '象棋'
  }
  return labels[gameType.value] || '游戏对局'
})

const opponentName = computed(() => {
  const opponent = roomPlayers.value.find((item) => item.id !== player.value?.id)
  return opponent?.nickname || '对手'
})

const opponentBus = computed(() => {
  const opponent = roomPlayers.value.find((item) => item.id !== player.value?.id)
  return opponent?.busNumber || '-'
})

const myScore = computed(() => gs.value?.scores?.[player.value?.id] || 0)
const opponentScore = computed(() => {
  const opponentId = roomPlayers.value.find((item) => item.id !== player.value?.id)?.id
  return gs.value?.scores?.[opponentId] || 0
})

const myChoice = computed(() => gs.value?.result?.choices?.[player.value?.id])
const opponentChoice = computed(() => {
  const opponentId = roomPlayers.value.find((item) => item.id !== player.value?.id)?.id
  return gs.value?.result?.choices?.[opponentId]
})

const roundResult = computed(() => {
  if (!gs.value?.result) return ''
  if (!gs.value.result.winner) return 'draw'
  return gs.value.result.winner === player.value?.id ? 'win' : 'lose'
})

const roundResultText = computed(() => {
  if (!gs.value?.result) return ''
  if (!gs.value.result.winner) return '平局'
  return gs.value.result.winner === player.value?.id ? '本轮获胜' : '本轮失利'
})

const timerColor = computed(() => timeLeft.value > 2 ? '#2eb87f' : '#ff4e4e')
const timerOffset = computed(() => 270 * (1 - timeLeft.value / 5))

const moves = [
  { key: 'rock', icon: '✊', label: '石头' },
  { key: 'scissors', icon: '✌️', label: '剪刀' },
  { key: 'paper', icon: '🖐️', label: '布' }
]

const playerInitial = computed(() => (player.value?.nickname || '团').slice(0, 1))
const opponentInitial = computed(() => (opponentName.value || '对').slice(0, 1))

const remainingChances = computed(() => {
  const total = 10
  const used = gs.value?.guesses?.length || 0
  return Math.max(0, total - used)
})

const lastGuessLabel = computed(() => {
  const latest = gs.value?.guesses?.at?.(-1)
  return latest ? latest.guess : '--'
})

const quizTimerPercent = computed(() => {
  const total = gs.value?.phase === 'answer' ? 8 : 15
  const left = Math.max(0, Math.min(total, quizTimeLeft.value))
  return left / total
})

function getPlayerName(playerId) {
  if (!playerId) return '玩家'
  return roomPlayers.value.find((item) => item.id === playerId)?.nickname || '玩家'
}

function moveIcon(key) {
  return { rock: '✊', scissors: '✌️', paper: '🖐️' }[key] || '❔'
}

function selectMove(move) {
  selectedMove.value = move
  socket.emit('game:action', { action: { type: 'choose', choice: move } })
}

function appendDigit(num) {
  const text = String(num)
  const merged = `${guessNum.value}${text}`.slice(0, 3)
  if (!merged) return
  if (Number(merged) > 100) return
  guessNum.value = merged
}

function removeDigit() {
  guessNum.value = guessNum.value.slice(0, -1)
}

function makeGuess() {
  const value = Number.parseInt(guessNum.value, 10)
  if (!Number.isFinite(value)) return

  const low = gs.value?.range?.low ?? 1
  const high = gs.value?.range?.high ?? 100
  if (value < low || value > high) {
    alert(`请输入 ${low} 到 ${high} 之间的数字`)
    return
  }

  socket.emit('game:action', { action: { type: 'guess', guess: value } })
  guessNum.value = ''
}

function nextRound() {
  selectedMove.value = null
  socket.emit('game:action', { action: { type: 'next_round' } })
}

function quizSubmitAnswer(index) {
  quizAnswer.value = index
  socket.emit('game:action', { action: { type: 'answer', answer: index } })
}

function quizNextRound() {
  quizAnswer.value = null
  socket.emit('game:action', { action: { type: 'next_round' } })
}

function emitGameAction(action) {
  socket.emit('game:action', { action })
}

function enterQuickPlayRoom(data) {
  gameState.currentRoom = {
    roomId: data.roomId,
    gameType: data.gameType,
    players: data.players,
    gameState: data.gameState
  }
  gameState.currentGame = data.gameState
  gs.value = data.gameState || {}
  socket.emit('room:join', { roomId: data.roomId })
  router.push(`/game/${data.roomId}`)
}

async function rematch() {
  if (!player.value || !gameType.value) return
  try {
    const response = await fetch('/api/bots/quick-play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.value.id, gameType: gameType.value })
    })
    const data = await response.json()
    if (!response.ok || data.error) throw new Error(data.error || '启动失败')
    enterQuickPlayRoom(data)
  } catch (error) {
    alert(error.message || '启动游戏失败')
  }
}

function backToLobby() {
  router.push('/lobby')
}

onMounted(() => {
  if (!player.value) {
    router.push('/')
    return
  }

  gs.value = gameState.currentGame || {}

  stateHandler = (event) => {
    gs.value = event.detail.gameState
  }
  window.addEventListener('game:state', stateHandler)

  resultHandler = (event) => {
    const { players: resultPlayers, ...result } = event.detail
    gs.value = { ...gs.value, ...result, resultPlayers }
  }
  window.addEventListener('game:result', resultHandler)

  dcHandler = () => {
    opponentDisconnected.value = true
    setTimeout(() => {
      if (opponentDisconnected.value) router.push('/lobby')
    }, 5000)
  }
  window.addEventListener('game:opponent_disconnected', dcHandler)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (stateHandler) window.removeEventListener('game:state', stateHandler)
  if (resultHandler) window.removeEventListener('game:result', resultHandler)
  if (dcHandler) window.removeEventListener('game:opponent_disconnected', dcHandler)
})

watch(() => gs.value?.timerStarted, (started) => {
  if (timerInterval) clearInterval(timerInterval)
  if (!started) return

  if (gameType.value === 'quiz') {
    quizTimeLeft.value = gs.value.timer || 15
  } else {
    timeLeft.value = gs.value.timer || 5
  }

  timerInterval = setInterval(() => {
    if (gameType.value === 'quiz') {
      quizTimeLeft.value -= 1
      if (quizTimeLeft.value <= 0) clearInterval(timerInterval)
      return
    }

    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      clearInterval(timerInterval)
      if (gs.value.phase === 'choose' && !selectedMove.value) {
        const randomMove = ['rock', 'scissors', 'paper'][Math.floor(Math.random() * 3)]
        selectMove(randomMove)
      }
    }
  }, 1000)
})

watch(() => gs.value?.phase, (phase) => {
  if (gameType.value !== 'quiz') return
  if (phase === 'question' || phase === 'answer') {
    quizTimeLeft.value = gs.value.timer || (phase === 'question' ? 15 : 8)
  }
})

watch(() => roomId.value, () => {
  opponentDisconnected.value = false
})
</script>

<style scoped>
.game-room {
  --game-header-space: 60px;
  --game-viewport-height: calc(100dvh - var(--game-header-space));
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.game-room.fullscreen-game {
  width: 100vw;
  height: 100dvh;
  --game-viewport-height: 100dvh;
  overflow: hidden;
  padding: 0;
}

.game-room.fullscreen-game .game-header {
  display: none;
}

.game-header {
  min-height: 36px;
  border-radius: 12px;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin: 8px 8px 6px;
  background: linear-gradient(180deg, rgba(15, 108, 255, 0.94), rgba(4, 78, 217, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 6px 14px rgba(8, 64, 164, 0.34);
}

.game-header h1 {
  margin: 0;
  text-align: center;
  font-size: 22px;
  font-weight: 900;
  text-shadow: 0 3px 10px rgba(2, 40, 130, 0.45);
}

.back-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(180deg, #f9fcff, #ddeafe);
  color: #1a5dcf;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  border: 1px solid #d2e1f8;
}

.point-pill {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.94);
  color: #1653ba;
}

.coin-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex: 0 0 auto;
  background:
    radial-gradient(circle at 34% 28%, #fff5b6 0 18%, transparent 19%),
    linear-gradient(180deg, #ffd95f, #f49d11);
  border: 2px solid #fff1a8;
  box-shadow: inset 0 -2px 0 rgba(170, 96, 0, 0.18), 0 2px 5px rgba(10, 78, 180, 0.16);
}

.mode-card {
  max-width: 920px;
  margin: 0 auto;
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f2f8ff 100%);
  border: 2px solid #d9e8fb;
  padding: 16px;
  box-shadow: 0 14px 30px rgba(9, 70, 177, 0.22);
  color: var(--text-primary);
}

.profile-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
}

.profile-row.compact {
  grid-template-columns: 1fr auto;
}

.side {
  min-height: 76px;
  border-radius: 15px;
  border: 1px solid #d6e5fa;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
}

.side-opponent {
  justify-content: flex-end;
}

.side strong {
  font-size: 18px;
  line-height: 1.2;
}

.side p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(180deg, #eef6ff, #d9e9ff);
  border: 1px solid #c8dbf7;
  color: #1f6bff;
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 900;
}

.avatar-circle.muted {
  color: #6a87b8;
}

.vs-tag {
  font-size: 20px;
  font-weight: 900;
  color: #ff9f1a;
  text-shadow: 0 2px 8px rgba(253, 137, 0, 0.3);
}

.vs-tag.big {
  font-size: 30px;
}

.small-action {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #d2e2f8;
  background: linear-gradient(180deg, #f8fbff, #e7f1ff);
  color: #1f66da;
  font-size: 14px;
  font-weight: 800;
}

.result-line {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.result-line span {
  min-height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #ecf4ff;
  color: #2c4f87;
  font-weight: 700;
}

.play-zone {
  margin-top: 14px;
  border-radius: 16px;
  border: 1px solid #d6e6fb;
  background: #fafdff;
  padding: 16px;
}

.ring-wrap {
  width: 112px;
  height: 112px;
  margin: 0 auto;
  position: relative;
}

.ring-wrap svg {
  width: 112px;
  height: 112px;
}

.ring-wrap strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #1f6bff;
  font-size: 28px;
  font-weight: 900;
}

.ring-wrap.small {
  width: 96px;
  height: 96px;
}

.ring-wrap.small svg {
  width: 96px;
  height: 96px;
}

.phase-copy {
  margin: 10px 0 0;
  text-align: center;
  color: var(--text-secondary);
}

.move-row {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.move-btn {
  min-height: 98px;
  border-radius: 16px;
  border: 2px solid #d8e8fb;
  background: #fff;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 800;
}

.move-btn .emoji {
  font-size: 36px;
}

.move-btn.selected {
  border-color: #1f6bff;
  box-shadow: 0 10px 18px rgba(9, 89, 208, 0.2);
}

.reveal-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}

.reveal-piece {
  border-radius: 16px;
  border: 1px solid #d9e8fb;
  background: #fff;
  min-height: 120px;
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 10px;
}

.reveal-piece span {
  font-size: 44px;
}

.reveal-piece small {
  color: var(--text-secondary);
  font-size: 14px;
}

.round-result {
  margin-top: 12px;
  min-height: 48px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  font-size: 20px;
  font-weight: 900;
}

.round-result.win {
  color: #137d4f;
  background: #ddf8ec;
}

.round-result.lose {
  color: #b53131;
  background: #ffe2e2;
}

.round-result.draw {
  color: #385f99;
  background: #e7f0ff;
}

.round-result.large {
  min-height: 60px;
}

.dual-btns {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.primary-btn,
.secondary-btn {
  min-height: 48px;
  border-radius: 999px;
  font-size: 17px;
  font-weight: 800;
}

.primary-btn {
  background: linear-gradient(180deg, #2e8dff, #0b58ee);
  color: #fff;
  box-shadow: 0 10px 18px rgba(8, 88, 210, 0.27);
}

.primary-btn:disabled {
  opacity: 0.55;
  filter: grayscale(0.3);
}

.secondary-btn {
  border: 1px solid #aac9f4;
  background: #fff;
  color: #1f66da;
}

.hero-strip {
  margin-top: 12px;
  min-height: 76px;
  border-radius: 14px;
  border: 1px solid #c7e0ff;
  background: linear-gradient(100deg, #d7f0ff, #eff9ff);
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 24px;
  color: #2158a2;
}

.status-chips {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.status-chips span {
  min-height: 42px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  background: #f0f6ff;
  color: #31558f;
}

.number-screen {
  margin-top: 12px;
  min-height: 98px;
  border-radius: 16px;
  border: 2px solid #b7d3fb;
  background: #fff;
  display: grid;
  place-items: center;
  color: #1d3c76;
  font-size: 64px;
  font-weight: 900;
}

.num-pad {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.num-pad button {
  min-height: 52px;
  border-radius: 12px;
  border: 1px solid #d9e7f8;
  background: #fff;
  color: #1d3c76;
  font-size: 24px;
  font-weight: 800;
}

.num-pad .erase {
  background: #edf4ff;
}

.hint-line {
  margin-top: 10px;
  color: var(--text-secondary);
  text-align: center;
}

.quiz-head {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.quiz-head span {
  min-height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid #d6e5f8;
  background: #fff;
  color: #2d528f;
  display: inline-flex;
  align-items: center;
  font-weight: 700;
}

.quiz-panel {
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid #d8e7fb;
  background: #fff;
  padding: 14px;
}

.quiz-panel h3 {
  margin: 12px 0 0;
  text-align: center;
  font-size: 28px;
  line-height: 1.35;
}

.quiz-options {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quiz-options button {
  min-height: 58px;
  border-radius: 14px;
  border: 1px solid #d7e7fb;
  background: #f9fcff;
  color: #1d3f77;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  text-align: left;
  font-size: 16px;
  font-weight: 700;
}

.quiz-options button.selected {
  border-color: #1f6bff;
  background: #eaf3ff;
}

.quiz-options .letter {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #1f6bff;
  color: #fff;
  display: grid;
  place-items: center;
  flex: 0 0 34px;
}

.final-box {
  margin-top: 14px;
  border-radius: 16px;
  border: 1px solid #d8e7fb;
  background: #fff;
  padding: 16px;
  text-align: center;
}

.final-box p {
  margin: 0;
  color: #2b4f87;
  font-size: 16px;
}

.final-box p + p {
  margin-top: 8px;
}

.final-box strong {
  color: #0f5de8;
}

.score-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-item {
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid #dce9fa;
  background: #f4f9ff;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-item strong {
  color: #135ee4;
}

.fallback {
  text-align: center;
}

.dc-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(6, 24, 58, 0.56);
}

.dc-overlay p {
  margin: 0;
  min-height: 58px;
  padding: 0 22px;
  border-radius: 999px;
  background: #fff;
  color: #2650a0;
  display: inline-flex;
  align-items: center;
  font-weight: 700;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 760px) {
  .mode-card {
    padding: 12px;
  }

  .profile-row {
    grid-template-columns: 1fr;
  }

  .side-opponent {
    justify-content: flex-start;
  }

  .result-line,
  .status-chips,
  .dual-btns {
    grid-template-columns: 1fr;
  }

  .move-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .num-pad {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .number-screen {
    font-size: 42px;
    min-height: 84px;
  }

  .quiz-head {
    grid-template-columns: 1fr;
  }
}

/* Reference-art refresh */
.game-room {
  position: relative;
  background:
    radial-gradient(circle at 12% 14%, rgba(255, 255, 255, 0.34), transparent 22%),
    linear-gradient(180deg, rgba(0, 96, 240, 0.08), rgba(255, 255, 255, 0.24) 78%);
}

.game-header {
  width: min(100%, 940px);
  margin: 6px auto;
  min-height: 36px;
  border-radius: 14px;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(31, 128, 255, 0.36));
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: var(--shadow-strong);
}

.game-header h1 {
  font-size: clamp(14px, 2.6vw, 18px);
  letter-spacing: 0;
  -webkit-text-stroke: 0.5px rgba(255, 255, 255, 0.72);
  text-shadow:
    0 2px 0 rgba(4, 67, 180, 0.88),
    0 4px 10px rgba(4, 57, 160, 0.26);
}

.back-btn {
  box-shadow: 0 8px 16px rgba(8, 70, 174, 0.16);
}

.point-pill {
  min-height: 28px;
  border: 1px solid rgba(214, 232, 255, 0.9);
  color: #145bd8;
  box-shadow: 0 4px 10px rgba(9, 74, 176, 0.12);
}

.mode-card {
  border-radius: 30px;
  border: 2px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(239, 247, 255, 0.98) 100%);
  box-shadow: var(--shadow-strong);
}

.side {
  min-height: 88px;
  border-radius: 22px;
  border: 2px solid #dbeafb;
  box-shadow: 0 8px 16px rgba(11, 74, 173, 0.08);
}

.avatar-circle {
  width: 58px;
  height: 58px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 2px 10px rgba(64, 135, 230, 0.18);
}

.vs-tag {
  padding: 0 6px;
  color: #ffb320;
  -webkit-text-stroke: 1px #fff3bf;
  text-shadow:
    0 3px 0 rgba(191, 92, 0, 0.6),
    0 8px 18px rgba(240, 128, 0, 0.24);
}

.play-zone,
.quiz-panel,
.final-box {
  border-radius: 24px;
  border: 2px solid #dceafb;
  background: linear-gradient(180deg, #ffffff, #f6fbff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.result-line span,
.status-chips span,
.quiz-head span {
  border: 1px solid #d7e8fb;
  background: #fff;
  box-shadow: 0 6px 12px rgba(15, 84, 188, 0.06);
}

.hero-strip {
  min-height: 104px;
  border-radius: 22px;
  border: 2px solid #cae4ff;
  color: #145bd8;
  font-size: clamp(22px, 5vw, 34px);
  background:
    radial-gradient(circle at 14% 40%, rgba(255, 214, 85, 0.3), transparent 25%),
    linear-gradient(135deg, #d8f1ff, #ffffff 54%, #d9f3ff);
  text-shadow: 0 2px 0 #fff;
}

.number-screen {
  border-radius: 22px;
  border: 2px solid #9fc8ff;
  background: linear-gradient(180deg, #ffffff, #f7fbff);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.8);
}

.move-btn,
.num-pad button,
.quiz-options button {
  border-radius: 18px;
  border: 2px solid #dceafb;
  background: linear-gradient(180deg, #ffffff, #f7fbff);
  box-shadow: 0 8px 16px rgba(12, 74, 174, 0.08);
}

.move-btn.selected,
.quiz-options button.selected {
  border-color: #1f76ff;
  background: #eaf4ff;
  box-shadow: 0 10px 18px rgba(9, 89, 208, 0.18);
}

.primary-btn,
.secondary-btn {
  min-height: 54px;
  border-radius: 18px;
  font-weight: 900;
}

.primary-btn {
  background: linear-gradient(180deg, #2f92ff, #0758ef);
  box-shadow: var(--shadow-button);
}

.secondary-btn {
  border: 2px solid #9fc3f6;
  background: linear-gradient(180deg, #ffffff, #eef6ff);
}

/* Quiz compact first-screen layout */
.game-room.quiz-layout {
  height: 100dvh;
  max-height: 100dvh;
  padding: 0 10px 10px;
}

.game-room.quiz-layout .game-header {
  width: min(100%, 520px);
  margin: 8px auto;
  flex: 0 0 auto;
}

.game-room.quiz-layout .point-pill {
  justify-self: end;
  white-space: nowrap;
}

.game-room.quiz-layout .mode-card.quiz-mode {
  width: min(100%, 520px);
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  height: calc(100dvh - 72px);
  max-height: calc(100dvh - 72px);
  padding: 14px;
  border-radius: 28px;
  overflow: hidden;
}

.game-room.quiz-layout .quiz-mode .profile-row.compact {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.game-room.quiz-layout .quiz-mode .side {
  min-height: 70px;
  padding: 10px 12px;
  gap: 12px;
  border-radius: 20px;
}

.game-room.quiz-layout .quiz-mode .side strong {
  font-size: 16px;
}

.game-room.quiz-layout .quiz-mode .side p {
  margin-top: 2px;
  font-size: 12px;
}

.game-room.quiz-layout .quiz-mode .avatar-circle {
  width: 52px;
  height: 52px;
  font-size: 24px;
}

.game-room.quiz-layout .quiz-mode .small-action {
  min-height: 48px;
  padding: 0 16px;
  justify-self: end;
}

.game-room.quiz-layout .quiz-mode .quiz-head {
  margin-top: 0;
  gap: 10px;
}

.game-room.quiz-layout .quiz-mode .quiz-head span {
  min-height: 42px;
  padding: 0 14px;
  justify-content: center;
  font-size: 15px;
}

.game-room.quiz-layout .quiz-mode .quiz-panel {
  margin-top: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  padding: 14px;
}

.game-room.quiz-layout .quiz-mode .ring-wrap.small {
  width: 84px;
  height: 84px;
}

.game-room.quiz-layout .quiz-mode .ring-wrap.small svg {
  width: 84px;
  height: 84px;
}

.game-room.quiz-layout .quiz-mode .ring-wrap strong {
  font-size: 20px;
}

.game-room.quiz-layout .quiz-mode .quiz-panel h3 {
  margin: 0;
  font-size: clamp(22px, 4vw, 28px);
  line-height: 1.24;
}

.game-room.quiz-layout .quiz-mode .quiz-options {
  margin-top: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-content: start;
}

.game-room.quiz-layout .quiz-mode .quiz-options button {
  min-height: 72px;
  padding: 0 14px;
}

.game-room.quiz-layout .quiz-mode .quiz-options button span:last-child {
  flex: 1 1 auto;
  line-height: 1.24;
}

.game-room.quiz-layout .quiz-mode .quiz-options .letter {
  width: 38px;
  height: 38px;
  flex-basis: 38px;
}

.game-room.quiz-layout .quiz-mode .final-box {
  margin-top: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
}

.game-room.quiz-layout .quiz-mode .final-box p {
  line-height: 1.4;
}

.game-room.quiz-layout .quiz-mode .score-list {
  max-height: 180px;
  overflow: auto;
}

.game-room.rps-layout,
.game-room.guess-layout,
.game-room.quiz-layout,
.game-room.board-layout {
  padding: 0 10px 10px;
}

.game-room.board-layout {
  --game-header-space: 54px;
}

.game-room.rps-layout .game-header,
.game-room.guess-layout .game-header,
.game-room.quiz-layout .game-header,
.game-room.board-layout .game-header {
  width: min(100%, 520px);
  margin: 8px auto;
  flex: 0 0 auto;
}

.game-room.board-layout .game-header {
  width: min(100%, 940px);
}

.game-room.rps-layout .point-pill,
.game-room.guess-layout .point-pill,
.game-room.quiz-layout .point-pill,
.game-room.board-layout .point-pill {
  justify-self: end;
  white-space: nowrap;
}

.game-room.rps-layout .mode-card.rps-mode,
.game-room.guess-layout .mode-card.guess-mode {
  width: min(100%, 520px);
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  height: var(--game-viewport-height);
  max-height: var(--game-viewport-height);
  padding: 14px;
  border-radius: 28px;
  overflow: hidden;
}

.game-room.rps-layout .profile-row,
.game-room.guess-layout .profile-row.compact {
  margin: 0;
}

.game-room.rps-layout .side,
.game-room.guess-layout .side {
  min-height: 68px;
  padding: 9px 11px;
  gap: 10px;
  border-radius: 18px;
}

.game-room.rps-layout .side strong,
.game-room.guess-layout .side strong {
  font-size: 16px;
}

.game-room.rps-layout .side p,
.game-room.guess-layout .side p {
  margin-top: 2px;
  font-size: 12px;
}

.game-room.rps-layout .avatar-circle,
.game-room.guess-layout .avatar-circle {
  width: 48px;
  height: 48px;
  font-size: 22px;
}

.game-room.guess-layout .small-action {
  min-height: 44px;
  padding: 0 14px;
  justify-self: end;
}

.game-room.rps-layout .result-line,
.game-room.guess-layout .status-chips,
.game-room.guess-layout .dual-btns {
  margin-top: 0;
}

.game-room.rps-layout .play-zone {
  margin-top: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 10px;
  padding: 14px;
}

.game-room.rps-layout .ring-wrap {
  width: 86px;
  height: 86px;
}

.game-room.rps-layout .ring-wrap svg {
  width: 86px;
  height: 86px;
}

.game-room.rps-layout .ring-wrap strong {
  font-size: 22px;
}

.game-room.rps-layout .phase-copy {
  margin: 0;
  font-size: 14px;
}

.game-room.rps-layout .move-row {
  margin-top: 0;
  align-content: start;
}

.game-room.rps-layout .move-btn {
  min-height: 86px;
}

.game-room.rps-layout .move-btn .emoji {
  font-size: 30px;
}

.game-room.rps-layout .reveal-row {
  min-height: 0;
}

.game-room.rps-layout .reveal-piece {
  min-height: 92px;
}

.game-room.rps-layout .reveal-piece span {
  font-size: 34px;
}

.game-room.rps-layout .round-result,
.game-room.rps-layout .dual-btns,
.game-room.guess-layout .hint-line,
.game-room.guess-layout .final-box {
  margin-top: 0;
}

/* 限制 RPS 揭示阶段按钮不要撑满整个剩余空间 */
.game-room.rps-layout .play-zone .next-round-btn {
  min-height: 48px;
  height: 48px;
  justify-self: center;
  width: 100%;
}

.game-room.guess-layout .hero-strip {
  margin-top: 0;
  min-height: 62px;
  font-size: 20px;
}

.game-room.guess-layout .status-chips span {
  min-height: 38px;
  font-size: 13px;
}

.game-room.guess-layout .number-screen {
  margin-top: 0;
  min-height: 78px;
  font-size: 48px;
}

.game-room.guess-layout .num-pad {
  margin-top: 0;
  gap: 8px;
}

.game-room.guess-layout .num-pad button {
  min-height: 46px;
  font-size: 20px;
}

.game-room.guess-layout .dual-btns {
  gap: 10px;
}

.game-room.guess-layout .final-box {
  min-height: 0;
  overflow: auto;
}

@media (max-height: 820px) {
  .game-room.quiz-layout .mode-card.quiz-mode {
    gap: 8px;
    padding: 12px;
  }

  .game-room.quiz-layout .quiz-mode .side {
    min-height: 64px;
    padding: 8px 10px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-head span {
    min-height: 38px;
    font-size: 14px;
  }

  .game-room.quiz-layout .quiz-mode .ring-wrap.small {
    width: 72px;
    height: 72px;
  }

  .game-room.quiz-layout .quiz-mode .ring-wrap.small svg {
    width: 72px;
    height: 72px;
  }

  .game-room.quiz-layout .quiz-mode .ring-wrap strong {
    font-size: 18px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-panel h3 {
    font-size: clamp(18px, 3.7vw, 24px);
  }

  .game-room.quiz-layout .quiz-mode .quiz-options button {
    min-height: 64px;
  }

  .game-room.rps-layout .mode-card.rps-mode,
  .game-room.guess-layout .mode-card.guess-mode {
    gap: 8px;
    padding: 12px;
  }

  .game-room.rps-layout .side,
  .game-room.guess-layout .side {
    min-height: 62px;
    padding: 8px 10px;
  }

  .game-room.rps-layout .move-btn {
    min-height: 74px;
  }

  .game-room.guess-layout .hero-strip {
    min-height: 56px;
    font-size: 18px;
  }

  .game-room.guess-layout .number-screen {
    min-height: 68px;
    font-size: 42px;
  }
}

@media (max-width: 760px) {
  .game-room:not(.quiz-layout) .game-header {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .game-room:not(.quiz-layout) .point-pill {
    grid-column: 1 / -1;
    justify-content: center;
  }

  .game-room.quiz-layout {
    padding: 0 8px 8px;
  }

  .game-room.rps-layout,
  .game-room.guess-layout,
  .game-room.board-layout {
    padding: 0 8px 8px;
  }

  .game-room.quiz-layout .game-header,
  .game-room.rps-layout .game-header,
  .game-room.guess-layout .game-header,
  .game-room.board-layout .game-header {
    grid-template-columns: 36px minmax(0, 1fr) auto;
    min-height: 32px;
    padding: 3px 6px;
    margin: 6px auto 8px;
  }

  .game-room.quiz-layout .game-header h1,
  .game-room.rps-layout .game-header h1,
  .game-room.guess-layout .game-header h1,
  .game-room.board-layout .game-header h1 {
    font-size: 16px;
  }

  .game-room.quiz-layout .point-pill,
  .game-room.rps-layout .point-pill,
  .game-room.guess-layout .point-pill,
  .game-room.board-layout .point-pill {
    grid-column: auto;
    justify-self: end;
    min-height: 26px;
    padding: 0 8px;
    font-size: 11px;
  }

  .game-room.quiz-layout .coin-dot {
    width: 18px;
    height: 18px;
  }

  .game-room.rps-layout .coin-dot,
  .game-room.guess-layout .coin-dot,
  .game-room.board-layout .coin-dot {
    width: 18px;
    height: 18px;
  }

  .game-room.quiz-layout .mode-card.quiz-mode {
    gap: 8px;
    height: calc(100dvh - 62px);
    max-height: calc(100dvh - 62px);
    padding: 12px;
    border-radius: 24px;
  }

  .game-room.quiz-layout .quiz-mode .side {
    min-height: 62px;
    padding: 8px 10px;
    gap: 10px;
    border-radius: 18px;
  }

  .game-room.quiz-layout .quiz-mode .side strong {
    font-size: 15px;
  }

  .game-room.quiz-layout .quiz-mode .avatar-circle {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }

  .game-room.quiz-layout .quiz-mode .small-action {
    min-height: 42px;
    padding: 0 12px;
    font-size: 13px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-head {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-head span {
    min-height: 38px;
    padding: 0 10px;
    border-radius: 14px;
    font-size: 13px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-panel {
    gap: 8px;
    padding: 12px;
    border-radius: 20px;
  }

  .game-room.quiz-layout .quiz-mode .ring-wrap.small {
    width: 72px;
    height: 72px;
  }

  .game-room.quiz-layout .quiz-mode .ring-wrap.small svg {
    width: 72px;
    height: 72px;
  }

  .game-room.quiz-layout .quiz-mode .ring-wrap strong {
    font-size: 16px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-panel h3 {
    font-size: clamp(18px, 5vw, 24px);
    line-height: 1.28;
  }

  .game-room.quiz-layout .quiz-mode .quiz-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-options button {
    min-height: 62px;
    padding: 0 10px;
    gap: 8px;
    font-size: 14px;
  }

  .game-room.quiz-layout .quiz-mode .quiz-options .letter {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
  }

  .game-room.quiz-layout .quiz-mode .final-box {
    padding: 14px;
    border-radius: 20px;
  }

  .game-room.quiz-layout .quiz-mode .score-list {
    max-height: 160px;
  }

  .game-room.rps-layout .mode-card.rps-mode,
  .game-room.guess-layout .mode-card.guess-mode {
    gap: 8px;
    height: calc(100dvh - 62px);
    max-height: calc(100dvh - 62px);
    padding: 12px;
    border-radius: 24px;
  }

  .game-room.rps-layout .side,
  .game-room.guess-layout .side {
    min-height: 60px;
    padding: 8px 10px;
    gap: 8px;
    border-radius: 16px;
  }

  .game-room.rps-layout .side strong,
  .game-room.guess-layout .side strong {
    font-size: 15px;
  }

  .game-room.rps-layout .avatar-circle,
  .game-room.guess-layout .avatar-circle {
    width: 42px;
    height: 42px;
    font-size: 20px;
  }

  .game-room.rps-layout .result-line {
    gap: 8px;
  }

  .game-room.rps-layout .result-line span {
    min-height: 34px;
    font-size: 13px;
  }

  .game-room.rps-layout .play-zone {
    gap: 8px;
    padding: 12px;
    border-radius: 20px;
  }

  .game-room.rps-layout .ring-wrap {
    width: 72px;
    height: 72px;
  }

  .game-room.rps-layout .ring-wrap svg {
    width: 72px;
    height: 72px;
  }

  .game-room.rps-layout .ring-wrap strong {
    font-size: 18px;
  }

  .game-room.rps-layout .move-row {
    gap: 8px;
  }

  .game-room.rps-layout .move-btn {
    min-height: 72px;
    gap: 4px;
    font-size: 14px;
  }

  .game-room.rps-layout .move-btn .emoji {
    font-size: 24px;
  }

  .game-room.rps-layout .reveal-piece {
    min-height: 82px;
    padding: 8px;
  }

  .game-room.rps-layout .reveal-piece span {
    font-size: 28px;
  }

  .game-room.rps-layout .reveal-piece small {
    font-size: 12px;
  }

  .game-room.rps-layout .round-result {
    min-height: 42px;
    font-size: 18px;
  }

  .game-room.guess-layout .small-action {
    min-height: 40px;
    padding: 0 12px;
    font-size: 13px;
  }

  .game-room.guess-layout .hero-strip {
    min-height: 54px;
    font-size: 18px;
  }

  .game-room.guess-layout .status-chips {
    gap: 8px;
  }

  .game-room.guess-layout .status-chips span {
    min-height: 36px;
    font-size: 12px;
  }

  .game-room.guess-layout .number-screen {
    min-height: 64px;
    font-size: 38px;
  }

  .game-room.guess-layout .num-pad {
    gap: 8px;
  }

  .game-room.guess-layout .num-pad button {
    min-height: 42px;
    font-size: 18px;
  }

  .game-room.guess-layout .hint-line {
    font-size: 13px;
  }

  .game-room.guess-layout .dual-btns {
    gap: 8px;
  }

  .game-room.guess-layout .primary-btn,
  .game-room.guess-layout .secondary-btn,
  .game-room.rps-layout .primary-btn,
  .game-room.rps-layout .secondary-btn {
    min-height: 44px;
    font-size: 15px;
  }
}
</style>
