<template>
  <main class="game-room" :class="{
      'fullscreen-game': isFullscreenGame,
      'quiz-layout': gameType === 'quiz',
      'rps-layout': gameType === 'rock_paper_scissors',
      'quick-party-layout': ['reaction_race', 'dice_roll', 'guess_dice'].includes(gameType),
      'board-layout': ['gomoku', 'chess', 'zha_jin_hua'].includes(gameType),
      'chess-layout': gameType === 'chess',
      'ready-layout': isReadyRoom
    }">
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
          <p class="ready-player-range">所需人数 {{ readyPlayerRange }}</p>
        </div>
        <div class="ready-head-actions">
          <button type="button" class="rules-icon-btn" aria-label="查看玩法规则" @click="showRoomRules = true">
            ?
          </button>
          <strong v-if="readyDeadlineLeft > 0">{{ readyDeadlineLeft }}s</strong>
        </div>
      </div>

      <div class="ready-list">
        <div v-for="item in roomPlayers" :key="item.id" class="ready-player">
          <div class="avatar-circle">{{ (item.nickname || '玩').slice(0, 1) }}</div>
          <div>
            <strong>{{ item.nickname }}</strong>
            <p>{{ item.busNumber }}号车 · {{ item.connection === 'offline' ? '离线' : '在线' }}</p>
          </div>
          <div class="ready-player-actions">
            <span class="ready-status" :class="{ on: item.ready }">{{ item.ready ? '已准备' : '未准备' }}</span>
            <button v-if="item.id === player?.id" type="button" class="ready-inline-action" :class="{ ready: myReady }"
              :disabled="readySubmitting" @click="toggleReady">
              {{ readyButtonText }}
            </button>
          </div>
        </div>

        <div v-for="n in emptySeatCount" :key="`empty-${n}`" class="ready-player empty">
          <div class="avatar-circle">+</div>
          <div>
            <strong>等待玩家</strong>
            <p>可邀请在线玩家加入</p>
          </div>
          <div class="ready-player-actions">
            <span class="ready-status">空位</span>
            <button v-if="canInvitePlayers" type="button" class="ready-inline-action invite" @click="openInvitePanel">
              邀请
            </button>
          </div>
        </div>
      </div>

      <div class="ready-actions">
        <!-- <button class="primary-btn" :class="{ ready: myReady }" :disabled="readySubmitting" @click="toggleReady">
          {{ readyButtonText }}
        </button> -->
        <button v-if="canInvitePlayers" class="secondary-btn" @click="toggleInvitePanel">
          {{ showInvitePanel ? '收起邀请' : '邀请玩家' }}
        </button>
        <button class="secondary-btn" @click="backToLobby">返回大厅</button>
      </div>

      <div v-if="showInvitePanel" class="invite-panel">
        <label class="invite-search">
          <span>搜索玩家</span>
          <input v-model.trim="inviteSearchText" type="search" placeholder="输入玩家名称" autocomplete="off">
        </label>
        <div class="invite-results">
          <div v-for="candidate in filteredInviteCandidates" :key="candidate.id" class="invite-candidate">
            <div class="invite-candidate-main">
              <strong>{{ candidate.nickname }}</strong>
              <div class="invite-candidate-meta">
                <span>{{ candidate.busNumber }}号车</span>
                <span class="invite-presence" :class="inviteCandidatePresenceClass(candidate)">
                  {{ inviteCandidatePresenceText(candidate) }}
                </span>
              </div>
            </div>
            <button class="invite-action" type="button" :disabled="candidate.busy || candidate.invited"
              @click.stop="invitePlayer(candidate)">
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
        <button type="button" class="reaction-target" :disabled="reactionButtonDisabled" @click="tapReactionRace">
          <span>{{ reactionButtonTitle }}</span>
          <small>{{ reactionButtonSubtitle }}</small>
        </button>
      </div>

      <div class="party-list">
        <div v-for="item in reactionPlayerRows" :key="item.id" class="party-row"
          :class="{ winner: item.winner, muted: item.falseStart }">
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
          <figure v-for="(value, index) in myDiceDisplayValues" :key="`dice-${index}`" class="dice-face"
            :class="{ 'is-empty': !diceImage(value), 'is-rolling': diceRollAnimating }"
            :style="{ '--roll-delay': `${index * 90}ms` }">
            <img v-if="diceImage(value)" :src="diceImage(value)" :alt="diceAlt(value)">
            <span v-else class="dice-placeholder">?</span>
          </figure>
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
        <div v-for="item in dicePlayerRows" :key="item.id" class="party-row"
          :class="{ winner: item.winner, muted: item.timeout }">
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

    <section v-else-if="gameType === 'guess_dice'" class="mode-card party-game-card dice-roll-mode">
      <div class="party-hero dice">
        <div>
          <span>3-6 人 · 门票 10 分</span>
          <h2>猜点数</h2>
          <p>选择 1-6 的点数，系统摇一颗骰子；猜中得分，猜错扣分。</p>
        </div>
        <strong>{{ guessDicePhaseLabel }}</strong>
      </div>

      <div class="dice-stage guess-dice-stage">
        <figure class="dice-face single-dice"
          :class="{ 'is-empty': !diceImage(guessDiceDisplayValue), 'is-rolling': guessDiceAnimating }">
          <img v-if="diceImage(guessDiceDisplayValue)" :src="diceImage(guessDiceDisplayValue)"
            :alt="diceAlt(guessDiceDisplayValue)">
          <span v-else class="dice-placeholder">?</span>
        </figure>
        <strong>{{ guessDiceResultLabel }}</strong>
        <p>{{ guessDiceHintText }}</p>
        <div v-if="gs.phase !== 'finished'" class="guess-dice-options">
          <button v-for="value in diceGuessOptions" :key="value" type="button"
            :class="{ selected: myDiceGuess?.guess === value }" :disabled="!canGuessDice" @click="guessDice(value)">
            {{ value }}
          </button>
        </div>
      </div>

      <div class="party-list">
        <div v-for="item in guessDicePlayerRows" :key="item.id" class="party-row"
          :class="{ winner: item.winner, muted: item.timeout || item.loser }">
          <div class="avatar-circle">{{ item.initial }}</div>
          <div>
            <strong>{{ item.name }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <span>{{ item.badge }}</span>
        </div>
      </div>

      <div class="dual-btns">
        <button v-if="gs.phase === 'finished'" class="primary-btn" @click="rematch">再来一局</button>
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
        <div class="result-line rps-score-line">
          <span>第 {{ gs.round || 1 }}/{{ gs.maxRounds || 3 }} 局</span>
          <span>{{ myScore }} : {{ opponentScore }}</span>
          <span>先到 2 分</span>
        </div>

        <template v-if="gs.phase === 'choose'">
          <div class="ring-wrap">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(31,107,255,.18)" stroke-width="8" />
              <circle cx="50" cy="50" r="43" fill="none" :stroke="timerColor" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="270" :stroke-dashoffset="timerOffset" transform="rotate(-90 50 50)" />
            </svg>
            <strong>{{ timeLeft }}s</strong>
          </div>
          <p class="phase-copy">三局两胜，3 秒内快速出拳</p>
          <div class="move-row">
            <button v-for="move in moves" :key="move.key" class="move-btn"
              :class="{ selected: submittedMove === move.key, muted: hasSelectedMove && submittedMove !== move.key }"
              :disabled="hasSelectedMove" @click="selectMove(move.key)">
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
          <p class="phase-copy auto-next-copy">{{ rpsRevealHint }}</p>
        </template>

        <template v-else-if="gs.phase === 'finished'">
          <div class="round-result large"
            :class="{ win: gs.finalWinner === player?.id, lose: gs.finalWinner !== player?.id }">
            {{ gs.finalWinner === player?.id ? '恭喜获胜' : '再接再厉' }}
          </div>
          <div class="dual-btns">
            <button class="primary-btn" @click="rematch">再来一局</button>
            <button class="secondary-btn" @click="backToLobby">返回大厅</button>
          </div>
        </template>
      </div>
    </section>

    <section v-else-if="gameType === 'blackjack'" class="mode-card blackjack-mode">
      <div class="blackjack-hero">
        <div>
          <span>2-4 人 · 门票 30 分</span>
          <h2>21点</h2>
          <p>轮流要牌或停牌，不爆牌且点数最高者获胜。</p>
        </div>
        <strong>{{ blackjackStatusLabel }}</strong>
      </div>

      <div class="blackjack-table">
        <div v-for="item in blackjackPlayerRows" :key="item.id" class="blackjack-player"
          :class="{ active: item.active, winner: item.winner, busted: item.busted }">
          <div class="blackjack-player__top">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.status }}</span>
            </div>
            <b>{{ item.score }}</b>
          </div>
          <div class="blackjack-hand">
            <div v-for="(card, index) in item.cards" :key="`${item.id}-${index}-${card.rank || 'back'}`"
              class="blackjack-card" :class="[{ hidden: card.hidden }, cardColor(card)]">
              <span>{{ blackjackCardLabel(card) }}</span>
              <small>{{ blackjackSuitSymbol(card?.suit) }}</small>
            </div>
          </div>
        </div>
      </div>

      <div class="hint-line">{{ blackjackHintText }}</div>

      <div class="dual-btns">
        <template v-if="gs.phase === 'play'">
          <button class="primary-btn" :disabled="!isMyBlackjackTurn" @click="blackjackAction('hit')">要牌</button>
          <button class="secondary-btn" :disabled="!isMyBlackjackTurn" @click="blackjackAction('stand')">停牌</button>
        </template>
        <template v-else>
          <button class="primary-btn" @click="rematch">再来一局</button>
          <button class="secondary-btn" @click="backToLobby">返回大厅</button>
        </template>
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
            <circle cx="50" cy="50" r="43" fill="none" stroke="#1f6bff" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="270" :stroke-dashoffset="270 * (1 - quizTimerPercent)" transform="rotate(-90 50 50)" />
          </svg>
          <strong>{{ quizTimeLeft }}s</strong>
        </div>

        <h3>{{ gs.currentQuestion?.q }}</h3>

        <div class="quiz-options">
          <button v-for="(opt, i) in (gs.currentQuestion?.options || [])" :key="`${i}-${opt}`"
            :disabled="gs.answeredPlayers?.includes(player?.id)" :class="{ selected: quizAnswer === i }"
            @click="quizSubmitAnswer(i)">
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

    <ZhaJinHuaBoard v-else-if="gameType === 'zha_jin_hua'" :gs="gs" :player="player" :room-players="roomPlayers"
      @action="emitGameAction" @rematch="rematch" @back="backToLobby" />

    <GuandanBoard v-else-if="gameType === 'guandan'" :gs="gs" :player="player" :room-players="roomPlayers"
      @action="emitGameAction" @rematch="rematch" @back="backToLobby" />

    <DoudizhuBoard v-else-if="gameType === 'doudizhu'" :gs="gs" :player="player" :room-players="roomPlayers"
      @action="emitGameAction" @rematch="rematch" @back="backToLobby" />

    <MahjongBoard v-else-if="gameType === 'mahjong'" :gs="gs" :player="player" :room-players="roomPlayers"
      @action="emitGameAction" @rematch="rematch" @back="backToLobby" />

    <GomokuBoard v-else-if="gameType === 'gomoku'" :gs="gs" :player="player" :room-players="roomPlayers"
      @action="emitGameAction" @forfeit="forfeitGame" @rematch="rematch" @back="backToLobby" />

    <ChessBoard v-else-if="gameType === 'chess'" :gs="gs" :player="player" :room-players="roomPlayers"
      @action="emitGameAction" @forfeit="forfeitGame" @rematch="rematch" @back="backToLobby" />

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
      <div v-if="showRoomRules" class="rules-overlay" @click="showRoomRules = false">
        <article class="rules-panel" role="dialog" aria-modal="true" @click.stop>
          <header class="rules-panel__head">
            <div>
              <span>玩法与积分</span>
              <h3>{{ roomRuleDetails.name }}</h3>
            </div>
            <button type="button" class="rules-close-btn" @click="showRoomRules = false">关闭</button>
          </header>

          <div class="rules-section">
            <h4>玩法</h4>
            <p>{{ roomRuleDetails.play }}</p>
          </div>

          <div class="rules-section">
            <h4>胜负判定</h4>
            <p>{{ roomRuleDetails.win }}</p>
          </div>

          <div class="rules-section">
            <h4>积分规则</h4>
            <ul>
              <li v-for="item in roomRuleDetails.scoring" :key="item">{{ item }}</li>
            </ul>
          </div>
        </article>
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
  import { gameState, getPlayer, socket, ensureAuthenticated, setCurrentGame } from '../socket'
  import die1Image from '../../img/dice/die-1.webp'
  import die2Image from '../../img/dice/die-2.webp'
  import die3Image from '../../img/dice/die-3.webp'
  import die4Image from '../../img/dice/die-4.webp'
  import die5Image from '../../img/dice/die-5.webp'
  import die6Image from '../../img/dice/die-6.webp'

  const ZhaJinHuaBoard = defineAsyncComponent(() => import('../components/games/ZhaJinHuaBoard.vue'))
  const GuandanBoard = defineAsyncComponent(() => import('../components/games/GuandanBoard.vue'))
  const DoudizhuBoard = defineAsyncComponent(() => import('../components/games/DoudizhuBoard.vue'))
  const MahjongBoard = defineAsyncComponent(() => import('../components/games/MahjongBoard.vue'))
  const GomokuBoard = defineAsyncComponent(() => import('../components/games/GomokuBoard.vue'))
  const ChessBoard = defineAsyncComponent(() => import('../components/games/ChessBoard.vue'))

  const DICE_FACE_IMAGES = {
    1: die1Image,
    2: die2Image,
    3: die3Image,
    4: die4Image,
    5: die5Image,
    6: die6Image
  }

  const DEFAULT_ROOM_RULE = {
    name: '游戏对局',
    play: '进入候场房后，所有当前玩家准备且人数达到要求，倒计时结束后开始游戏。',
    win: '按本游戏内的胜负判定结算。',
    scoring: ['按本游戏门票分和胜负结果结算积分。']
  }

  const ROOM_RULES = {
    reaction_race: {
      name: '看谁快',
      play: '2 到 6 人参与。绿灯亮起后立刻点击按钮，比拼反应速度。',
      win: '最先完成有效点击的玩家获胜；抢点或超时不会获胜。',
      scoring: ['门票 10 分。获胜者获得本局奖池收益，其他玩家各扣 10 分。']
    },
    dice_roll: {
      name: '摇骰子',
      play: '2 到 6 人参与。每名玩家摇两颗骰子，比拼点数总和。',
      win: '点数最高的玩家获胜；若最高点数并列，则并列玩家共同获胜。',
      scoring: ['门票 10 分。胜者平分奖池收益，未获胜玩家各扣 10 分。']
    },
    guess_dice: {
      name: '猜点数',
      play: '3 到 6 人参与。每名玩家选择 1 到 6 的一个点数，系统摇一颗骰子作为结果。',
      win: '猜中骰子点数的玩家获胜；可能多人同时猜中，也可能无人猜中。',
      scoring: [
        '门票 10 分。猜中的玩家各加 10 分，猜错的玩家各扣 10 分。',
        '如果所有玩家都猜中，则所有人都加 10 分；如果无人猜中，则所有人都扣 10 分。'
      ]
    },
    rock_paper_scissors: {
      name: '剪刀石头布',
      play: '2 人参与。双方每局同时选择剪刀、石头或布，3 秒内未选择会自动出拳。',
      win: '三局两胜，先赢 2 局者获胜；平局不计分并立即重开当前局。',
      scoring: ['门票 10 分。整场胜者加 10 分，败者扣 10 分。']
    },
    blackjack: {
      name: '21点',
      play: '2 到 4 人参与。每人开局 2 张牌，轮到自己时可以要牌或停牌；A 可按 11 点或 1 点计算。',
      win: '所有玩家停牌、爆牌或达到 21 点后结算；未爆牌且点数最高者获胜。',
      scoring: ['门票 30 分。胜者按多人奖池规则获得收益，爆牌玩家无法获胜。']
    },
    quiz: {
      name: '快问快答',
      play: '2 到 4 人参与，共 3 题。每题限时作答，答对得题内分。',
      win: '三题结束后，题内得分最高的玩家获胜。',
      scoring: ['门票 20 分。胜者获得奖池收益，其他玩家各扣 20 分。']
    },
    gomoku: {
      name: '五子棋',
      play: '2 人参与。双方轮流落子，黑方先手。',
      win: '任意横、竖、斜方向先连成 5 子者获胜；棋盘下满无五连为平局。',
      scoring: ['门票 30 分。胜者加 30 分，败者扣 30 分；平局不增减积分。']
    },
    chess: {
      name: '象棋',
      play: '2 人参与。双方按中国象棋规则轮流走子，红方先行。',
      win: '吃掉对方将/帅，或让对方无合法走法时获胜；双方同意和棋则为平局。',
      scoring: ['门票 50 分。胜者加 50 分，败者扣 50 分；和棋不增减积分。']
    },
    doudizhu: {
      name: '斗地主',
      play: '3 人参与。叫分抢地主后，地主拿底牌并先出，玩家按牌型压牌或过牌。',
      win: '地主先出完则地主获胜；任意农民先出完则两名农民共同获胜。',
      scoring: [
        '基础结算单位为 50 分，每出现炸弹或王炸会提高结算单位。',
        '地主胜时地主加双倍结算单位，两名农民各扣一个结算单位；农民胜时反向结算。'
      ]
    },
    guandan: {
      name: '掼蛋',
      play: '4 人参与，两副牌，南北一队、东西一队，按牌型轮流出牌或过牌。',
      win: '按出完顺序结算本轮，头游所在队为胜方，并按名次组合升级。',
      scoring: ['门票 100 分。胜方按等级差获得奖励，负方扣除同等分数。']
    },
    zha_jin_hua: {
      name: '炸金花',
      play: '2 到 5 人参与。每人 3 张牌，可看牌、跟注、加注、比牌或弃牌。',
      win: '其他玩家弃牌或比牌出局后，最后留在场上的玩家获胜；也可摊牌比较牌型。',
      scoring: ['基础下注 20 分。赢家获得当前奖池扣除自己投入后的收益，输家扣除本局实际投入。']
    },
    mahjong: {
      name: '红中麻将',
      play: '4 人参与。按红中麻将规则摸牌、打牌、碰、杠、胡。',
      win: '自摸、点炮胡、杠上开花、抢杠胡、天胡、地胡或四红中均可结束对局；流局无人获胜。',
      scoring: ['底分 50 分。按胡牌方式、番型和杠分直接结算到玩家积分。']
    }
  }

  const route = useRoute()
  const router = useRouter()

  const roomId = computed(() => route.params.roomId)
  const player = computed(() => getPlayer())
  const gs = ref({})
  const opponentDisconnected = ref(false)
  const selectedMove = ref(null)
  const timeLeft = ref(5)
  const quizAnswer = ref(null)
  const quizTimeLeft = ref(15)
  const readyDeadlineLeft = ref(0)
  const readySubmitting = ref(false)
  const showInvitePanel = ref(false)
  const showRoomRules = ref(false)
  const inviteCandidates = ref([])
  const inviteLoading = ref(false)
  const inviteSearchText = ref('')
  const confirmDialog = ref({ visible: false, title: '确认操作', message: '' })
  const zhaJinHuaFoldedOut = ref(false)
  const zhaJinHuaFoldedGameType = ref('')
  const diceRollAnimating = ref(false)
  const diceRollPreviewValues = ref([1, 6])
  const guessDiceAnimating = ref(false)
  const guessDicePreviewValue = ref(3)
  const lastGuessDiceResultKey = ref('')

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
  let forfeitNoticeHandler = null
  let drawOfferHandler = null
  let drawDeclinedHandler = null
  let opponentDisconnectedTimer = null
  let activeDrawOfferKey = ''
  let diceRollAnimationTimer = null
  let diceRollPreviewTimer = null
  let guessDiceAnimationTimer = null
  let guessDicePreviewTimer = null
  let rpsAutoAdvanceTimer = null

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
  const availableSeatCount = computed(() => Math.max(0, Number(currentRoom.value?.maxPlayers || roomPlayers.value.length) - roomPlayers.value.length))
  const isFixedPlayerRoom = computed(() => {
    const min = Math.max(1, Number(currentRoom.value?.minPlayers || roomPlayers.value.length || 1))
    const max = Math.max(min, Number(currentRoom.value?.maxPlayers || min))
    return min === max
  })
  const emptySeatCount = computed(() => (isFixedPlayerRoom.value ? availableSeatCount.value : 0))
  const readyPlayerRange = computed(() => {
    const min = Math.max(1, Number(currentRoom.value?.minPlayers || roomPlayers.value.length || 1))
    const max = Math.max(min, Number(currentRoom.value?.maxPlayers || min))
    return min === max ? `${min}人` : `${min}-${max}人`
  })
  const roomRuleDetails = computed(() => ROOM_RULES[gameType.value] || DEFAULT_ROOM_RULE)
  const canInvitePlayers = computed(() => {
    if (!isReadyRoom.value || availableSeatCount.value <= 0) return false

    const room = currentRoom.value
    if (room?.visibility === 'public') {
      return roomPlayers.value.some(item => item.id === player.value?.id)
    }

    return room?.visibility === 'private' && room.ownerId === player.value?.id
  })
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
      guess_dice: '猜点数',
      rock_paper_scissors: '剪刀石头布',
      blackjack: '21点',
      zha_jin_hua: '炸金花',
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
  const isRpsFinalReveal = computed(() => {
    const winner = gs.value?.result?.winner
    if (!winner) return false
    return Number(gs.value?.scores?.[winner] || 0) >= Number(gs.value?.targetScore || 2)
  })
  const rpsRevealHint = computed(() => {
    if (roundResult.value === 'draw') return '平局不计分，马上重开本局'
    return isRpsFinalReveal.value ? '即将结算整场胜负' : '下一局马上开始'
  })

  const timerTotal = computed(() => Math.max(1, Number(gs.value?.timer || 5)))
  const timerColor = computed(() => timeLeft.value > Math.ceil(timerTotal.value / 2) ? '#2eb87f' : '#ff4e4e')
  const timerOffset = computed(() => 270 * (1 - Math.max(0, timeLeft.value) / timerTotal.value))

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
  const myDiceDisplayValues = computed(() => (
    diceRollAnimating.value ? diceRollPreviewValues.value : myDiceValues.value
  ))
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

  const diceGuessOptions = [1, 2, 3, 4, 5, 6]
  const myDiceGuess = computed(() => gs.value?.guesses?.[player.value?.id] || null)
  const canGuessDice = computed(() => (
    gs.value?.phase === 'guessing' &&
    !myDiceGuess.value
  ))
  const guessDiceValue = computed(() => gs.value?.dice || '?')
  const guessDiceDisplayValue = computed(() => (
    guessDiceAnimating.value ? guessDicePreviewValue.value : guessDiceValue.value
  ))
  const guessDicePhaseLabel = computed(() => {
    if (gs.value?.phase === 'finished') return '开奖'
    return myDiceGuess.value ? '已选择' : `${timeLeft.value}s`
  })
  const guessDiceResultLabel = computed(() => {
    if (gs.value?.phase !== 'finished') {
      return myDiceGuess.value ? `已选 ${myDiceGuess.value.guess} 点` : '选择点数'
    }
    return `开出 ${gs.value?.dice || '?'} 点`
  })
  const guessDiceHintText = computed(() => {
    if (gs.value?.phase !== 'finished') {
      return canGuessDice.value ? '请选择你认为会摇出的点数' : '等待其他玩家选择'
    }
    const winners = gs.value?.winningPlayers || []
    if (winners.length === 0) return '无人猜中，所有人扣除门票积分'
    if (winners.length === roomPlayers.value.length) return '所有人猜中，所有人获得门票积分'
    return `猜中：${winners.map(getPlayerName).join('、')}`
  })
  const guessDicePlayerRows = computed(() => {
    const winners = new Set(gs.value?.winningPlayers || [])
    return roomPlayers.value.map((item) => {
      const guess = gs.value?.guesses?.[item.id]
      const finished = gs.value?.phase === 'finished'
      const winner = winners.has(item.id)
      return {
        id: item.id,
        name: item.nickname || '玩家',
        initial: (item.nickname || '玩').slice(0, 1),
        winner,
        loser: finished && !winner,
        timeout: Boolean(guess?.timeout),
        detail: guess?.timeout ? '超时未选' : (guess ? `选择 ${guess.guess} 点` : '等待选择'),
        badge: finished ? (winner ? '+10' : '-10') : (guess ? '已选' : '待定')
      }
    })
  })

  const isMyBlackjackTurn = computed(() => (
    gs.value?.phase === 'play' &&
    gs.value?.currentPlayer === player.value?.id
  ))
  const blackjackStatusLabel = computed(() => {
    if (gs.value?.phase === 'finished') return '结算'
    return isMyBlackjackTurn.value ? `${timeLeft.value}s` : '等待'
  })
  const blackjackHintText = computed(() => {
    if (gs.value?.phase === 'finished') {
      return gs.value?.finalWinner === player.value?.id
        ? '你获得本局胜利'
        : `${getPlayerName(gs.value?.finalWinner)} 获得本局胜利`
    }
    return isMyBlackjackTurn.value
      ? '轮到你操作，可以继续要牌或选择停牌'
      : `等待 ${getPlayerName(gs.value?.currentPlayer)} 操作`
  })
  const blackjackPlayerRows = computed(() => {
    const finishedPlayers = new Set(gs.value?.finishedPlayers || [])
    const bustedPlayers = new Set(gs.value?.bustedPlayers || [])
    const handCounts = gs.value?.handCounts || {}
    return roomPlayers.value.map((item) => {
      const hand = gs.value?.hands?.[item.id] || []
      const hiddenCount = hand.length ? 0 : Number(handCounts[item.id] || 0)
      const busted = bustedPlayers.has(item.id)
      const winner = gs.value?.finalWinner === item.id
      const active = gs.value?.phase === 'play' && gs.value?.currentPlayer === item.id
      const done = finishedPlayers.has(item.id)
      return {
        id: item.id,
        name: item.nickname || '玩家',
        active,
        winner,
        busted,
        cards: hand.length ? hand : Array.from({ length: hiddenCount }, () => ({ hidden: true })),
        score: hand.length ? blackjackHandValue(hand) : (hiddenCount ? `${hiddenCount}张` : '--'),
        status: winner ? '赢家' : (busted ? '爆牌' : (active ? '操作中' : (done ? '已停牌' : '等待')))
      }
    })
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

  function normalizedDiceValue(value) {
    const numberValue = Number(value)
    return Number.isInteger(numberValue) && numberValue >= 1 && numberValue <= 6 ? numberValue : null
  }

  function randomDiceValue() {
    return Math.floor(Math.random() * 6) + 1
  }

  function diceImage(value) {
    return DICE_FACE_IMAGES[normalizedDiceValue(value)] || ''
  }

  function diceAlt(value) {
    const numberValue = normalizedDiceValue(value)
    return numberValue ? `dice ${numberValue}` : 'dice rolling'
  }

  function clearDiceRollAnimation() {
    if (diceRollAnimationTimer) {
      clearTimeout(diceRollAnimationTimer)
      diceRollAnimationTimer = null
    }
    if (diceRollPreviewTimer) {
      clearInterval(diceRollPreviewTimer)
      diceRollPreviewTimer = null
    }
    diceRollAnimating.value = false
  }

  function startDiceRollAnimation(duration = 1160) {
    clearDiceRollAnimation()
    diceRollAnimating.value = true
    diceRollPreviewValues.value = [randomDiceValue(), randomDiceValue()]
    diceRollPreviewTimer = setInterval(() => {
      diceRollPreviewValues.value = [randomDiceValue(), randomDiceValue()]
    }, 78)
    diceRollAnimationTimer = setTimeout(clearDiceRollAnimation, duration)
  }

  function clearGuessDiceAnimation() {
    if (guessDiceAnimationTimer) {
      clearTimeout(guessDiceAnimationTimer)
      guessDiceAnimationTimer = null
    }
    if (guessDicePreviewTimer) {
      clearInterval(guessDicePreviewTimer)
      guessDicePreviewTimer = null
    }
    guessDiceAnimating.value = false
  }

  function startGuessDiceAnimation(duration = 1040) {
    clearGuessDiceAnimation()
    guessDiceAnimating.value = true
    guessDicePreviewValue.value = randomDiceValue()
    guessDicePreviewTimer = setInterval(() => {
      guessDicePreviewValue.value = randomDiceValue()
    }, 78)
    guessDiceAnimationTimer = setTimeout(clearGuessDiceAnimation, duration)
  }

  function blackjackHandValue(cards = []) {
    let total = 0
    let aces = 0
    for (const card of cards) {
      total += Number(card?.value || 0)
      if (card?.rank === 'A') aces += 1
    }
    while (total > 21 && aces > 0) {
      total -= 10
      aces -= 1
    }
    return total > 21 ? `${total} 爆` : total
  }

  function blackjackCardLabel(card) {
    return card?.hidden ? '?' : (card?.rank || '?')
  }

  function blackjackSuitSymbol(suit) {
    return { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }[suit] || ''
  }

  function cardColor(card) {
    return ['heart', 'diamond'].includes(card?.suit) ? 'red' : 'black'
  }

  function tapReactionRace() {
    if (reactionButtonDisabled.value) return
    socket.emit('game:action', { action: { type: 'tap' } })
  }

  function rollDice() {
    if (!canRollDice.value) return
    startDiceRollAnimation()
    socket.emit('game:action', { action: { type: 'roll' } })
  }

  function guessDice(value) {
    if (!canGuessDice.value) return
    socket.emit('game:action', { action: { type: 'guess', guess: value } })
  }

  function blackjackAction(type) {
    if (!isMyBlackjackTurn.value) return
    socket.emit('game:action', { action: { type } })
  }

  function moveIcon(key) {
    return { rock: '✊', scissors: '✌️', paper: '🖐️' }[key] || '❔'
  }

  function selectMove(move) {
    if (hasSelectedMove.value) return
    selectedMove.value = move
    socket.emit('game:action', { action: { type: 'choose', choice: move } })
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
          setCurrentGame(res.gameState, "playing")
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
        setCurrentGame(res.room.gameState, res.room.status)
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
    loadInvitePlayers()
  }

  function openInvitePanel() {
    if (!showInvitePanel.value) {
      showInvitePanel.value = true
      loadInvitePlayers()
      return
    }

    if (!inviteLoading.value && inviteCandidates.value.length === 0) {
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

  async function rematch() {
    const activeGameType = zhaJinHuaFoldedGameType.value || gameType.value
    if (!player.value || !activeGameType) return
    if (isZhaJinHuaFoldedOut.value) {
      const targetGameType = activeGameType || 'zha_jin_hua'
      socket.emit('match:join', { gameType: targetGameType }, (res) => {
        if (res?.error) {
          alert(res.error)
          return
        }
        zhaJinHuaFoldedOut.value = false
        zhaJinHuaFoldedGameType.value = ''
        if (res?.room?.roomId) {
          gameState.currentRoom = res.room
          if (res.room.status === 'readying') {
            setCurrentGame(null)
            gs.value = {}
          } else {
            setCurrentGame(res.room.gameState, res.room.status)
            gs.value = res.room.gameState || {}
          }
          socket.emit('room:join', { roomId: res.room.roomId })
          router.push(`/game/${res.room.roomId}`)
        }
      })
      return
    }

    const targetRoomId = currentRoom.value?.roomId || currentRoom.value?.id || roomId.value
    socket.emit('game:rematch', { roomId: targetRoomId }, (res) => {
      if (res?.error) {
        alert(res.error)
        return
      }
      if (res?.requeued) {
        router.push('/lobby')
        return
      }
      if (res?.room) {
        gameState.currentRoom = res.room
        // 如果是重新准备阶段，清空旧游戏状态
        if (res.room.status === 'readying') {
          setCurrentGame(null)
          gs.value = {}
        } else {
          setCurrentGame(res.room.gameState, res.room.status)
          gs.value = res.room.gameState || {}
        }
        readySubmitting.value = false
        updateReadyDeadline()
      }
    })
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
      setCurrentGame(null)
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

  onMounted(async () => {
    if (!player.value) {
      // 尝试恢复身份后再跳转
      const restored = await ensureAuthenticated().catch(() => null)
      if (!restored) {
        router.push('/')
        return
      }
    }

    gs.value = gameState.currentGame || {}

    // 如果当前房间是准备状态但 gameState 还有旧数据，清空它
    if (gameState.currentRoom?.status === 'readying' && gs.value?.phase) {
      gs.value = {}
      setCurrentGame(null)
    }

    stateHandler = (event) => {
      gs.value = event.detail.gameState
      if (event.detail.room) {
        gameState.currentRoom = event.detail.room
      }
      if (gameType.value === 'rock_paper_scissors' && gs.value?.phase === 'choose' && !gs.value?.choices?.[player.value?.id]) {
        selectedMove.value = null
      }
    }
    window.addEventListener('game:state', stateHandler)

    roomUpdateHandler = (event) => {
      gameState.currentRoom = event.detail
      setCurrentGame(event.detail.gameState, event.detail.status)
      gs.value = event.detail.gameState || {}
      readySubmitting.value = false
      updateReadyDeadline()
    }
    window.addEventListener('room:update', roomUpdateHandler)

    roomStartedHandler = (event) => {
      zhaJinHuaFoldedOut.value = false
      zhaJinHuaFoldedGameType.value = ''
      gameState.currentRoom = event.detail
      setCurrentGame(event.detail.gameState, event.detail.status)
      gs.value = event.detail.gameState || {}
      readySubmitting.value = false
      showInvitePanel.value = false
      showRoomRules.value = false
    }
    window.addEventListener('room:started', roomStartedHandler)

    resultHandler = (event) => {
      if (event.detail.room) {
        gameState.currentRoom = event.detail.room
        setCurrentGame(event.detail.room.gameState, event.detail.room.status)
      }
      const { players: resultPlayers, room: resultRoom, ...result } = event.detail
      gs.value = resultRoom?.gameState
        ? { ...resultRoom.gameState, resultPlayers }
        : { ...gs.value, ...result, resultPlayers }
      clearOpponentDisconnectedNotice()
    }
    window.addEventListener('game:result', resultHandler)

    forfeitNoticeHandler = (event) => {
      if (event.detail?.roomId && event.detail.roomId !== currentRoom.value?.roomId && event.detail.roomId !== currentRoom.value?.id) return
      alert(`${event.detail?.nickname || '对方'} 已认输，本局进入结算`)
    }
    window.addEventListener('game:forfeit_notice', forfeitNoticeHandler)

    drawOfferHandler = async (event) => {
      if (gameType.value !== 'chess') return
      const roomId = currentRoom.value?.roomId || currentRoom.value?.id
      if (event.detail?.roomId && event.detail.roomId !== roomId) return
      const offerKey = `${event.detail?.roomId || roomId}:${event.detail?.fromPlayerId || ''}:${event.detail?.offeredAt || ''}`
      if (activeDrawOfferKey === offerKey) return
      activeDrawOfferKey = offerKey

      const accepted = await askConfirm(`${event.detail?.fromNickname || '对方'} 请求和棋，是否同意？`, '求和申请')
      socket.emit('game:action', {
        action: { type: accepted ? 'offer_draw' : 'decline_draw' }
      }, (res) => {
        if (res?.error) alert(res.error)
      })
    }
    window.addEventListener('game:draw_offer', drawOfferHandler)

    drawDeclinedHandler = (event) => {
      if (event.detail?.roomId && event.detail.roomId !== currentRoom.value?.roomId && event.detail.roomId !== currentRoom.value?.id) return
      alert(`${event.detail?.byNickname || '对方'} 拒绝了求和，游戏继续`)
    }
    window.addEventListener('game:draw_declined', drawDeclinedHandler)

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
      router.push('/lobby')
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
      setCurrentGame(room.gameState, room.status)
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
    clearDiceRollAnimation()
    clearGuessDiceAnimation()
    clearOpponentDisconnectedNotice()
    if (rpsAutoAdvanceTimer) clearTimeout(rpsAutoAdvanceTimer)
    if (stateHandler) window.removeEventListener('game:state', stateHandler)
    if (resultHandler) window.removeEventListener('game:result', resultHandler)
    if (dcHandler) window.removeEventListener('game:opponent_disconnected', dcHandler)
    if (roomUpdateHandler) window.removeEventListener('room:update', roomUpdateHandler)
    if (roomStartedHandler) window.removeEventListener('room:started', roomStartedHandler)
    if (kickedHandler) window.removeEventListener('room:kicked', kickedHandler)
    if (requeuedHandler) window.removeEventListener('match:requeued', requeuedHandler)
    if (abandonedHandler) window.removeEventListener('room:abandoned', abandonedHandler)
    if (matchedHandler) window.removeEventListener('game:matched', matchedHandler)
    if (forfeitNoticeHandler) window.removeEventListener('game:forfeit_notice', forfeitNoticeHandler)
    if (drawOfferHandler) window.removeEventListener('game:draw_offer', drawOfferHandler)
    if (drawDeclinedHandler) window.removeEventListener('game:draw_declined', drawDeclinedHandler)
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

  // rps reveal 阶段：2.5 秒后自动推进到下一轮/结算
  watch(() => [gameType.value, gs.value?.phase], ([type, phase]) => {
    if (rpsAutoAdvanceTimer) {
      clearTimeout(rpsAutoAdvanceTimer)
      rpsAutoAdvanceTimer = null
    }
    if (type === 'rock_paper_scissors' && phase === 'reveal') {
      rpsAutoAdvanceTimer = setTimeout(() => {
        rpsAutoAdvanceTimer = null
        socket.emit('game:action', { action: { type: 'next_round' } })
      }, 2500)
    }
  })

  watch(() => [gameType.value, gs.value?.phase, gs.value?.dice, currentRoom.value?.roomId || currentRoom.value?.id], ([type, phase, diceValue, activeRoomId]) => {
    if (type !== 'guess_dice') {
      lastGuessDiceResultKey.value = ''
      clearGuessDiceAnimation()
      return
    }

    if (phase !== 'finished') {
      lastGuessDiceResultKey.value = ''
      clearGuessDiceAnimation()
      return
    }

    const resultValue = normalizedDiceValue(diceValue)
    if (!resultValue) return

    const resultKey = `${activeRoomId || ''}:${resultValue}`
    if (lastGuessDiceResultKey.value === resultKey) return

    lastGuessDiceResultKey.value = resultKey
    startGuessDiceAnimation()
  })

  watch(() => roomId.value, () => {
    gs.value = {}
    opponentDisconnected.value = false
    selectedMove.value = null
    zhaJinHuaFoldedOut.value = false
    zhaJinHuaFoldedGameType.value = ''
    lastGuessDiceResultKey.value = ''
    if (rpsAutoAdvanceTimer) {
      clearTimeout(rpsAutoAdvanceTimer)
      rpsAutoAdvanceTimer = null
    }
    clearDiceRollAnimation()
    clearGuessDiceAnimation()
  })
</script>

<style scoped>
  .game-room {
    --game-header-space: 60px;
    --game-viewport-height: calc(100dvh - var(--game-header-space));
    width: 100%;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0;
    display: flex;
    flex-direction: column;
    color: #fff;
  }

  .game-room.fullscreen-game {
    width: 100vw;
    height: 100dvh;
    min-height: 0;
    --game-viewport-height: 100dvh;
    overflow: hidden;
    padding: 0;
  }

  .game-room.fullscreen-game .game-header {
    display: none;
  }

  .game-room.ready-layout {
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 10px calc(96px + env(safe-area-inset-bottom));
    align-items: stretch;
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

  .rps-score-line {
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .rps-score-line span:nth-child(2) {
    min-width: 88px;
    padding: 0 14px;
    background: linear-gradient(180deg, #fff3d0, #ffd66a);
    color: #155bd6;
    font-size: 18px;
    font-weight: 1000;
  }

  .auto-next-copy {
    min-height: 28px;
    font-weight: 900;
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

  .rules-overlay {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(8, 20, 38, 0.46);
    backdrop-filter: blur(8px);
  }

  .rules-panel {
    width: min(420px, 100%);
    max-height: min(78dvh, 620px);
    overflow-y: auto;
    border-radius: 20px;
    padding: 18px;
    background: #fff;
    box-shadow: 0 18px 42px rgba(8, 24, 52, 0.28);
    color: #183052;
  }

  .rules-panel__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .rules-panel__head span {
    color: #6b82ac;
    font-size: 12px;
    font-weight: 900;
  }

  .rules-panel__head h3 {
    margin: 4px 0 0;
    color: #17315d;
    font-size: 22px;
    line-height: 1.15;
    font-weight: 1000;
  }

  .rules-close-btn {
    min-width: 62px;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid #aac9f4;
    background: #fff;
    color: #1f66da;
    font-weight: 900;
  }

  .rules-section {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #e4eefb;
  }

  .rules-section h4 {
    margin: 0 0 6px;
    color: #17315d;
    font-size: 15px;
    font-weight: 1000;
  }

  .rules-section p,
  .rules-section ul {
    margin: 0;
    color: #51647f;
    font-size: 14px;
    line-height: 1.6;
    font-weight: 700;
  }

  .rules-section ul {
    padding-left: 18px;
  }

  .rules-section li+li {
    margin-top: 6px;
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

  .final-box p+p {
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
    flex: 0 0 auto;
    margin: 0 auto;
    padding: 16px;
    overflow: visible;
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

  .ready-player-range {
    margin: 6px 0 0;
    color: #6b82ac;
    font-size: 13px;
    font-weight: 900;
  }

  .ready-head-actions {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
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

  .rules-icon-btn {
    width: 46px;
    height: 46px;
    border-radius: 16px;
    border: 1px solid #c9dcf7;
    background: linear-gradient(180deg, #fff8dc, #ffd86b);
    color: #1365e8;
    display: grid;
    place-items: center;
    font-size: 25px;
    line-height: 1;
    font-weight: 1000;
    box-shadow: 0 8px 14px rgba(9, 89, 208, 0.14);
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

  .ready-player .avatar-circle {
    width: 50px;
    height: 50px;
    font-size: 22px;
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

  .ready-player-actions {
    justify-self: end;
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ready-status {
    min-height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    background: #eef5ff;
    color: #6b82ac;
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    font-weight: 900;
    white-space: nowrap;
  }

  .ready-status.on {
    background: #e8fbf1;
    color: #168a4c;
  }

  .ready-inline-action {
    min-width: 68px;
    min-height: 34px;
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
    box-shadow: 0 7px 14px rgba(9, 89, 208, 0.16);
  }

  .ready-inline-action.ready {
    background: linear-gradient(180deg, #2eb87f, #148f5d);
  }

  .ready-inline-action.invite {
    background: linear-gradient(180deg, #fff8dc, #ffd86b);
    color: #1365e8;
  }

  .ready-inline-action:disabled {
    opacity: 0.68;
    box-shadow: none;
  }

  .ready-actions {
    margin-top: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
    max-height: clamp(180px, 36dvh, 300px);
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
    padding: 0 10px calc(18px + env(safe-area-inset-bottom));
    align-items: stretch;
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

  .party-row>span {
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
    align-items: center;
    gap: 16px;
    min-height: 110px;
    perspective: 760px;
    transform-style: preserve-3d;
  }

  .guess-dice-stage {
    align-content: center;
  }

  .single-dice {
    margin: 0 auto;
  }

  .guess-dice-options {
    width: min(100%, 360px);
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
  }

  .guess-dice-options button {
    min-height: 46px;
    border: 2px solid #cfe3fb;
    border-radius: 14px;
    background: #fff;
    color: #153260;
    font-size: 18px;
    font-weight: 1000;
    box-shadow: 0 8px 14px rgba(16, 92, 180, 0.08);
  }

  .guess-dice-options button.selected {
    border-color: #ffd56a;
    background: linear-gradient(180deg, #fff9df, #ffe38f);
  }

  .guess-dice-options button:disabled:not(.selected) {
    opacity: 0.55;
  }

  .dice-face {
    --dice-size: 96px;
    position: relative;
    width: var(--dice-size);
    height: var(--dice-size);
    margin: 0;
    border-radius: 24px;
    display: grid;
    place-items: center;
    background: transparent;
    transform: rotateX(7deg) rotateY(-8deg) translateZ(0);
    transform-style: preserve-3d;
    filter: drop-shadow(0 14px 18px rgba(22, 54, 103, 0.18));
    will-change: transform;
  }

  .single-dice {
    --dice-size: 108px;
    margin: 0 auto;
  }

  .dice-face::before {
    content: '';
    position: absolute;
    inset: 8px 7px 6px 8px;
    z-index: 0;
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(232, 238, 247, 0.78), rgba(185, 197, 215, 0.58) 58%, rgba(105, 120, 146, 0.5));
    opacity: 0.55;
    transform: translate3d(8px, 9px, -14px) skewY(1deg);
    filter: blur(0.4px);
  }

  .dice-face img {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    transform: translateZ(14px);
    pointer-events: none;
    user-select: none;
  }

  .dice-face.is-empty {
    background: linear-gradient(180deg, #fff7d7, #ffd56a);
    box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.55);
  }

  .dice-face.is-empty::before {
    opacity: 0.2;
  }

  .dice-placeholder {
    position: relative;
    z-index: 1;
    color: #153260;
    font-size: 34px;
    font-weight: 1000;
    transform: translateZ(14px);
  }

  .dice-face.is-rolling {
    animation: dice-tumble 1040ms cubic-bezier(0.16, 0.9, 0.28, 1) both;
    animation-delay: var(--roll-delay, 0ms);
  }

  .dice-face.is-rolling img {
    animation: dice-face-flash 1040ms ease-in-out both;
    animation-delay: var(--roll-delay, 0ms);
  }

  @keyframes dice-tumble {
    0% {
      transform: translate3d(-3px, 0, 0) rotateX(8deg) rotateY(-12deg) rotateZ(-5deg) scale(0.96);
    }

    16% {
      transform: translate3d(8px, -14px, 26px) rotateX(62deg) rotateY(116deg) rotateZ(28deg) scale(1.08);
    }

    32% {
      transform: translate3d(-9px, 5px, 16px) rotateX(142deg) rotateY(218deg) rotateZ(-32deg) scale(1.03);
    }

    50% {
      transform: translate3d(9px, -8px, 30px) rotateX(232deg) rotateY(318deg) rotateZ(18deg) scale(1.1);
    }

    68% {
      transform: translate3d(-5px, 6px, 13px) rotateX(314deg) rotateY(416deg) rotateZ(-14deg) scale(1.02);
    }

    84% {
      transform: translate3d(3px, -2px, 5px) rotateX(372deg) rotateY(352deg) rotateZ(6deg) scale(1.01);
    }

    100% {
      transform: translate3d(0, 0, 0) rotateX(7deg) rotateY(-8deg) rotateZ(0) scale(1);
    }
  }

  @keyframes dice-face-flash {

    0%,
    100% {
      filter: brightness(1) blur(0);
    }

    28%,
    72% {
      filter: brightness(1.08) blur(0.35px);
    }
  }

  @media (prefers-reduced-motion: reduce) {

    .dice-face.is-rolling,
    .dice-face.is-rolling img {
      animation: none;
    }
  }

  .dice-stage>strong {
    color: #153260;
    font-size: 32px;
    line-height: 1;
    font-weight: 1000;
  }

  .dice-stage>p {
    margin: 0;
    color: #6b82ac;
    font-size: 14px;
    font-weight: 800;
  }

  .blackjack-mode {
    display: grid;
    gap: 12px;
  }

  .blackjack-hero {
    min-height: 116px;
    padding: 18px;
    border-radius: 24px;
    color: #fff;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    background: linear-gradient(140deg, #123e83, #1672d9 55%, #24b37d);
    box-shadow: 0 14px 26px rgba(9, 80, 190, 0.16);
  }

  .blackjack-hero span,
  .blackjack-hero p {
    display: block;
    margin: 0;
    color: rgba(255, 255, 255, 0.86);
    font-size: 13px;
    line-height: 1.35;
    font-weight: 800;
  }

  .blackjack-hero h2 {
    margin: 6px 0;
    font-size: 30px;
    line-height: 1;
    font-weight: 1000;
  }

  .blackjack-hero strong {
    min-width: 72px;
    height: 72px;
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.18);
    display: grid;
    place-items: center;
    color: #d8ffe9;
    font-size: 20px;
    font-weight: 1000;
  }

  .blackjack-table {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .blackjack-player {
    min-height: 150px;
    padding: 12px;
    border-radius: 18px;
    border: 2px solid #dceafb;
    background: #fff;
    display: grid;
    gap: 10px;
  }

  .blackjack-player.active {
    border-color: #47b8ff;
    box-shadow: 0 10px 18px rgba(31, 107, 255, 0.12);
  }

  .blackjack-player.winner {
    border-color: #ffd56a;
    background: linear-gradient(180deg, #fffdf3, #fff6d5);
  }

  .blackjack-player.busted {
    opacity: 0.72;
  }

  .blackjack-player__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .blackjack-player__top strong,
  .blackjack-player__top span {
    display: block;
  }

  .blackjack-player__top strong {
    color: #153260;
    font-size: 16px;
    line-height: 1.2;
    font-weight: 900;
  }

  .blackjack-player__top span {
    margin-top: 3px;
    color: #6b82ac;
    font-size: 12px;
    font-weight: 800;
  }

  .blackjack-player__top b {
    min-width: 48px;
    min-height: 34px;
    padding: 0 8px;
    border-radius: 999px;
    background: #eef6ff;
    color: #145bd8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 1000;
  }

  .blackjack-hand {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .blackjack-card {
    width: 48px;
    height: 68px;
    border-radius: 10px;
    border: 1px solid #d8e2f2;
    background: linear-gradient(180deg, #fff, #f4f8ff);
    color: #153260;
    display: grid;
    align-content: center;
    justify-items: center;
    box-shadow: 0 8px 14px rgba(16, 92, 180, 0.1);
  }

  .blackjack-card.red {
    color: #d73545;
  }

  .blackjack-card.hidden {
    color: #fff;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%) 0 0 / 10px 10px,
      linear-gradient(180deg, #2f6ff1, #173b9c);
    border-color: #1746bd;
  }

  .blackjack-card span {
    font-size: 19px;
    line-height: 1;
    font-weight: 1000;
  }

  .blackjack-card small {
    margin-top: 5px;
    font-size: 16px;
    line-height: 1;
    font-weight: 900;
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

    .quiz-head {
      grid-template-columns: 1fr;
    }

    .blackjack-table {
      grid-template-columns: 1fr;
    }

    .ready-player {
      grid-template-columns: 50px minmax(0, 1fr);
    }

    .ready-player-actions {
      grid-column: 1 / -1;
      justify-self: stretch;
      justify-content: flex-end;
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

  .move-btn,
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
    min-height: 100dvh;
    height: auto;
    max-height: none;
    padding: 0 10px calc(10px + env(safe-area-inset-bottom));
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
    min-height: calc(100dvh - 72px);
    height: auto;
    max-height: none;
    padding: 14px;
    border-radius: 28px;
    overflow: visible;
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
  .game-room.quiz-layout .point-pill,
  .game-room.board-layout .point-pill {
    justify-self: end;
    white-space: nowrap;
  }

  .game-room.rps-layout .mode-card.rps-mode {
    width: min(100%, 520px);
    flex: 1 1 auto;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 10px;
    min-height: var(--game-viewport-height);
    height: auto;
    max-height: none;
    padding: 14px;
    border-radius: 28px;
    overflow: visible;
  }

  .game-room.rps-layout .profile-row {
    margin: 0;
  }

  .game-room.rps-layout .side {
    min-height: 68px;
    padding: 9px 11px;
    gap: 10px;
    border-radius: 18px;
  }

  .game-room.rps-layout .side strong {
    font-size: 16px;
  }

  .game-room.rps-layout .side p {
    margin-top: 2px;
    font-size: 12px;
  }

  .game-room.rps-layout .avatar-circle {
    width: 48px;
    height: 48px;
    font-size: 22px;
  }

  .game-room.rps-layout .result-line {
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
  .game-room.rps-layout .dual-btns {
    margin-top: 0;
  }

  /* 限制 RPS 揭示阶段按钮不要撑满整个剩余空间 */
  .game-room.rps-layout .play-zone .next-round-btn {
    min-height: 48px;
    height: 48px;
    justify-self: center;
    width: 100%;
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

    .game-room.rps-layout .mode-card.rps-mode {
      gap: 8px;
      padding: 12px;
    }

    .game-room.rps-layout .side {
      min-height: 62px;
      padding: 8px 10px;
    }

    .game-room.rps-layout .move-btn {
      min-height: 74px;
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
      padding: 0 8px calc(8px + env(safe-area-inset-bottom));
    }

    .game-room.rps-layout,
    .game-room.board-layout {
      padding: 0 8px calc(8px + env(safe-area-inset-bottom));
    }

    .game-room.chess-layout {
      padding-bottom: calc(18px + env(safe-area-inset-bottom));
    }

    .game-room.quiz-layout .game-header,
    .game-room.rps-layout .game-header,
    .game-room.board-layout .game-header {
      grid-template-columns: 36px minmax(0, 1fr) auto;
      min-height: 32px;
      padding: 3px 6px;
      margin: 6px auto 8px;
    }

    .game-room.quiz-layout .game-header h1,
    .game-room.rps-layout .game-header h1,
    .game-room.board-layout .game-header h1 {
      font-size: 16px;
    }

    .game-room.quiz-layout .point-pill,
    .game-room.rps-layout .point-pill,
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
    .game-room.board-layout .coin-dot {
      width: 18px;
      height: 18px;
    }

    .game-room.quiz-layout .mode-card.quiz-mode {
      gap: 8px;
      min-height: calc(100dvh - 62px);
      height: auto;
      max-height: none;
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

    .game-room.rps-layout .mode-card.rps-mode {
      gap: 8px;
      min-height: calc(100dvh - 62px);
      height: auto;
      max-height: none;
      padding: 12px;
      border-radius: 24px;
    }

    .game-room.rps-layout .side {
      min-height: 60px;
      padding: 8px 10px;
      gap: 8px;
      border-radius: 16px;
    }

    .game-room.rps-layout .side strong {
      font-size: 15px;
    }

    .game-room.rps-layout .avatar-circle {
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

    .game-room.rps-layout .primary-btn,
    .game-room.rps-layout .secondary-btn {
      height: 42px;
      font-size: 15px;
    }
  }

  .game-room.ready-layout .game-header {
    grid-template-columns: 46px minmax(0, 1fr) 46px;
    min-height: 44px;
    padding: 4px 6px;
    margin: 8px auto 12px;
  }

  .game-room.ready-layout .game-header h1 {
    grid-column: 2;
    justify-self: center;
    text-align: center;
    font-size: 18px;
  }

  .game-room.ready-layout .point-pill {
    display: none;
  }

  @media (max-width: 760px) {
    .game-room.ready-layout {
      padding: 0 8px calc(108px + env(safe-area-inset-bottom));
    }

    .game-room.ready-layout .game-header {
      width: 100%;
      border-radius: 14px;
    }

    .game-room.ready-layout .ready-room {
      width: 100%;
      padding: 14px;
      border-radius: 28px;
    }

    .game-room.ready-layout .ready-head {
      align-items: flex-start;
    }

    .game-room.ready-layout .ready-head h2 {
      font-size: 28px;
      line-height: 1.12;
    }

    .game-room.ready-layout .rules-icon-btn {
      width: 52px;
      height: 52px;
      border-radius: 18px;
    }

    .game-room.ready-layout .ready-list {
      gap: 8px;
    }

    .game-room.ready-layout .ready-player {
      min-height: 120px;
      padding: 12px;
      grid-template-columns: 54px minmax(0, 1fr);
      gap: 10px 12px;
      align-items: center;
    }

    .game-room.ready-layout .ready-player .avatar-circle {
      width: 54px;
      height: 54px;
    }

    .game-room.ready-layout .ready-player strong {
      font-size: 18px;
      line-height: 1.15;
    }

    .game-room.ready-layout .ready-player p {
      font-size: 13px;
      line-height: 1.25;
    }

    .game-room.ready-layout .ready-player-actions {
      grid-column: 2;
      justify-self: end;
      align-self: end;
      flex-wrap: nowrap;
    }

    .game-room.ready-layout .ready-status {
      min-height: 32px;
      padding: 0 12px;
      font-size: 13px;
    }

    .game-room.ready-layout .ready-inline-action {
      min-width: 80px;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 14px;
      font-size: 14px;
    }

    .game-room.ready-layout .ready-actions {
      margin-top: 14px;
    }
  }

  @media (max-width: 360px) {
    .game-room.ready-layout .ready-player {
      grid-template-columns: 48px minmax(0, 1fr);
      padding: 10px;
    }

    .game-room.ready-layout .ready-player .avatar-circle {
      width: 48px;
      height: 48px;
    }

    .game-room.ready-layout .ready-player-actions {
      grid-column: 1 / -1;
      justify-self: stretch;
      justify-content: flex-end;
    }

    .game-room.quiz-layout .quiz-mode .quiz-options {
      grid-template-columns: 1fr;
    }

    .game-room.quiz-layout .quiz-mode .quiz-options button {
      min-height: 56px;
    }
  }
</style>