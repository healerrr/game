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
  personalRank: [],
  busRank: [],
  stats: { totalPlayers: 0, onlinePlayers: 0, activeRooms: 0 },
  currentRoom: null,
  currentGame: null,
  broadcastMessage: null,
  invitations: []
})

/** 安全设置 currentGame：只有游戏进行中或已结束的 gameState 才设置，
 * 确保不会把旧数据残留到新房间中 */
export function setCurrentGame(gameStateValue, roomStatus) {
  if (!gameStateValue) {
    gameState.currentGame = null
    return
  }
  // 如果房间是 readying 或没有 gameState.phase，清空
  if (roomStatus === 'readying' || !gameStateValue.phase) {
    gameState.currentGame = null
    return
  }
  gameState.currentGame = gameStateValue
}

let authenticatedPlayerId = null
let authenticatedSocketId = null
let restorePromise = null

export function readSavedPlayer() {
  const saved = localStorage.getItem('bus_game_player')
  if (!saved) return null

  try {
    const player = JSON.parse(saved)
    return player?.id ? player : null
  } catch {
    localStorage.removeItem('bus_game_player')
    return null
  }
}

export function rememberPlayer(player) {
  if (!player?.id) return

  setPlayer(player)
  authenticatedPlayerId = player.id
  authenticatedSocketId = socket.id || authenticatedSocketId
  localStorage.setItem(
    'bus_game_player',
    JSON.stringify({
      id: player.id,
      nickname: player.nickname,
      busNumber: player.busNumber
    })
  )
}

export function clearSavedPlayer() {
  authenticatedPlayerId = null
  authenticatedSocketId = null
  gameState.player = null
  localStorage.removeItem('bus_game_player')
}

export function ensureSocketConnected() {
  if (socket.connected) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('当前无法连接到游戏服务，请确认后端已启动'))
    }, 4000)

    function handleConnect() {
      cleanup()
      resolve()
    }

    function handleError() {
      cleanup()
      reject(new Error('当前无法连接到游戏服务，请确认后端已启动'))
    }

    function cleanup() {
      window.clearTimeout(timeoutId)
      socket.off('connect', handleConnect)
      socket.off('connect_error', handleError)
    }

    socket.once('connect', handleConnect)
    socket.once('connect_error', handleError)
    socket.connect()
  })
}

export async function restoreSavedPlayer({ force = false } = {}) {
  const savedPlayer = readSavedPlayer()
  if (!savedPlayer) return null

  if (
    !force &&
    gameState.player?.id === savedPlayer.id &&
    authenticatedPlayerId === savedPlayer.id &&
    authenticatedSocketId === socket.id
  ) {
    return { player: gameState.player, currentRoom: gameState.currentRoom }
  }

  if (restorePromise) return restorePromise

  restorePromise = ensureSocketConnected()
    .then(() => new Promise((resolve) => {
      socket.emit('player:reconnect', { playerId: savedPlayer.id }, (res) => {
        if (res?.player) {
          rememberPlayer(res.player)
          if (res.currentRoom) {
            gameState.currentRoom = res.currentRoom
            setCurrentGame(res.currentRoom.gameState, res.currentRoom.status)
          }
          resolve(res)
          return
        }

        if (res?.error) {
          clearSavedPlayer()
        }
        resolve(null)
      })
    }))
    .catch(() => null)
    .finally(() => {
      restorePromise = null
    })

  return restorePromise
}

export async function ensureAuthenticated() {
  if (
    gameState.player?.id &&
    authenticatedPlayerId === gameState.player.id &&
    authenticatedSocketId === socket.id &&
    socket.connected
  ) {
    return gameState.player
  }

  // 如果 socket 已连接但身份丢失，最多重试 3 次
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
    const restored = await restoreSavedPlayer({ force: true }).catch(e => {
      lastError = e
      return null
    })
    if (restored?.player) return restored.player
  }

  // 从本地存储直接恢复，不做服务端验证
  const savedPlayer = readSavedPlayer()
  if (savedPlayer && socket.connected) {
    // 最后一次尝试：直接重新注册
    try {
      const result = await new Promise((resolve) => {
        socket.emit('player:register', {
          nickname: savedPlayer.nickname,
          busNumber: savedPlayer.busNumber
        }, (res) => {
          if (res?.player) {
            rememberPlayer(res.player)
            if (res.currentRoom) {
              gameState.currentRoom = res.currentRoom
              setCurrentGame(res.currentRoom.gameState, res.currentRoom.status)
            }
            resolve(res.player)
          } else {
            resolve(null)
          }
        })
      })
      if (result) return result
    } catch (_) {}
  }

  return null
}

socket.on('connect', () => {
  authenticatedSocketId = null
  // 延迟一点再恢复，给 socket.io 内部初始化完成的时间
  setTimeout(() => {
    restoreSavedPlayer({ force: true }).catch(() => {})
  }, 300)
})

// 监听服务器推送
socket.on('server:update', (data) => {
  gameState.personalRank = data.personal || []
  gameState.busRank = data.bus || []
  gameState.stats = data.stats || {}
})

socket.on('game:matched', (data) => {
  gameState.currentRoom = data
  setCurrentGame(data.gameState, data.status)
  // 加入服务器端的房间
  socket.emit('room:join', { roomId: data.roomId })
  window.dispatchEvent(new CustomEvent('game:matched', { detail: data }))
})

socket.on('room:update', (data) => {
  if (!gameState.currentRoom || gameState.currentRoom.roomId === data.roomId || gameState.currentRoom.id === data.roomId) {
    gameState.currentRoom = data
    setCurrentGame(data.gameState, data.status)
  }
  window.dispatchEvent(new CustomEvent('room:update', { detail: data }))
})

socket.on('room:started', (data) => {
  gameState.currentRoom = data
  setCurrentGame(data.gameState, data.status)
  window.dispatchEvent(new CustomEvent('room:started', { detail: data }))
  window.dispatchEvent(new CustomEvent('game:state', { detail: { gameState: data.gameState, players: data.players, room: data } }))
})

socket.on('game:state', (data) => {
  setCurrentGame(data.gameState, data.status)
  if (data.room) {
    gameState.currentRoom = data.room
  }
  window.dispatchEvent(new CustomEvent('game:state', { detail: data }))
})

socket.on('game:result', (data) => {
  if (data.room) {
    gameState.currentRoom = data.room
    setCurrentGame(data.room.gameState, data.room.status)
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

socket.on('game:forfeit_notice', (data) => {
  window.dispatchEvent(new CustomEvent('game:forfeit_notice', { detail: data }))
})

socket.on('game:draw_offer', (data) => {
  window.dispatchEvent(new CustomEvent('game:draw_offer', { detail: data }))
})

socket.on('game:draw_declined', (data) => {
  window.dispatchEvent(new CustomEvent('game:draw_declined', { detail: data }))
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
