// Socket.io 客户端 - 全局单例
import { io } from 'socket.io-client'
import { reactive } from 'vue'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3457')

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
})

// 全局游戏状态
export const gameState = reactive({
  player: null,
  personalRank: [],
  busRank: [],
  stats: { totalPlayers: 0, onlinePlayers: 0, activeRooms: 0 },
  currentRoom: null,
  currentGame: null,
  broadcastMessage: null
})

// 监听服务器推送
socket.on('server:update', (data) => {
  gameState.personalRank = data.personal || []
  gameState.busRank = data.bus || []
  gameState.stats = data.stats || {}
})

socket.on('game:matched', (data) => {
  gameState.currentRoom = data
  gameState.currentGame = data.gameState
  // 加入服务器端的房间
  socket.emit('room:join', { roomId: data.roomId })
  window.dispatchEvent(new CustomEvent('game:matched', { detail: data }))
})

socket.on('game:state', (data) => {
  gameState.currentGame = data.gameState
  window.dispatchEvent(new CustomEvent('game:state', { detail: data }))
})

socket.on('game:result', (data) => {
  window.dispatchEvent(new CustomEvent('game:result', { detail: data }))
})

socket.on('game:opponent_disconnected', (data) => {
  window.dispatchEvent(new CustomEvent('game:opponent_disconnected', { detail: data }))
})

// 全服广播
socket.on('admin:broadcast', (data) => {
  gameState.broadcastMessage = data
  setTimeout(() => { gameState.broadcastMessage = null }, 8000)
  window.dispatchEvent(new CustomEvent('admin:broadcast', { detail: data }))
})

// 管理员发积分
socket.on('admin:points_given', (data) => {
  if (gameState.player) {
    gameState.player.points = data.newPoints
  }
  window.dispatchEvent(new CustomEvent('admin:points_given', { detail: data }))
})

// 辅助方法
export function getPlayer() {
  return gameState.player
}

export function setPlayer(player) {
  gameState.player = player
}
