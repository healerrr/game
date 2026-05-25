<template>
  <div class="uc-game">
    <!-- 身份和词语显示 -->
    <div class="uc-header">
      <div class="uc-my-identity">
        <span class="uc-label">你的身份：</span>
        <span class="uc-identity-tag" :class="myIdentity">
          {{ identityLabel }}
        </span>
      </div>
      <div class="uc-my-word" v-if="gs.words?.[player?.id]">
        <span class="uc-label">你的词语：</span>
        <span class="uc-word" :class="{ blank: gs.words[player.id] === '???' }">
          {{ gs.words[player.id] }}
        </span>
      </div>
    </div>

    <!-- 描述阶段 -->
    <div v-if="gs.phase === 'describe'" class="uc-phase">
      <div class="uc-round">第 {{ gs.round }} 轮 · 描述环节</div>

      <!-- 过往描述 -->
      <div class="uc-desc-list" v-if="gs.descriptions?.length">
        <div v-for="(d, i) in gs.descriptions" :key="i" class="uc-desc-item">
          <span class="uc-desc-author" :class="{ eliminated: gs.eliminatedPlayers?.includes(d.playerId) }">
            {{ getPlayerName(d.playerId) }}
          </span>
          <span class="uc-desc-text">"{{ d.text }}"</span>
        </div>
      </div>

      <!-- 当前发言 -->
      <div class="uc-current" v-if="gs.currentDescriber === player?.id">
        <p class="uc-prompt">轮到你了！用一句话描述你的词语（不要直接说出词语本身）</p>
        <div class="uc-input-area">
          <textarea
            ref="descInput"
            v-model="description"
            class="uc-textarea"
            placeholder="输入你的描述..."
            maxlength="50"
            rows="2"
          ></textarea>
        </div>
        <div class="uc-submit-row">
          <button class="uc-voice-btn" @mousedown="startVoice" @mouseup="stopVoice" @touchstart.prevent="startVoice" @touchend.prevent="stopVoice">
            🎤 按住说话
          </button>
          <button class="uc-send-btn" @click="sendDesc" :disabled="!description.trim()">
            发送
          </button>
        </div>
      </div>
      <div v-else class="uc-current">
        <p class="uc-prompt">等待 {{ getPlayerName(gs.currentDescriber) }} 描述...</p>
      </div>
    </div>

    <!-- 投票阶段 -->
    <div v-else-if="gs.phase === 'vote'" class="uc-phase">
      <div class="uc-round">第 {{ gs.round }} 轮 · 投票环节</div>
      <p class="uc-prompt">选出你认为最有嫌疑的人：</p>

      <div class="uc-vote-grid">
        <div
          v-for="pid in activePlayers"
          :key="pid"
          class="uc-vote-card"
          :class="{ selected: myVote === pid }"
          @click="castVote(pid)"
        >
          <span class="uc-vote-name">{{ getPlayerName(pid) }}</span>
          <span class="uc-vote-bus">{{ getPlayerBus(pid) }}号车</span>
          <span v-if="myVote === pid" class="uc-check">✓</span>
        </div>
      </div>
    </div>

    <!-- 揭示 -->
    <div v-else-if="gs.phase === 'reveal'" class="uc-phase">
      <div class="uc-reveal" v-if="gs.lastEliminated">
        <div class="uc-eliminated-name">{{ getPlayerName(gs.lastEliminated.playerId) }}</div>
        <div class="uc-eliminated-identity" :class="gs.lastEliminated.identity">
          身份：{{ identityName(gs.lastEliminated.identity) }}
        </div>
      </div>
      <button class="uc-next-btn" @click="ucNextRound">继续 →</button>
    </div>

    <!-- 结束 -->
    <div v-else-if="gs.phase === 'finished'" class="uc-phase">
      <div class="uc-finish-banner" :class="{ 'civilian-win': gs.winner === 'civilian', 'undercover-win': gs.winner === 'undercover' }">
        {{ gs.winner === 'civilian' ? '🎉 平民获胜！卧底被全部找出' : '😈 卧底获胜！成功潜伏' }}
      </div>
      <div class="uc-all-identities">
        <div v-for="(pid, i) in gs.players" :key="pid" class="uc-reveal-row">
          <span class="uc-reveal-name">{{ getPlayerName(pid) }}</span>
          <span class="uc-reveal-identity" :class="gs.identities[i]">
            {{ identityName(gs.identities[i]) }}
          </span>
          <span class="uc-reveal-word">{{ gs.words[pid] }}</span>
        </div>
      </div>
      <div class="actions" style="margin-top: 20px">
        <button class="action-btn primary" @click="rematch">再来一局</button>
        <button class="action-btn secondary" @click="backToLobby">返回大厅</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { socket } from '../socket'

const props = defineProps({
  gs: Object,
  player: Object,
  roomPlayers: Array
})

const emit = defineEmits(['back', 'rematch'])
const description = ref('')
const myVote = ref(null)
const descInput = ref(null)
let recognition = null

const myIdentity = computed(() => {
  if (!props.player || !props.gs.players) return ''
  const idx = props.gs.players.indexOf(props.player.id)
  return props.gs.identities?.[idx] || ''
})

const identityLabel = computed(() => identityName(myIdentity.value))

const activePlayers = computed(() => {
  return (props.gs.players || []).filter(p => !props.gs.eliminatedPlayers?.includes(p))
})

function identityName(id) {
  const map = { civilian: '平民', undercover: '卧底', blank: '白板' }
  return map[id] || '未知'
}

function getPlayerName(pid) {
  const p = props.roomPlayers?.find(x => x.id === pid)
  return p?.nickname || '未知'
}

