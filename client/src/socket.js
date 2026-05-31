// Socket.io 客户端 - 全局单例
import { io } from 'socket.io-client'
import { reactive } from 'vue'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

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
  playMode: localStorage.getItem('bus_game_play_mode') || 'normal',
  personalRank: [],
  busRank: [],
  stats: { totalPlayers: 0, onlinePlayers: 0, activeRooms: 0 },
  currentRoom: null,
  currentGame: null,
  broadcastMessage: null,
  invitations: []
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

socket.on('room:update', (data) => {
  if (!gameState.currentRoom || gameState.currentRoom.roomId === data.roomId || gameState.currentRoom.id === data.roomId) {
    gameState.currentRoom = data
    gameState.currentGame = data.gameState
  }
  window.dispatchEvent(new CustomEvent('room:update', { detail: data }))
})

socket.on('room:started', (data) => {
  gameState.currentRoom = data
  gameState.currentGame = data.gameState
  window.dispatchEvent(new CustomEvent('room:started', { detail: data }))
  window.dispatchEvent(new CustomEvent('game:state', { detail: { gameState: data.gameState, players: data.players, room: data } }))
})

socket.on('game:state', (data) => {
  gameState.currentGame = data.gameState
  if (data.room) {
    gameState.currentRoom = data.room
  }
  window.dispatchEvent(new CustomEvent('game:state', { detail: data }))
})

socket.on('game:result', (data) => {
  if (data.room) {
    gameState.currentRoom = data.room
    gameState.currentGame = data.room.gameState
  }
  // 更新当前玩家积分
  if (gameState.player && data.players) {
    const playerResult = data.players.find(p => p.id === gameState.player.id)
    if (playerResult) {
      gameState.player.points = playerResult.points
    }
  }
  window.dispatchEvent(new CustomEvent('game:result', { detail: data }))
})

socket.on('game:opponent_disconnected', (data) => {
  window.dispatchEvent(new CustomEvent('game:opponent_disconnected', { detail: data }))
})

socket.on('room:kicked', (data) => {
  gameState.currentRoom = null
  gameState.currentGame = null
  window.dispatchEvent(new CustomEvent('room:kicked', { detail: data }))
})

socket.on('room:left', (data) => {
  gameState.currentRoom = null
  gameState.currentGame = null
  window.dispatchEvent(new CustomEvent('room:left', { detail: data }))
})

socket.on('match:requeued', (data) => {
  gameState.currentRoom = null
  gameState.currentGame = null
  window.dispatchEvent(new CustomEvent('match:requeued', { detail: data }))
})

socket.on('room:abandoned', (data) => {
  window.dispatchEvent(new CustomEvent('room:abandoned', { detail: data }))
})

socket.on('room:invited', (data) => {
  const roomId = data?.room?.roomId || data?.room?.id
  gameState.invitations = [
    data,
    ...gameState.invitations.filter(item => (item?.room?.roomId || item?.room?.id) !== roomId)
  ].slice(0, 3)
  window.dispatchEvent(new CustomEvent('room:invited', { detail: data }))
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

export function getPlayMode() {
  return gameState.playMode
}

export function setPlayMode(mode) {
  gameState.playMode = mode
  localStorage.setItem('bus_game_play_mode', mode)
}
