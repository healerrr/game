<template>
  <div class="chess-phaser-wrapper">
    <div ref="gameContainer" class="game-container"></div>
    <div class="action-buttons" v-if="gamePhase === 'playing'">
      <button class="btn surrender" @click="$emit('forfeit')">
        <span class="btn-icon">认</span>
        <span>认输</span>
      </button>
      <button class="btn back" @click="$emit('back')">
        <span class="btn-icon">返</span>
        <span>返回大厅</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Phaser from 'phaser'
import { ChessScene } from './ChessScene'

const props = defineProps({
  gs: { type: Object, default: () => ({}) },
  player: { type: Object, default: () => ({}) },
  roomPlayers: { type: Array, default: () => [] }
})

const emit = defineEmits(['action', 'back', 'forfeit'])

const gameContainer = ref(null)
let phaserGame = null
let chessScene = null

const gamePhase = computed(() => props.gs?.phase || 'waiting')

onMounted(() => {
  const config = {
    type: Phaser.AUTO,
    parent: gameContainer.value,
    width: 800,
    height: 600,
    backgroundColor: '#0d1222',
    scene: ChessScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  }

  phaserGame = new Phaser.Game(config)
  
  phaserGame.events.on('ready', () => {
    chessScene = phaserGame.scene.getScene('ChessScene')
    
    chessScene.init({
      gs: props.gs,
      player: props.player,
      roomPlayers: props.roomPlayers,
      onAction: (action) => {
        emit('action', action)
      }
    })
  })
})

onUnmounted(() => {
  if (phaserGame) {
    phaserGame.destroy(true)
    phaserGame = null
  }
})

defineExpose({
  updateState: (newState) => {
    if (chessScene) {
      chessScene.updateFromServer(newState)
    }
  }
})
</script>

<style scoped>
.chess-phaser-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  background: linear-gradient(135deg, #0d1222 0%, #1a1a2e 50%, #16213e 100%);
  padding: 20px;
}

.game-container {
  width: 100%;
  max-width: 800px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.action-buttons {
  display: flex;
  gap: 16px;
  margin-top: 20px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-icon {
  font-size: 18px;
}

.btn.surrender {
  background: linear-gradient(135deg, #ff6f61, #de3d37);
  color: #fff;
  box-shadow: 0 4px 15px rgba(222, 61, 55, 0.34);
}

.btn.back {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.btn:active {
  transform: translateY(0);
}
</style>