function getPlayerBus(pid) {
  const p = props.roomPlayers?.find(x => x.id === pid)
  return p?.busNumber || '?'
}

function sendDesc() {
  if (!description.value.trim()) return
  socket.emit('game:action', { action: { type: 'describe', text: description.value.trim() } })
  description.value = ''
}

function castVote(targetId) {
  myVote.value = targetId
  socket.emit('game:action', { action: { type: 'vote', targetId } })
}

function ucNextRound() {
  myVote.value = null
  socket.emit('game:action', { action: { type: 'next_round' } })
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return

  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript
    description.value = text
  }

  recognition.onerror = () => {}
  recognition.start()
}

function stopVoice() {
  if (recognition) {
    recognition.stop()
    recognition = null
  }
}

function rematch() {
  emit('rematch')
}

function backToLobby() {
  emit('back')
}

// 清除状态
watch(() => props.gs?.phase, (phase) => {
  if (phase === 'vote') myVote.value = null
  if (phase === 'describe') description.value = ''
})
</script>

<style scoped>
.uc-game {
  width: min(100%, 520px);
  height: var(--game-viewport-height, calc(100dvh - 60px));
  max-height: var(--game-viewport-height, calc(100dvh - 60px));
  margin: 0 auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow-y: auto;
}

.uc-header {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 8px;
}

.uc-label {
  font-size: 13px;
  color: var(--text-muted);
}

.uc-identity-tag {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.uc-identity-tag.civilian { background: rgba(46,213,115,0.2); color: var(--success); }
.uc-identity-tag.undercover { background: rgba(255,71,87,0.2); color: var(--danger); }
.uc-identity-tag.blank { background: rgba(255,165,2,0.2); color: var(--warning); }

.uc-word {
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--gold-light);
}

.uc-word.blank {
  color: var(--warning);
}

.uc-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.uc-round {
  font-size: var(--font-md);
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 12px;
}

.uc-desc-list {
  width: 100%;
  max-width: 360px;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.uc-desc-item {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}

.uc-desc-author {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
}

.uc-desc-author.eliminated {
  opacity: 0.4;
  text-decoration: line-through;
}

.uc-desc-text {
  font-size: 14px;
  color: var(--text-primary);
}

.uc-current {
  text-align: center;
  width: 100%;
  max-width: 360px;
  margin-top: 12px;
}

.uc-prompt {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.uc-textarea {
  width: 100%;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-md);
  resize: none;
  outline: none;
}

.uc-textarea:focus {
  border-color: var(--accent);
}

.uc-submit-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.uc-voice-btn {
  flex: 1;
  padding: 12px;
  background: rgba(233,69,96,0.15);
  color: var(--accent);
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  font-weight: 600;
}

.uc-send-btn {
  padding: 12px 28px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  font-weight: 600;
}

.uc-send-btn:disabled {
  background: #555;
  color: #999;
}

.uc-vote-grid {
  width: 100%;
  max-width: 360px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.uc-vote-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 16px 12px;
  text-align: center;
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
}

.uc-vote-card.selected {
  border-color: var(--accent);
  background: var(--bg-card-hover);
}

.uc-vote-name {
  display: block;
  font-size: var(--font-md);
  color: var(--text-primary);
  font-weight: 600;
}

.uc-vote-bus {
  font-size: 12px;
  color: var(--text-muted);
}

.uc-check {
  position: absolute;
  top: 6px;
  right: 8px;
  color: var(--accent);
  font-size: 18px;
  font-weight: 700;
}

.uc-reveal {
  text-align: center;
  margin-top: 20px;
}

.uc-eliminated-name {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.uc-eliminated-identity {
  font-size: var(--font-lg);
  font-weight: 600;
}

.uc-eliminated-identity.civilian { color: var(--success); }
.uc-eliminated-identity.undercover { color: var(--danger); }
.uc-eliminated-identity.blank { color: var(--warning); }

.uc-next-btn {
  margin-top: 24px;
  padding: 12px 40px;
  background: var(--accent);
  color: #fff;
  font-size: var(--font-md);
  font-weight: 600;
  border-radius: var(--radius-md);
}

.uc-finish-banner {
  font-size: var(--font-xl);
  font-weight: 700;
  padding: 16px 24px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  text-align: center;
}

.uc-finish-banner.civilian-win { background: rgba(46,213,115,0.2); color: var(--success); }
.uc-finish-banner.undercover-win { background: rgba(255,71,87,0.2); color: var(--danger); }

.uc-all-identities {
  width: 100%;
  max-width: 360px;
}

.uc-reveal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}

.uc-reveal-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  min-width: 60px;
}

.uc-reveal-identity {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
}

.uc-reveal-identity.civilian { background: rgba(46,213,115,0.15); color: var(--success); }
.uc-reveal-identity.undercover { background: rgba(255,71,87,0.15); color: var(--danger); }
.uc-reveal-identity.blank { background: rgba(255,165,2,0.15); color: var(--warning); }

.uc-reveal-word {
  font-size: 14px;
  color: var(--gold-light);
  font-weight: 600;
  margin-left: auto;
}

@media (max-width: 760px), (max-height: 820px) {
  .uc-game {
    padding: 10px;
  }

  .uc-header {
    padding: 12px;
    margin-bottom: 10px;
  }

  .uc-round {
    margin-bottom: 10px;
  }

  .uc-desc-list {
    margin-bottom: 12px;
    max-height: 160px;
  }

  .uc-current {
    margin-top: 8px;
  }

  .uc-submit-row {
    margin-top: 10px;
  }

  .uc-voice-btn,
  .uc-send-btn,
  .uc-next-btn {
    min-height: 42px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .uc-finish-banner {
    font-size: 18px;
    padding: 14px 16px;
  }
}
</style>
