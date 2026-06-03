<template>
  <main
    class="game-room"
    :class="{
      'fullscreen-game': isFullscreenGame,
      'quiz-layout': gameType === 'quiz',
      'rps-layout': gameType === 'rock_paper_scissors',
      'guess-layout': gameType === 'guess_number',
      'quick-party-layout': ['reaction_race', 'dice_roll'].includes(gameType),
      'board-layout': ['gomoku', 'chess', 'zha_jin_hua', 'undercover'].includes(gameType),
      'chess-layout': gameType === 'chess'
    }"
  >
    <header class="game-header">
      <button class="back-btn" @click="backToLobby">‹</button>
      <h1>{{ gameLabel }}</h1>
      <div class="point-pill"><span class="coin-dot"></span>积分 {{ player?.points ?? 0 }}</div>
    </header>

    <section v-if="isReadyRoom" class="mode-card ready-room">
      <div class="ready-head">
        <div>
          <span>候场房间</span>
          <h2>{{ gameLabel }}</h2>
        </div>
        <strong v-if="readyDeadlineLeft > 0">{{ readyDeadlineLeft }}s</strong>
      </div>

      <div class="ready-list">
        <div v-for="item in roomPlayers" :key="item.id" class="ready-player">
          <div class="avatar-circle">{{ (item.nickname || '玩').slice(0, 1) }}</div>
          <div>
            <strong>{{ item.nickname }}</strong>
            <p>{{ item.busNumber }}号车 · {{ item.connection === 'offline' ? '离线' : '在线' }}</p>
          </div>
          <span :class="{ on: item.ready }">{{ item.ready ? '已准备' : '未准备' }}</span>
        </div>

        <div v-for="n in emptySeatCount" :key="`empty-${n}`" class="ready-player empty">
          <div class="avatar-circle">+</div>
          <div>
            <strong>等待玩家</strong>
            <p>可邀请在线玩家加入</p>
          </div>
          <span>空位</span>
        </div>
      </div>

      <div class="ready-actions">
        <button class="primary-btn" :class="{ ready: myReady }" :disabled="readySubmitting" @click="toggleReady">
          {{ readyButtonText }}
        </button>
        <button v-if="canInvitePlayers" class="secondary-btn" @click="toggleInvitePanel">
          邀请玩家
        </button>
        <button class="secondary-btn" @click="backToLobby">返回大厅</button>
      </div>

      <div v-if="showInvitePanel" class="invite-panel">
        <label class="invite-search">
          <span>搜索玩家</span>
          <input
            v-model.trim="inviteSearchText"
            type="search"
            placeholder="输入玩家名称"
            autocomplete="off"
          >
        </label>
        <div class="invite-results">
          <div
            v-for="candidate in filteredInviteCandidates"
            :key="candidate.id"
            class="invite-candidate"
          >
            <div class="invite-candidate-main">
              <strong>{{ candidate.nickname }}</strong>
              <div class="invite-candidate-meta">
                <span>{{ candidate.busNumber }}号车</span>
                <span class="invite-presence" :class="inviteCandidatePresenceClass(candidate)">
                  {{ inviteCandidatePresenceText(candidate) }}
                </span>
              </div>
            </div>
            <button
              class="invite-action"
              type="button"
              :disabled="candidate.busy || candidate.invited"
              @click.stop="invitePlayer(candidate)"
            >
              {{ inviteCandidateActionText(candidate) }}
            </button>
          </div>
          <p v-if="!filteredInviteCandidates.length" class="invite-empty">
            {{ inviteLoading ? '正在加载...' : (inviteSearchText ? '未找到匹配玩家' : '暂无可邀请玩家') }}
          </p>
        </div>
      </div>
    </section>

    <section v-else-if="gameType === 'reaction_race'" class="mode-card party-game-card reaction-race-mode">
      <div class="party-hero reaction">
        <div>
          <span>2-6 人 · 门票 10 分</span>
          <h2>看谁快</h2>
          <p>绿灯亮起后立刻点击，最快者通赢奖池。</p>
        </div>
        <strong>{{ reactionCountdownLabel }}</strong>
      </div>

      <div class="reaction-stage" :class="reactionStageClass">
        <button
          type="button"
          class="reaction-target"
          :disabled="reactionButtonDisabled"
          @click="tapReactionRace"
        >
          <span>{{ reactionButtonTitle }}</span>
          <small>{{ reactionButtonSubtitle }}</small>
        </button>
      </div>

      <div class="party-list">
        <div
          v-for="item in reactionPlayerRows"
          :key="item.id"
          class="party-row"
          :class="{ winner: item.winner, muted: item.falseStart }"
        >
          <div class="avatar-circle">{{ item.initial }}</div>
          <div>
            <strong>{{ item.name }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <span>{{ item.badge }}</span>
        </div>
      </div>

      <div v-if="gs.phase === 'finished'" class="dual-btns">
        <button class="primary-btn" @click="rematch">再来一局</button>
        <button class="secondary-btn" @click="backToLobby">返回大厅</button>
      </div>
    </section>

    <section v-else-if="gameType === 'dice_roll'" class="mode-card party-game-card dice-roll-mode">
      <div class="party-hero dice">
        <div>
          <span>2-6 人 · 门票 10 分</span>
          <h2>摇骰子</h2>
          <p>每人摇两颗骰子，点数最高者通赢奖池。</p>
        </div>
        <strong>{{ dicePhaseLabel }}</strong>
      </div>

      <div class="dice-stage">
        <div class="dice-pair">
          <div v-for="(value, index) in myDiceValues" :key="`dice-${index}`" class="dice-face">
            <span
              v-for="dot in diceDots(value)"
              :key="`${index}-${dot}`"
              :class="`dot dot-${dot}`"
            ></span>
          </div>
        </div>
        <strong>{{ myDiceTotalLabel }}</strong>
        <p>{{ diceHintText }}</p>
      </div>

      <div class="dual-btns" v-if="gs.phase !== 'finished'">
        <button class="primary-btn" :disabled="!canRollDice" @click="rollDice">
          {{ canRollDice ? '摇一把' : '等待其他玩家' }}
        </button>
        <button class="secondary-btn" @click="backToLobby">返回大厅</button>
      </div>

      <div class="party-list">
        <div
          v-for="item in dicePlayerRows"
          :key="item.id"
          class="party-row"
          :class="{ winner: item.winner, muted: item.timeout }"
        >
          <div class="avatar-circle">{{ item.initial }}</div>
          <div>
            <strong>{{ item.name }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <span>{{ item.badge }}</span>
        </div>
      </div>

      <div v-if="gs.phase === 'finished'" class="dual-btns">
        <button class="primary-btn" @click="rematch">再来一局</button>
        <button class="secondary-btn" @click="backToLobby">返回大厅</button>
      </div>
    </section>

    <section v-else-if="gameType === 'rock_paper_scissors'" class="mode-card rps-mode">
      <section class="battle-card">
        <div class="player-mini">
          <div class="avatar">{{ myName.slice(0, 1) }}</div>
          <div class="player-mini__copy">
            <strong>{{ myName }}</strong>
            <span>{{ myBusLabel }}</span>
          </div>
        </div>

        <div class="battle-meta">
          <div class="battle-meta__turn" :class="{ mine: gs.phase === 'choose', done: gs.phase === 'finished' }">
            {{ gs.phase === 'finished' ? resultText : 'VS' }}
          </div>
        </div>

        <div class="player-mini opponent">
          <div class="player-mini__copy">
            <strong>{{ opponentName }}</strong>
            <span>{{ opponentBusLabel }}</span>
          </div>
          <div class="avatar ghost">{{ opponentName.slice(0, 1) }}</div>
        </div>
      </section>

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
          <p class="phase-copy">请选择出拳，一局定胜负</p>
          <div class="move-row">
            <button
              v-for="move in moves"
              :key="move.key"
              class="move-btn"
              :class="{ selected: submittedMove === move.key, muted: hasSelectedMove && submittedMove !== move.key }"
              :disabled="hasSelectedMove"
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
          <div class="dual-btns">
            <button class="primary-btn" @click="nextRound">
              {{ roundResult === 'draw' ? '再来一局' : '查看结算' }}
            </button>
            <button class="secondary-btn" @click="backToLobby">返回大厅</button>
          </div>
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
          :disabled="!guessNum || guessSubmitting || gs.phase !== 'guess' || gs.currentPlayer !== player?.id"
          @click="makeGuess"
        >
          {{ guessSubmitting ? '提交中...' : '提交答案' }}
        </button>
        <button class="secondary-btn" :disabled="guessSubmitting" @click="guessNum = ''">重新输入</button>
      </div>

      <div v-if="gs.phase === 'finished'" class="final-box">
        <p>正确答案：<strong>{{ gs.secret }}</strong></p>
        <p>{{ !gs.winner ? '次数用完，本局无人猜中。' : (gs.winner === player?.id ? '你猜中了，太厉害了！' : `${opponentName} 先一步猜中`) }}</p>
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

    <DoudizhuBoard
      v-else-if="gameType === 'doudizhu'"
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
      @forfeit="forfeitGame"
      @rematch="rematch"
      @back="backToLobby"
    />

    <ChessBoard
      v-else-if="gameType === 'chess'"
      :gs="gs"
      :player="player"
      :room-players="roomPlayers"
      @action="emitGameAction"
      @forfeit="forfeitGame"
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
      <div v-if="showOpponentDisconnected" class="dc-overlay">
        <p>对手掉线，正在等待重连...</p>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="confirmDialog.visible" class="confirm-overlay">
        <div class="confirm-panel" role="dialog" aria-modal="true">
          <h3>{{ confirmDialog.title }}</h3>
          <p>{{ confirmDialog.message }}</p>
          <div class="confirm-actions">
            <button class="secondary-btn" type="button" @click="settleConfirm(false)">取消</button>
            <button class="primary-btn" type="button" @click="settleConfirm(true)">继续</button>
          </div>
        </div>
      </div>
    </transition>
  </main>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gameState, getPlayer, getPlayMode, socket } from '../socket'

const UndercoverGame = defineAsyncComponent(() => import('../components/UndercoverGame.vue'))
const ZhaJinHuaBoard = defineAsyncComponent(() => import('../components/games/ZhaJinHuaBoard.vue'))
const GuandanBoard = defineAsyncComponent(() => import('../components/games/GuandanBoard.vue'))
const DoudizhuBoard = defineAsyncComponent(() => import('../components/games/DoudizhuBoard.vue'))
const MahjongBoard = defineAsyncComponent(() => import('../components/games/MahjongBoard.vue'))
const GomokuBoard = defineAsyncComponent(() => import('../components/games/GomokuBoard.vue'))
const ChessBoard = defineAsyncComponent(() => import('../components/games/ChessBoard.vue'))

const route = useRoute()
const router = useRouter()

const roomId = computed(() => route.params.roomId)
const player = computed(() => getPlayer())
const gs = ref({})
const noBotGameTypes = new Set(['reaction_race', 'dice_roll'])
const opponentDisconnected = ref(false)
const selectedMove = ref(null)
const guessNum = ref('')
const guessSubmitting = ref(false)
const timeLeft = ref(5)
const quizAnswer = ref(null)
const quizTimeLeft = ref(15)
const readyDeadlineLeft = ref(0)
const readySubmitting = ref(false)
const showInvitePanel = ref(false)
const inviteCandidates = ref([])
const inviteLoading = ref(false)
const inviteSearchText = ref('')
const confirmDialog = ref({ visible: false, title: '确认操作', message: '' })
const zhaJinHuaFoldedOut = ref(false)
const zhaJinHuaFoldedGameType = ref('')

let timerInterval = null
let readyInterval = null
let confirmResolver = null
let stateHandler = null
let resultHandler = null
let dcHandler = null
let roomUpdateHandler = null
let roomStartedHandler = null
let kickedHandler = null
let requeuedHandler = null
let abandonedHandler = null
let matchedHandler = null
let opponentDisconnectedTimer = null

const gameType = computed(() => gameState.currentRoom?.gameType)
const roomPlayers = computed(() => gameState.currentRoom?.players || [])
const currentRoom = computed(() => gameState.currentRoom || {})
const isActivePlayingRoom = computed(() => currentRoom.value?.status === 'playing' && gs.value?.phase !== 'finished')
const showOpponentDisconnected = computed(() => opponentDisconnected.value && isActivePlayingRoom.value)
const isFullscreenGame = computed(() => ['guandan', 'doudizhu', 'mahjong'].includes(gameType.value))
const isReadyRoom = computed(() => currentRoom.value?.status === 'readying' || (!gs.value?.phase && currentRoom.value?.status !== 'playing'))
const isZhaJinHuaFoldedOut = computed(() => zhaJinHuaFoldedOut.value && (zhaJinHuaFoldedGameType.value || gameType.value) === 'zha_jin_hua')
const myReady = computed(() => Boolean(currentRoom.value?.ready?.[player.value?.id] || roomPlayers.value.find(item => item.id === player.value?.id)?.ready))
const readyButtonText = computed(() => {
  if (readySubmitting.value) return myReady.value ? '已准备' : '取消中...'
  return myReady.value ? '取消准备' : '准备'
})
const emptySeatCount = computed(() => Math.max(0, Number(currentRoom.value?.maxPlayers || roomPlayers.value.length) - roomPlayers.value.length))
const canInvitePlayers = computed(() => isReadyRoom.value && currentRoom.value?.visibility === 'private' && currentRoom.value?.ownerId === player.value?.id && emptySeatCount.value > 0)
const filteredInviteCandidates = computed(() => {
  const keyword = inviteSearchText.value.trim().toLowerCase()
  if (!keyword) return inviteCandidates.value
  return inviteCandidates.value.filter((candidate) => (
    String(candidate.nickname || '').toLowerCase().includes(keyword)
  ))
})

const gameLabel = computed(() => {
  const labels = {
    reaction_race: '看谁快',
    dice_roll: '摇骰子',
    rock_paper_scissors: '剪刀石头布',
    guess_number: '猜数字',
    blackjack: '21点',
    zha_jin_hua: '炸金花',
    undercover: '谁是卧底',
    quiz: '快问快答',
    guandan: '掼蛋',
    doudizhu: '斗地主',
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

const myName = computed(() => player.value?.nickname || '我方')
const myBusLabel = computed(() => `${player.value?.busNumber || 1}号车`)
const opponentBusLabel = computed(() => `${opponentBus.value}号车`)

const resultText = computed(() => {
  if (gs.value.phase !== 'finished') return ''
  const winner = gs.value.finalWinner || gs.value.winner
  if (!winner) return '平局'
  return winner === player.value?.id ? '恭喜获胜' : '再接再厉'
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
const submittedMove = computed(() => selectedMove.value || gs.value?.choices?.[player.value?.id] || '')
const hasSelectedMove = computed(() => Boolean(submittedMove.value))

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

const reactionHasTapped = computed(() => Boolean(gs.value?.clicks?.[player.value?.id]))
const reactionFalseStarted = computed(() => Boolean(gs.value?.falseStarts?.includes(player.value?.id)))
const reactionStageClass = computed(() => ({
  waiting: gs.value?.phase === 'waiting',
  go: gs.value?.phase === 'go',
  finished: gs.value?.phase === 'finished'
}))
const reactionCountdownLabel = computed(() => {
  if (gs.value?.phase === 'waiting') return `${timeLeft.value}s`
  if (gs.value?.phase === 'go') return '点击'
  return '结算'
})
const reactionButtonTitle = computed(() => {
  if (gs.value?.phase === 'waiting') return reactionFalseStarted.value ? '抢跑' : '等绿灯'
  if (gs.value?.phase === 'go') return reactionHasTapped.value ? '已点击' : '点我'
  return gs.value?.finalWinner === player.value?.id ? '你最快' : '已结束'
})
const reactionButtonSubtitle = computed(() => {
  if (reactionFalseStarted.value) return '提前点击，本局失去资格'
  if (reactionHasTapped.value) return `${gs.value?.clicks?.[player.value?.id]?.reactionMs ?? 0} ms`
  if (gs.value?.phase === 'waiting') return '亮绿前不要点'
  if (gs.value?.phase === 'go') return '越快越好'
  return `赢家：${getPlayerName(gs.value?.finalWinner)}`
})
const reactionButtonDisabled = computed(() => (
  gs.value?.phase === 'finished' ||
  reactionHasTapped.value ||
  reactionFalseStarted.value
))
const reactionPlayerRows = computed(() => {
  const rankingMap = new Map((gs.value?.reactionRanking || []).map((item, index) => [item.playerId, { ...item, rank: index + 1 }]))
  const falseStarts = new Set(gs.value?.falseStarts || [])
  return roomPlayers.value.map((item) => {
    const rank = rankingMap.get(item.id)
    const falseStart = falseStarts.has(item.id)
    const winner = gs.value?.finalWinner === item.id
    return {
      id: item.id,
      name: item.nickname || '玩家',
      initial: (item.nickname || '玩').slice(0, 1),
      falseStart,
      winner,
      detail: falseStart ? '抢跑失格' : (rank ? `反应 ${rank.reactionMs} ms` : '等待点击'),
      badge: winner ? '赢家' : (rank ? `#${rank.rank}` : (falseStart ? '失格' : '待定'))
    }
  })
})

const myDiceRoll = computed(() => gs.value?.rolls?.[player.value?.id] || latestDiceRoll(player.value?.id))
const myDiceValues = computed(() => myDiceRoll.value?.dice || ['?', '?'])
const myDiceTotalLabel = computed(() => {
  const roll = myDiceRoll.value
  if (!roll) return '等待摇骰'
  return roll.timeout ? '超时 0 点' : `${roll.total} 点`
})
const canRollDice = computed(() => (
  ['rolling', 'tiebreak'].includes(gs.value?.phase) &&
  gs.value?.activePlayers?.includes(player.value?.id) &&
  !gs.value?.rolls?.[player.value?.id]
))
const dicePhaseLabel = computed(() => {
  if (gs.value?.phase === 'tiebreak') return `加摇 ${gs.value?.rollRound || 2}`
  if (gs.value?.phase === 'finished') return '结算'
  return `第 ${gs.value?.rollRound || 1} 轮`
})
const diceHintText = computed(() => {
  if (gs.value?.phase === 'finished') return `赢家：${getPlayerName(gs.value?.finalWinner)}`
  if (gs.value?.phase === 'tiebreak') return '最高点并列，进入加摇'
  return canRollDice.value ? '点击按钮，服务端公平摇点' : '等待其他玩家完成本轮'
})
const dicePlayerRows = computed(() => {
  const standings = new Map((gs.value?.standings || []).map((item, index) => [item.playerId, { ...item, rank: index + 1 }]))
  return roomPlayers.value.map((item) => {
    const current = gs.value?.rolls?.[item.id]
    const previous = standings.get(item.id)
    const roll = current || previous
    const winner = gs.value?.finalWinner === item.id
    return {
      id: item.id,
      name: item.nickname || '玩家',
      initial: (item.nickname || '玩').slice(0, 1),
      winner,
      timeout: Boolean(roll?.timeout),
      detail: roll ? `${roll.dice?.join(' + ')} = ${roll.total}` : '等待摇骰',
      badge: winner ? '赢家' : (roll ? `${roll.total}点` : '待定')
    }
  })
})

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

function latestDiceRoll(playerId) {
  if (!playerId) return null
  const history = gs.value?.history || []
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const roll = history[i]?.rolls?.[playerId]
    if (roll) return roll
  }
  return null
}

function diceDots(value) {
  const layouts = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  }
  return layouts[value] || []
}

function tapReactionRace() {
  if (reactionButtonDisabled.value) return
  socket.emit('game:action', { action: { type: 'tap' } })
}

function rollDice() {
  if (!canRollDice.value) return
  socket.emit('game:action', { action: { type: 'roll' } })
}

function moveIcon(key) {
  return { rock: '✊', scissors: '✌️', paper: '🖐️' }[key] || '❔'
}

function selectMove(move) {
  if (hasSelectedMove.value) return
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
  if (guessSubmitting.value) return
  if (gs.value?.phase !== 'guess' || gs.value?.currentPlayer !== player.value?.id) return

  const value = Number.parseInt(guessNum.value, 10)
  if (!Number.isFinite(value)) return

  const low = gs.value?.range?.low ?? 1
  const high = gs.value?.range?.high ?? 100
  if (value < low || value > high) {
    alert(`请输入 ${low} 到 ${high} 之间的数字`)
    return
  }

  guessSubmitting.value = true
  socket.emit('game:action', { action: { type: 'guess', guess: value } })
  guessNum.value = ''
  window.setTimeout(() => {
    guessSubmitting.value = false
  }, 3000)
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
  socket.emit('game:action', { action }, (res) => {
    if (res?.error) {
      alert(res.error)
      return
    }

    if (res?.foldedOut) {
      zhaJinHuaFoldedOut.value = true
      zhaJinHuaFoldedGameType.value = res.room?.gameType || gameType.value || 'zha_jin_hua'
      if (res.room) {
        gameState.currentRoom = res.room
      }
      if (res.gameState) {
        gameState.currentGame = res.gameState
        gs.value = res.gameState
      }
      if (gameState.player && res.player?.id === gameState.player.id) {
        gameState.player.points = res.player.points
      }
    }
  })
}

async function forfeitGame() {
  if (!(await askConfirm('确认认输吗？'))) return
  socket.emit('game:forfeit', { reason: 'forfeit' }, (res) => {
    if (res?.error) {
      alert(res.error)
    }
  })
}

function updateReadyDeadline() {
  const deadline = Number(currentRoom.value?.readyDeadline || 0)
  readyDeadlineLeft.value = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0
}

function toggleReady() {
  if (readySubmitting.value) return
  const previousReady = myReady.value
  const nextReady = !previousReady
  readySubmitting.value = true
  applyLocalReady(nextReady)

  socket.emit('room:ready', { ready: nextReady }, (res) => {
    readySubmitting.value = false
    if (res?.error) {
      applyLocalReady(previousReady)
      alert(res.error)
      return
    }

    if (res?.room) {
      gameState.currentRoom = res.room
      gameState.currentGame = res.room.gameState
      gs.value = res.room.gameState || {}
      updateReadyDeadline()
    }
  })
}

function applyLocalReady(ready) {
  const current = gameState.currentRoom
  const pid = player.value?.id
  if (!current || !pid) return

  const nextReady = {
    ...(current.ready || {}),
    [pid]: Boolean(ready)
  }

  const nextPlayers = (current.players || []).map((item) => (
    item.id === pid ? { ...item, ready: Boolean(ready) } : item
  ))

  gameState.currentRoom = {
    ...current,
    ready: nextReady,
    players: nextPlayers
  }
}

function toggleInvitePanel() {
  showInvitePanel.value = !showInvitePanel.value
  if (!showInvitePanel.value) {
    inviteSearchText.value = ''
    return
  }
  if (showInvitePanel.value) {
    loadInvitePlayers()
  }
}

function loadInvitePlayers() {
  inviteLoading.value = true
  socket.emit('players:list', { roomId: currentRoom.value?.roomId }, (res) => {
    inviteLoading.value = false
    if (res?.error) {
      alert(res.error)
      return
    }
    inviteCandidates.value = (res.players || []).filter(item => !roomPlayers.value.some(playerItem => playerItem.id === item.id))
  })
}

function inviteCandidatePresenceText(candidate) {
  if (candidate.busy) return '忙碌'
  return candidate.online ? '在线' : '离线'
}

function inviteCandidatePresenceClass(candidate) {
  if (candidate.busy) return 'busy'
  return candidate.online ? 'online' : 'offline'
}

function inviteCandidateActionText(candidate) {
  if (candidate.invited) return '已邀请'
  return '邀请'
}

function invitePlayer(candidate) {
  socket.emit('room:invite', { roomId: currentRoom.value?.roomId, playerId: candidate.id }, (res) => {
    if (res?.error) {
      alert(res.error)
      return
    }
    candidate.invited = true
  })
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
  const activeGameType = zhaJinHuaFoldedGameType.value || gameType.value
  if (!player.value || !activeGameType) return
  if (isZhaJinHuaFoldedOut.value && getPlayMode() !== 'test') {
    const targetGameType = activeGameType || 'zha_jin_hua'
    socket.emit('match:join', { gameType: targetGameType }, (res) => {
      if (res?.error) {
        alert(res.error)
        return
      }
      zhaJinHuaFoldedOut.value = false
      zhaJinHuaFoldedGameType.value = ''
      gameState.currentRoom = null
      gameState.currentGame = null
      router.push({ path: '/lobby', query: { matching: targetGameType } })
    })
    return
  }
  if (getPlayMode() !== 'test' || noBotGameTypes.has(activeGameType)) {
    const targetRoomId = currentRoom.value?.roomId || currentRoom.value?.id || roomId.value
    socket.emit('game:rematch', { roomId: targetRoomId }, (res) => {
      if (res?.error) {
        alert(res.error)
        return
      }
      if (res?.requeued) {
        router.push({ path: '/lobby', query: { matching: res.gameType || activeGameType } })
        return
      }
      if (res?.room) {
        gameState.currentRoom = res.room
        gameState.currentGame = res.room.gameState
        gs.value = res.room.gameState || {}
        readySubmitting.value = false
        updateReadyDeadline()
      }
    })
    return
  }
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

function askConfirm(message, title = '确认操作') {
  if (confirmResolver) confirmResolver(false)
  confirmDialog.value = { visible: true, title, message }
  return new Promise((resolve) => {
    confirmResolver = resolve
  })
}

function settleConfirm(confirmed) {
  if (confirmResolver) {
    confirmResolver(confirmed)
    confirmResolver = null
  }
  confirmDialog.value = { ...confirmDialog.value, visible: false }
}

function clearOpponentDisconnectedNotice() {
  opponentDisconnected.value = false
  if (opponentDisconnectedTimer) {
    clearTimeout(opponentDisconnectedTimer)
    opponentDisconnectedTimer = null
  }
}

async function backToLobby() {
  if (isZhaJinHuaFoldedOut.value) {
    zhaJinHuaFoldedOut.value = false
    zhaJinHuaFoldedGameType.value = ''
    gameState.currentRoom = null
    gameState.currentGame = null
    router.push('/lobby')
    return
  }

  const room = currentRoom.value
  if (!room?.roomId) {
    router.push('/lobby')
    return
  }

  if (room.status === 'playing' && room.mode !== 'quick') {
    const message = room.players?.length === 2
      ? '当前对局未结束，返回大厅将视为认输，是否继续？'
      : '当前对局未结束，返回后本局结束前不能参与其他游戏，是否继续？'
    if (!(await askConfirm(message))) return
  }

  socket.emit('room:leave_current', { confirmForfeit: true }, async (res) => {
    if (res?.error && !res.requiresConfirmation) {
      alert(res.error)
      return
    }
    if (res?.requiresConfirmation && !(await askConfirm('返回大厅将视为认输，是否继续？'))) {
      return
    }
    if (res?.requiresConfirmation) {
      socket.emit('room:leave_current', { confirmForfeit: true }, () => {
        router.push('/lobby')
      })
      return
    }
    router.push('/lobby')
  })
}

onMounted(() => {
  if (!player.value) {
    router.push('/')
    return
  }

  gs.value = gameState.currentGame || {}

  stateHandler = (event) => {
    gs.value = event.detail.gameState
    if (event.detail.room) {
      gameState.currentRoom = event.detail.room
    }
    guessSubmitting.value = false
    if (gameType.value === 'rock_paper_scissors' && gs.value?.phase === 'choose' && !gs.value?.choices?.[player.value?.id]) {
      selectedMove.value = null
    }
  }
  window.addEventListener('game:state', stateHandler)

  roomUpdateHandler = (event) => {
    gameState.currentRoom = event.detail
    gameState.currentGame = event.detail.gameState
    gs.value = event.detail.gameState || {}
    readySubmitting.value = false
    updateReadyDeadline()
  }
  window.addEventListener('room:update', roomUpdateHandler)

  roomStartedHandler = (event) => {
    zhaJinHuaFoldedOut.value = false
    zhaJinHuaFoldedGameType.value = ''
    gameState.currentRoom = event.detail
    gameState.currentGame = event.detail.gameState
    gs.value = event.detail.gameState || {}
    readySubmitting.value = false
    showInvitePanel.value = false
  }
  window.addEventListener('room:started', roomStartedHandler)

  resultHandler = (event) => {
    if (event.detail.room) {
      gameState.currentRoom = event.detail.room
      gameState.currentGame = event.detail.room.gameState
    }
    const { players: resultPlayers, room: resultRoom, ...result } = event.detail
    gs.value = { ...gs.value, ...result, resultPlayers }
    guessSubmitting.value = false
    clearOpponentDisconnectedNotice()
  }
  window.addEventListener('game:result', resultHandler)

  dcHandler = (event) => {
    if (!isActivePlayingRoom.value) {
      clearOpponentDisconnectedNotice()
      return
    }

    opponentDisconnected.value = true
    if (opponentDisconnectedTimer) {
      clearTimeout(opponentDisconnectedTimer)
    }
    opponentDisconnectedTimer = setTimeout(() => {
      opponentDisconnected.value = false
      opponentDisconnectedTimer = null
    }, event.detail?.graceMs || 10000)
  }
  window.addEventListener('game:opponent_disconnected', dcHandler)

  kickedHandler = (event) => {
    alert(event.detail?.message || '已返回大厅')
    router.push('/lobby')
  }
  window.addEventListener('room:kicked', kickedHandler)

  requeuedHandler = (event) => {
    alert(event.detail?.message || '已重新匹配')
    router.push({ path: '/lobby', query: { matching: event.detail?.gameType || gameType.value } })
  }
  window.addEventListener('match:requeued', requeuedHandler)

  abandonedHandler = (event) => {
    alert(event.detail?.message || '本局结束前不能参与其他游戏')
  }
  window.addEventListener('room:abandoned', abandonedHandler)

  matchedHandler = (event) => {
    zhaJinHuaFoldedOut.value = false
    zhaJinHuaFoldedGameType.value = ''
    const room = event.detail
    gameState.currentRoom = room
    gameState.currentGame = room.gameState
    gs.value = room.gameState || {}
    readySubmitting.value = false
    router.push(`/game/${room.roomId}`)
  }
  window.addEventListener('game:matched', matchedHandler)

  readyInterval = setInterval(updateReadyDeadline, 500)
  updateReadyDeadline()
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (readyInterval) clearInterval(readyInterval)
  clearOpponentDisconnectedNotice()
  if (stateHandler) window.removeEventListener('game:state', stateHandler)
  if (resultHandler) window.removeEventListener('game:result', resultHandler)
  if (dcHandler) window.removeEventListener('game:opponent_disconnected', dcHandler)
  if (roomUpdateHandler) window.removeEventListener('room:update', roomUpdateHandler)
  if (roomStartedHandler) window.removeEventListener('room:started', roomStartedHandler)
  if (kickedHandler) window.removeEventListener('room:kicked', kickedHandler)
  if (requeuedHandler) window.removeEventListener('match:requeued', requeuedHandler)
  if (abandonedHandler) window.removeEventListener('room:abandoned', abandonedHandler)
  if (matchedHandler) window.removeEventListener('game:matched', matchedHandler)
  settleConfirm(false)
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
      if (gs.value.phase === 'choose' && !hasSelectedMove.value) {
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
  zhaJinHuaFoldedOut.value = false
  zhaJinHuaFoldedGameType.value = ''
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

.battle-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(236, 245, 255, 0.96));
  color: #17305f;
  box-shadow: 0 14px 28px rgba(38, 82, 180, 0.14);
}

.rps-mode .battle-card {
  margin-bottom: 12px;
}

.player-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.player-mini.opponent {
  justify-content: flex-end;
}

.player-mini .avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, #65a8ff, #3069f6);
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  flex-shrink: 0;
}

.player-mini .avatar.ghost {
  background: linear-gradient(180deg, #eef4ff, #d9e7ff);
  color: #5e79b2;
}

.player-mini__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.player-mini__copy strong,
.player-mini__copy span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-mini__copy strong {
  font-size: 17px;
  font-weight: 800;
  color: #143372;
}

.player-mini__copy span {
  color: #6781b8;
  font-size: 12px;
}

.battle-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.battle-meta__turn {
  min-width: 80px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(44, 111, 255, 0.1);
  color: #3966d5;
  font-size: 18px;
  font-weight: 900;
  text-align: center;
}

.battle-meta__turn.mine {
  background: linear-gradient(180deg, #4e9cff, #2d6eff);
  color: #fff;
  box-shadow: 0 10px 18px rgba(61, 110, 255, 0.28);
}

.battle-meta__turn.done {
  background: linear-gradient(180deg, #6f7faa, #43557f);
  color: #ffffff;
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

.move-btn:disabled {
  cursor: default;
}

.move-btn.muted {
  opacity: 0.58;
  filter: grayscale(0.25);
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

.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(8, 20, 38, 0.46);
  backdrop-filter: blur(8px);
}

.confirm-panel {
  width: min(360px, 100%);
  border-radius: 18px;
  padding: 22px;
  background: #fff;
  box-shadow: 0 18px 42px rgba(8, 24, 52, 0.28);
  color: #183052;
}

.confirm-panel h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 900;
}

.confirm-panel p {
  margin: 0;
  line-height: 1.55;
  color: #51647f;
}

.confirm-actions {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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
  white-space: normal;
  overflow-wrap: anywhere;
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

.quiz-options button span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
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

.ready-room {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 16px;
}

.ready-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ready-head span {
  color: #6b82ac;
  font-size: 13px;
  font-weight: 800;
}

.ready-head h2 {
  margin: 4px 0 0;
  color: #17315d;
  font-size: 24px;
}

.ready-head strong {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: #eaf4ff;
  color: #0f5de8;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.ready-list {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}

.ready-player {
  min-height: 72px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid #d9e8fb;
  background: #fff;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.ready-player.empty {
  background: #f7fbff;
  border-style: dashed;
}

.ready-player strong,
.ready-player p {
  margin: 0;
}

.ready-player p {
  margin-top: 3px;
  color: #6b82ac;
  font-size: 12px;
  font-weight: 700;
}

.ready-player > span {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef5ff;
  color: #6b82ac;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 900;
}

.ready-player > span.on {
  background: #e8fbf1;
  color: #168a4c;
}

.ready-actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.ready-actions .primary-btn.ready {
  background: linear-gradient(180deg, #2eb87f, #148f5d);
}

.invite-panel {
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid #d9e8fb;
  background: #f7fbff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(300px, calc(100dvh - 420px));
  overflow: hidden;
}

.invite-search {
  display: grid;
  gap: 6px;
  flex: 0 0 auto;
  background: #f7fbff;
}

.invite-search span {
  color: #6b82ac;
  font-size: 12px;
  font-weight: 900;
}

.invite-search input {
  width: 100%;
  min-height: 42px;
  border: 1px solid #d9e8fb;
  border-radius: 12px;
  padding: 0 12px;
  background: #fff;
  color: #17315d;
  font-size: 14px;
  font-weight: 800;
  outline: none;
}

.invite-search input:focus {
  border-color: #8fb5f4;
  box-shadow: 0 0 0 3px rgba(31, 107, 255, 0.12);
}

.invite-results {
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 8px;
  padding-right: 2px;
}

.invite-candidate {
  min-height: 58px;
  padding: 10px 10px 10px 12px;
  border-radius: 14px;
  border: 1px solid #e0ecfb;
  background: #fff;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.invite-candidate-main {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.invite-candidate-main strong {
  color: #17315d;
  font-size: 13px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invite-candidate-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: #6b82ac;
  font-size: 12px;
  font-weight: 800;
}

.invite-presence {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.invite-presence.online {
  background: #e8fbf1;
  color: #168a4c;
}

.invite-presence.offline {
  background: #edf3fb;
  color: #6b82ac;
}

.invite-presence.busy {
  background: #fff2df;
  color: #b96b09;
}

.invite-action {
  min-width: 66px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, #2f92ff, #0758ef);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  box-shadow: 0 7px 14px rgba(9, 89, 208, 0.18);
}

.invite-action:disabled {
  opacity: 0.55;
  background: #edf3fb;
  color: #6b82ac;
  box-shadow: none;
}

.invite-empty {
  min-height: 44px;
  margin: 0;
  color: #6b82ac;
  text-align: center;
  display: grid;
  place-items: center;
  font-weight: 800;
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

.game-room.quick-party-layout {
  padding: 0 10px 10px;
}

.game-room.quick-party-layout .game-header {
  width: min(100%, 520px);
  margin: 8px auto;
}

.party-game-card {
  width: min(100%, 520px);
  margin: 0 auto;
  display: grid;
  gap: 12px;
  padding: 14px;
}

.party-hero {
  min-height: 118px;
  padding: 18px;
  border-radius: 24px;
  color: #fff;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  box-shadow: 0 14px 26px rgba(9, 80, 190, 0.16);
}

.party-hero.reaction {
  background: linear-gradient(140deg, #136cff, #04a3e8 54%, #20c989);
}

.party-hero.dice {
  background: linear-gradient(140deg, #0d63ef, #2f92ff 52%, #ffd56a);
}

.party-hero span,
.party-hero p {
  display: block;
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 800;
}

.party-hero h2 {
  margin: 6px 0;
  font-size: 30px;
  line-height: 1;
  font-weight: 1000;
}

.party-hero strong {
  width: 72px;
  height: 72px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  color: #fff2be;
  font-size: 21px;
  font-weight: 1000;
}

.reaction-stage,
.dice-stage {
  min-height: 230px;
  border-radius: 24px;
  border: 2px solid #dceafb;
  background: linear-gradient(180deg, #ffffff, #f6fbff);
  display: grid;
  place-items: center;
  padding: 18px;
  text-align: center;
}

.reaction-target {
  width: min(100%, 250px);
  aspect-ratio: 1;
  border: none;
  border-radius: 50%;
  background: linear-gradient(180deg, #cbd8ea, #91a5c1);
  color: #fff;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  box-shadow: 0 18px 26px rgba(40, 92, 160, 0.22), inset 0 5px 0 rgba(255, 255, 255, 0.22);
}

.reaction-stage.go .reaction-target {
  background: linear-gradient(180deg, #63f2b1, #14b870);
  box-shadow: 0 18px 30px rgba(25, 176, 111, 0.28), inset 0 5px 0 rgba(255, 255, 255, 0.3);
}

.reaction-stage.finished .reaction-target {
  background: linear-gradient(180deg, #ffd86b, #ff9f2f);
}

.reaction-target:disabled {
  opacity: 0.78;
}

.reaction-target span {
  font-size: 42px;
  line-height: 1;
  font-weight: 1000;
}

.reaction-target small {
  font-size: 15px;
  font-weight: 900;
}

.party-list {
  display: grid;
  gap: 8px;
}

.party-row {
  min-height: 70px;
  padding: 10px 12px;
  border-radius: 20px;
  border: 2px solid #dceafb;
  background: #fff;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.party-row.winner {
  border-color: #ffd56a;
  background: linear-gradient(180deg, #fffdf3, #fff6d5);
}

.party-row.muted {
  opacity: 0.68;
}

.party-row strong,
.party-row p {
  display: block;
  margin: 0;
}

.party-row strong {
  color: #153260;
  font-size: 15px;
  line-height: 1.2;
  font-weight: 900;
}

.party-row p {
  margin-top: 4px;
  color: #6b82ac;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 800;
}

.party-row > span {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef6ff;
  color: #145bd8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 1000;
}

.dice-stage {
  gap: 8px;
}

.dice-pair {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.dice-face {
  position: relative;
  width: 92px;
  height: 92px;
  border-radius: 24px;
  background: linear-gradient(180deg, #fff7d7, #ffd56a);
  box-shadow: 0 12px 20px rgba(202, 134, 24, 0.18), inset 0 3px 0 rgba(255, 255, 255, 0.55);
}

.dice-face::after {
  content: '?';
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #153260;
  font-size: 34px;
  font-weight: 1000;
}

.dice-face:has(.dot)::after {
  content: '';
}

.dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #153260;
}

.dot-1 { left: 22px; top: 22px; }
.dot-2 { left: 46px; top: 22px; }
.dot-3 { right: 22px; top: 22px; }
.dot-4 { left: 22px; top: 46px; }
.dot-5 { left: 46px; top: 46px; }
.dot-6 { right: 22px; top: 46px; }
.dot-7 { left: 22px; bottom: 22px; }
.dot-8 { left: 46px; bottom: 22px; }
.dot-9 { right: 22px; bottom: 22px; }

.dice-stage > strong {
  color: #153260;
  font-size: 32px;
  line-height: 1;
  font-weight: 1000;
}

.dice-stage > p {
  margin: 0;
  color: #6b82ac;
  font-size: 14px;
  font-weight: 800;
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
  min-width: 0;
  line-height: 1.24;
  overflow-wrap: anywhere;
  word-break: break-word;
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

.game-room.chess-layout {
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
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
  grid-template-rows: auto minmax(0, 1fr);
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

  .game-room.chess-layout {
    padding-bottom: calc(18px + env(safe-area-inset-bottom));
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
    height: 42px;
    font-size: 15px;
  }
}

@media (max-width: 360px) {
  .game-room.quiz-layout .quiz-mode .quiz-options {
    grid-template-columns: 1fr;
  }

  .game-room.quiz-layout .quiz-mode .quiz-options button {
    min-height: 56px;
  }
}
</style>
