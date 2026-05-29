// 团建大巴游戏平台 - 主服务器
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const store = require('./store');
const redisStore = require('./persistence/redis');
const { getEngine, getGameConfig, getAllGameConfigs } = require('./game-engine');
const { tryMatch } = require('./matchmaker');
const { BotManager, BotPlayer, BotStrategy } = require('./bots');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 5000,
  pingTimeout: 15000
});

app.use(cors());
app.use(express.json());

// 生产环境：提供前端静态文件
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// ========== HTTP API ==========

// 获取所有游戏配置
app.get('/api/games', (req, res) => {
  res.json({ games: getAllGameConfigs() });
});

// 获取排行榜
app.get('/api/leaderboard', (req, res) => {
  res.json({
    personal: store.getPersonalLeaderboard(),
    bus: store.getBusLeaderboard(),
    stats: store.getStats()
  });
});

app.get('/api/players/:playerId/results', async (req, res) => {
  try {
    const { playerId } = req.params;
    const player = store.getPlayer(playerId);

    if (!player || player.isBot) {
      return res.status(404).json({ error: '玩家不存在' });
    }

    const limit = Number(req.query.limit || 30);
    const records = await store.getPlayerGameRecords(playerId, limit);
    res.json({ records });
  } catch (error) {
    console.error('[api:player-results]', error);
    res.status(500).json({ error: '加载战绩失败' });
  }
});

// 管理员API
app.get('/api/admin/players', (req, res) => {
  const players = Array.from(store.players.values()).filter(p => !p.isBot).map(p => ({
    id: p.id, nickname: p.nickname, busNumber: p.busNumber,
    points: p.points, online: p.online, totalGames: p.totalGames, wins: p.wins
  }));
  res.json({ players, stats: store.getStats() });
});

app.post('/api/admin/broadcast', express.json(), (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '消息不能为空' });
  io.emit('admin:broadcast', { message, time: Date.now() });
  res.json({ success: true });
});

app.post('/api/admin/give-points', express.json(), (req, res) => {
  const { playerId, amount, reason } = req.body;
  const player = store.getPlayer(playerId);
  if (!player) return res.status(404).json({ error: '玩家不存在' });
  store.updatePoints(playerId, amount, 'admin_adjustment', { reason });
  io.to(`player:${playerId}`).emit('admin:points_given', { amount, reason, newPoints: player.points });
  broadcastUpdate();
  res.json({ success: true, player: { id: player.id, points: player.points } });
});

// ========== 机器人管理 API ==========
const botManager = new BotManager(io);

function readPositiveIntEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const READY_TIMEOUT_MS = readPositiveIntEnv('READY_TIMEOUT_MS', 20000);
const DISCONNECT_GRACE_MS = readPositiveIntEnv('DISCONNECT_GRACE_MS', 45000);
const ACTION_TIMEOUT_FALLBACK_MS = readPositiveIntEnv('ACTION_TIMEOUT_FALLBACK_MS', 30000);

app.post('/api/bots/start', express.json(), (req, res) => {
  const { gameType } = req.body;
  if (!gameType) return res.status(400).json({ error: '游戏类型不能为空' });
  const result = botManager.start(store, gameType);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/bots/stop', express.json(), (req, res) => {
  const { gameType } = req.body;
  if (!gameType) return res.status(400).json({ error: '游戏类型不能为空' });
  const result = botManager.stop(gameType);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/bots/list', (req, res) => {
  res.json({ rooms: botManager.getActiveRooms() });
});

// 获取活跃房间列表（含机器人房间）
app.get('/api/rooms/active', (req, res) => {
  const rooms = [];
  // 普通房间
  for (const [id, room] of store.rooms) {
    rooms.push({
      id: room.id,
      gameType: room.gameType,
      gameName: getGameConfig(room.gameType)?.name || room.gameType,
      players: room.players.map(pid => {
        const p = store.getPlayer(pid);
        return p ? { id: p.id, nickname: p.nickname, busNumber: p.busNumber, isBot: p.isBot } : null;
      }).filter(Boolean),
      status: room.status,
      phase: room.gameState?.phase
    });
  }
  res.json({ rooms });
});

// SPA fallback
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ========== Socket.io 事件 ==========

io.on('connection', (socket) => {
  console.log(`🔌 新连接: ${socket.id}`);

  let currentPlayer = null;

  // 注册/登录玩家
  socket.on('player:register', ({ nickname, busNumber }, callback) => {
    if (!nickname || !busNumber) {
      return callback({ error: '昵称和大巴号不能为空' });
    }
    const player = store.createPlayer(nickname, busNumber);
    player.online = true;
    player.socketId = socket.id;
    player.lastSeenAt = Date.now();
    store.savePlayer(player);
    currentPlayer = player;
    socket.playerId = player.id;

    // 加入个人房间（用于定向推送）
    socket.join(`player:${player.id}`);
    // 加入大巴房间（用于大巴广播）
    socket.join(`bus:${player.busNumber}`);
    emitPendingRoomInvites(player.id);

    callback({ player });
    broadcastUpdate();
  });

  // 重新连接（通过playerId恢复）
  socket.on('player:reconnect', ({ playerId }, callback) => {
    const player = store.getPlayer(playerId);
    if (!player) {
      return callback({ error: '玩家不存在，请重新注册' });
    }
    player.online = true;
    player.socketId = socket.id;
    player.lastSeenAt = Date.now();
    store.savePlayer(player);
    currentPlayer = player;
    socket.playerId = player.id;
    socket.join(`player:${player.id}`);
    socket.join(`bus:${player.busNumber}`);

    const room = store.getPlayerRoom(player.id);
    const currentRoom = room && room.status !== 'finished' ? serializeRoom(room) : null;
    if (currentRoom) {
      markSeatConnection(room, player.id, 'online', { intent: 'active', disconnectedAt: null });
      store.saveRoom(room);
      socket.join(`room:${room.id}`);
      emitRoomUpdate(room);
    }

    emitPendingRoomInvites(player.id);
    callback({ player, currentRoom });
    broadcastUpdate();
  });

  // 开始匹配
  socket.on('match:join', ({ gameType }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });

    const config = getGameConfig(gameType);
    if (!config) return callback({ error: '游戏不存在' });

    const blockingRoom = getBlockingRoom(currentPlayer.id);
    if (blockingRoom) {
      return callback({
        error: blockingRoom.status === 'playing'
          ? '你仍在未结束对局中，暂时不能加入其他游戏'
          : '你已在房间中',
        currentRoom: serializeRoom(blockingRoom)
      });
    }

    store.enqueue(currentPlayer.id, gameType);
    const queueSize = store.getQueue(gameType).length;
    callback({ success: true, queueSize });
  });

  // 加入游戏房间
  socket.on('room:join', ({ roomId }, callback) => {
    if (!currentPlayer) {
      if (typeof callback === 'function') callback({ error: '请先注册' });
      return;
    }
    socket.join(`room:${roomId}`);
    if (typeof callback === 'function') callback({ success: true });
  });

  socket.on('room:create', ({ gameType }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });

    const config = getGameConfig(gameType);
    if (!config) return callback({ error: '游戏不存在' });

    const blockingRoom = getBlockingRoom(currentPlayer.id);
    if (blockingRoom) {
      return callback({ error: '你仍在未结束房间中，暂时不能创建新房间', currentRoom: serializeRoom(blockingRoom) });
    }

    store.dequeue(currentPlayer.id);
    const room = store.createRoom(gameType, [currentPlayer], {
      mode: 'normal',
      visibility: 'private',
      ownerId: currentPlayer.id
    });
    socket.join(`room:${room.id}`);
    callback({ success: true, room: serializeRoom(room) });
    broadcastUpdate();
  });

  socket.on('room:ready', ({ ready = true }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });

    const room = store.getPlayerRoom(currentPlayer.id);
    if (!room) return callback({ error: '你不在房间中' });
    if (room.status !== 'readying') return callback({ error: '当前房间不能准备' });

    room.ready = room.ready || {};
    room.seatStates = room.seatStates || {};
    room.ready[currentPlayer.id] = Boolean(ready);
    room.seatStates[currentPlayer.id] = {
      ...(room.seatStates[currentPlayer.id] || {}),
      ready: Boolean(ready),
      connection: 'online',
      intent: 'active'
    };
    room.updatedAt = Date.now();
    ensureReadyDeadline(room);
    store.saveRoom(room);
    emitRoomUpdate(room);
    maybeStartReadyRoom(room);
    callback({ success: true, room: serializeRoom(room) });
  });

  socket.on('room:leave_current', ({ confirmForfeit = false } = {}, callback) => {
    if (!currentPlayer) return callback?.({ error: '请先注册' });
    const room = store.getPlayerRoom(currentPlayer.id);
    if (!room) return callback?.({ success: true });

    const result = handlePlayerLeaveRoom(room, currentPlayer.id, {
      confirmForfeit,
      reason: 'leave_lobby'
    });
    callback?.(result);
  });

  socket.on('game:forfeit', (payload = {}, callback) => {
    if (!currentPlayer) return callback?.({ error: '请先注册' });
    const room = store.getPlayerRoom(currentPlayer.id);
    if (!room) return callback?.({ error: '你不在对局中' });
    if (room.status !== 'playing') return callback?.({ error: '当前对局尚未开始' });

    forfeitPlayer(room, currentPlayer.id, payload.reason || 'forfeit');
    callback?.({ success: true });
  });

  socket.on('players:list', (payload, callback) => {
    if (typeof payload === 'function') {
      callback = payload;
      payload = {};
    }
    if (!currentPlayer) return callback({ error: '请先注册' });
    const room = payload?.roomId ? store.getRoom(payload.roomId) : null;
    const players = Array.from(store.players.values())
      .filter(p => !p.isBot && p.id !== currentPlayer.id)
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        busNumber: p.busNumber,
        online: Boolean(p.online),
        busy: Boolean(getBlockingRoom(p.id)),
        invited: Boolean(room?.invites?.includes(p.id))
      }));
    callback({ players });
  });

  socket.on('room:invite', ({ roomId, playerId }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });
    const room = store.getRoom(roomId);
    if (!room) return callback({ error: '房间不存在' });
    if (room.ownerId !== currentPlayer.id) return callback({ error: '只有房主可以邀请玩家' });
    if (room.status !== 'readying') return callback({ error: '房间已开始' });

    const target = store.getPlayer(playerId);
    if (!target || target.isBot) return callback({ error: '玩家不存在' });
    if (getBlockingRoom(target.id)) return callback({ error: '对方正在其他房间中' });

    const config = getGameConfig(room.gameType);
    if (room.players.length >= config.maxPlayers) return callback({ error: '房间已满' });

    room.invites = room.invites || [];
    if (!room.invites.includes(target.id)) room.invites.push(target.id);
    room.updatedAt = Date.now();
    store.saveRoom(room);

    if (target.online) {
      emitRoomInvite(target.id, room, currentPlayer);
    }
    callback({ success: true, pending: !target.online });
  });

  socket.on('room:invite:accept', ({ roomId }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });
    const room = store.getRoom(roomId);
    if (!room) return callback({ error: '房间不存在' });
    if (room.status !== 'readying') return callback({ error: '房间已开始' });
    if (!room.invites?.includes(currentPlayer.id)) return callback({ error: '邀请已失效' });
    if (getBlockingRoom(currentPlayer.id)) return callback({ error: '你仍在未结束房间中' });

    const config = getGameConfig(room.gameType);
    if (room.players.length >= config.maxPlayers) return callback({ error: '房间已满' });

    store.addPlayerToRoom(room.id, currentPlayer);
    const updatedRoom = store.getRoom(room.id);
    updatedRoom.invites = (updatedRoom.invites || []).filter(pid => pid !== currentPlayer.id);
    ensureReadyDeadline(updatedRoom);
    store.saveRoom(updatedRoom);
    socket.join(`room:${updatedRoom.id}`);

    const payload = serializeRoom(updatedRoom);
    io.to(`player:${currentPlayer.id}`).emit('game:matched', payload);
    emitRoomUpdate(updatedRoom);
    callback({ success: true, room: payload });
  });

  // 观战：加入房间并标记为观战者
  socket.on('spectator:join', ({ roomId }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });
    const room = store.getRoom(roomId);
    if (!room) return callback({ error: '房间不存在' });

    socket.join(`room:${roomId}`);
    store.addSpectator(roomId, currentPlayer.id);

    // 发送当前房间状态给观战者
    callback({
      success: true,
      roomId: room.id,
      gameType: room.gameType,
      gameName: getGameConfig(room.gameType)?.name || room.gameType,
      players: room.players.map(pid => {
        const p = store.getPlayer(pid);
        return p ? { id: p.id, nickname: p.nickname, busNumber: p.busNumber, isBot: p.isBot } : null;
      }).filter(Boolean),
      gameState: room.gameState
    });
  });

  // 退出观战
  socket.on('spectator:leave', ({ roomId }, callback) => {
    if (!currentPlayer) {
      if (typeof callback === 'function') callback({ error: '请先注册' });
      return;
    }
    store.removeSpectator(roomId, currentPlayer.id);
    socket.leave(`room:${roomId}`);
    if (typeof callback === 'function') callback({ success: true });
  });

  // 获取活跃房间列表（用于观战选择）
  socket.on('rooms:list', (callback) => {
    const rooms = [];
    for (const [id, room] of store.rooms) {
      rooms.push({
        id: room.id,
        gameType: room.gameType,
        gameName: getGameConfig(room.gameType)?.name || room.gameType,
        players: room.players.map(pid => {
          const p = store.getPlayer(pid);
          return p ? { id: p.id, nickname: p.nickname, busNumber: p.busNumber, isBot: p.isBot } : null;
        }).filter(Boolean),
        status: room.status,
        phase: room.gameState?.phase
      });
    }
    callback({ rooms });
  });

  // 取消匹配
  socket.on('match:cancel', ({ gameType }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });
    store.dequeue(currentPlayer.id);
    callback({ success: true });
  });

  // 游戏操作
  socket.on('game:action', async ({ action }) => {
    if (!currentPlayer) return;

    let room = store.getPlayerRoom(currentPlayer.id);
    if (!room) return;

    const lock = await store.acquireLock(`room:${room.id}`, 3000);
    if (!lock) return;

    try {
      room = store.getPlayerRoom(currentPlayer.id) || room;

    const engine = getEngine(room.gameType);
    if (!engine) return;
    if (room.status !== 'playing') return;

    markSeatConnection(room, currentPlayer.id, 'online', { intent: 'active' });

    // 处理 'next_round' 操作
    if (action.type === 'next_round') {
      if (engine.nextRound) {
        room.gameState = engine.nextRound(room.gameState);
      }
    } else if (room.status === 'playing') {
      room.gameState = engine.update(room.gameState, action, currentPlayer.id);
    }
    skipUnavailableTurns(room);
    store.saveRoom(room);

    // 广播游戏状态更新到房间
    emitGameState(room);

    // 游戏结束
    if (room.gameState.phase === 'finished') {
      handleGameEnd(room);
    }
    } finally {
      await lock.release();
    }
  });

  // 获取队列状态
  socket.on('queue:status', ({ gameType }, callback) => {
    const queue = store.getQueue(gameType);
    callback({ queueSize: queue.length });
  });

  // 断线处理
  socket.on('disconnect', () => {
    if (currentPlayer) {
      const latestPlayer = store.getPlayer(currentPlayer.id);
      if (!latestPlayer || latestPlayer.socketId !== socket.id) return;

      latestPlayer.online = false;
      latestPlayer.socketId = null;
      latestPlayer.lastSeenAt = Date.now();
      store.savePlayer(latestPlayer);
      // 从匹配队列移除
      store.dequeue(latestPlayer.id);

      // 如果在房间中，通知其余玩家
      const room = store.getPlayerRoom(latestPlayer.id);
      if (room) {
        markSeatConnection(room, latestPlayer.id, 'offline', { disconnectedAt: Date.now() });
        store.saveRoom(room);
        emitRoomUpdate(room);

        const otherPlayers = room.players.filter(pid => pid !== latestPlayer.id);
        otherPlayers.forEach((pid) => {
          io.to(`player:${pid}`).emit('game:opponent_disconnected', {
            nickname: latestPlayer.nickname,
            graceMs: DISCONNECT_GRACE_MS
          });
        });

        if (room.status === 'playing' && room.players.length === 2) {
          setTimeout(() => {
            const p = store.getPlayer(latestPlayer.id);
            const r = store.getPlayerRoom(latestPlayer.id);
            if (p && !p.online && r?.status === 'playing') {
              forfeitPlayer(r, latestPlayer.id, 'disconnect_timeout');
            }
          }, DISCONNECT_GRACE_MS);
        } else if (room.status === 'playing' && isTwoVsTwoRoom(room)) {
          skipUnavailableTurns(room);
          store.saveRoom(room);
          emitGameState(room);
        }
      }

      broadcastUpdate();
    }
  });
});

function getBlockingRoom(playerId) {
  const room = store.getPlayerRoom(playerId);
  if (!room || room.status === 'finished') return null;
  return room;
}

function getRoomPlayerSummaries(room) {
  if (!room) return [];

  return room.players.map(pid => {
    const p = store.getPlayer(pid);
    const seat = room.seatStates?.[pid] || {};
    return p ? {
      id: p.id,
      nickname: p.nickname || p.name,
      busNumber: p.busNumber,
      isBot: p.isBot || false,
      ready: Boolean(room.ready?.[pid] || seat.ready),
      connection: seat.connection || (p.online ? 'online' : 'offline'),
      intent: seat.intent || 'active'
    } : null;
  }).filter(Boolean);
}

function emitRoomUpdate(room) {
  if (!room) return;
  io.to(`room:${room.id}`).emit('room:update', serializeRoom(room));
}

function emitGameState(room) {
  if (!room) return;
  io.to(`room:${room.id}`).emit('game:state', {
    gameState: room.gameState,
    players: getRoomPlayerSummaries(room),
    room: serializeRoom(room)
  });
}

function notifyRoomPlayers(room, eventName = 'game:matched') {
  const payload = serializeRoom(room);
  room.players.forEach(pid => {
    io.to(`player:${pid}`).emit(eventName, payload);
  });
}

function emitRoomInvite(playerId, room, inviter = null) {
  if (!playerId || !room) return;
  const owner = inviter || store.getPlayer(room.ownerId);
  io.to(`player:${playerId}`).emit('room:invited', {
    room: serializeRoom(room),
    from: owner ? {
      id: owner.id,
      nickname: owner.nickname,
      busNumber: owner.busNumber
    } : null
  });
}

function emitPendingRoomInvites(playerId) {
  if (!playerId) return;
  for (const room of store.rooms.values()) {
    if (room.status !== 'readying') continue;
    if (!room.invites?.includes(playerId)) continue;
    emitRoomInvite(playerId, room);
  }
}

function isRoomFull(room) {
  const config = getGameConfig(room.gameType);
  return Boolean(config && room.players.length >= config.maxPlayers);
}

function ensureReadyDeadline(room) {
  if (!room || room.status !== 'readying') return;
  if (isRoomFull(room)) {
    room.readyDeadline = room.readyDeadline || (Date.now() + READY_TIMEOUT_MS);
  } else {
    room.readyDeadline = null;
  }
}

function areAllRoomPlayersReady(room) {
  return isRoomFull(room) && room.players.every(pid => room.ready?.[pid]);
}

function maybeStartReadyRoom(room) {
  if (!room || room.status !== 'readying' || !areAllRoomPlayersReady(room)) return false;

  const engine = getEngine(room.gameType);
  if (!engine) return false;

  room.status = 'playing';
  room.readyDeadline = null;
  room.gameState = engine.init(room, room.players);
  room.ready = Object.fromEntries(room.players.map(pid => [pid, true]));
  room.seatStates = room.seatStates || {};
  room.players.forEach(pid => {
    const p = store.getPlayer(pid);
    room.seatStates[pid] = {
      ...(room.seatStates[pid] || {}),
      ready: true,
      connection: p?.online === false ? 'offline' : 'online',
      intent: 'active'
    };
  });
  room.updatedAt = Date.now();
  store.saveRoom(room);

  io.to(`room:${room.id}`).emit('room:started', serializeRoom(room));
  emitGameState(room);
  broadcastUpdate();
  return true;
}

function handleReadyTimeout(room) {
  if (!room || room.status !== 'readying' || !room.readyDeadline) return;
  if (Date.now() < room.readyDeadline) return;
  if (areAllRoomPlayersReady(room)) {
    maybeStartReadyRoom(room);
    return;
  }

  const unreadyIds = room.players.filter(pid => !room.ready?.[pid]);
  const readyIds = room.players.filter(pid => room.ready?.[pid]);

  unreadyIds.forEach(pid => {
    io.to(`player:${pid}`).emit('room:kicked', {
      roomId: room.id,
      reason: 'ready_timeout',
      message: '20秒内未准备，已返回大厅'
    });
  });

  if (room.visibility === 'public') {
    const gameType = room.gameType;
    store.removeRoom(room.id);
    readyIds.forEach(pid => {
      const player = store.getPlayer(pid);
      if (!player || !player.online) return;
      store.enqueue(pid, gameType);
      io.to(`player:${pid}`).emit('match:requeued', {
        gameType,
        message: '有人未准备，已为你重新匹配'
      });
    });
    broadcastUpdate();
    return;
  }

  unreadyIds.forEach(pid => store.removePlayerFromRoom(room.id, pid));
  const updatedRoom = store.getRoom(room.id);
  if (!updatedRoom || updatedRoom.players.length === 0) {
    store.removeRoom(room.id);
    broadcastUpdate();
    return;
  }

  ensureReadyDeadline(updatedRoom);
  store.saveRoom(updatedRoom);
  emitRoomUpdate(updatedRoom);
  broadcastUpdate();
}

function markSeatConnection(room, playerId, connection, extra = {}) {
  if (!room) return;
  room.seatStates = room.seatStates || {};
  room.seatStates[playerId] = {
    ...(room.seatStates[playerId] || {}),
    connection,
    ...extra
  };
  if (extra.ready !== undefined) {
    room.ready = room.ready || {};
    room.ready[playerId] = Boolean(extra.ready);
  }
  room.updatedAt = Date.now();
}

function isTwoVsTwoRoom(room) {
  return room?.gameType === 'guandan' && room.players.length === 4;
}

function isPlayerOfflinePastGrace(room, playerId) {
  const player = store.getPlayer(playerId);
  if (player?.online) return false;

  const seat = room.seatStates?.[playerId] || {};
  const disconnectedAt = Number(seat.disconnectedAt || player?.lastSeenAt || 0);
  if (!disconnectedAt) return false;
  return Date.now() - disconnectedAt >= DISCONNECT_GRACE_MS;
}

function getUnavailablePlayerIds(room) {
  const result = new Set();
  for (const pid of room.players) {
    const seat = room.seatStates?.[pid];
    if (seat?.intent === 'abandoned' || isPlayerOfflinePastGrace(room, pid)) {
      result.add(pid);
    }
  }
  return result;
}

function getNextAvailablePlayer(players, currentPlayer, unavailable, finishedOrder = []) {
  const finished = new Set(finishedOrder);
  const active = players.filter(pid => !finished.has(pid) && !unavailable.has(pid));
  if (active.length === 0) return null;

  const currentIndex = players.indexOf(currentPlayer);
  for (let offset = 1; offset <= players.length; offset++) {
    const candidate = players[(currentIndex + offset + players.length) % players.length];
    if (active.includes(candidate)) return candidate;
  }
  return active[0];
}

function skipUnavailableTurns(room) {
  if (!isTwoVsTwoRoom(room) || room.status !== 'playing' || !room.gameState) return false;

  const state = room.gameState;
  const unavailable = getUnavailablePlayerIds(room);
  if (unavailable.size === 0) return false;

  let changed = false;
  for (let i = 0; i < room.players.length; i++) {
    const current = state.currentPlayer;
    if (!current || !unavailable.has(current)) break;

    if (room.gameType === 'guandan') {
      state.passedPlayers = state.passedPlayers || [];
      if (state.lastPattern && state.lastLeadPlayer !== current && !state.passedPlayers.includes(current)) {
        state.passedPlayers.push(current);
      }

      const finishedOrder = state.finishedOrder || [];
      const nextPlayer = getNextAvailablePlayer(state.players || room.players, current, unavailable, finishedOrder);
      if (!nextPlayer) break;

      const finished = new Set(finishedOrder);
      const activeOthers = (state.players || room.players).filter(pid => (
        !finished.has(pid) &&
        !unavailable.has(pid) &&
        pid !== state.lastLeadPlayer
      ));

      if (state.lastPattern && state.lastLeadPlayer && !unavailable.has(state.lastLeadPlayer) &&
          activeOthers.every(pid => state.passedPlayers.includes(pid))) {
        state.currentPlayer = state.lastLeadPlayer;
        state.lastPlay = null;
        state.lastPattern = null;
        state.passedPlayers = [];
      } else {
        state.currentPlayer = nextPlayer;
      }
    } else {
      const nextPlayer = getNextAvailablePlayer(state.players || room.players, current, unavailable);
      if (!nextPlayer) break;
      state.currentPlayer = nextPlayer;
    }

    state.timerStarted = Date.now();
    changed = true;
  }

  return changed;
}

function resolveCurrentActorId(room) {
  const state = room.gameState || {};
  if (room.players.includes(state.currentPlayer)) return state.currentPlayer;

  if (room.gameType === 'zha_jin_hua') {
    return state.currentPlayer || null;
  }

  if (room.gameType === 'blackjack') {
    return state.currentPlayer || null;
  }

  if (room.gameType === 'mahjong') {
    if (state.phase === 'draw' || state.phase === 'discard') return state.currentPlayer || null;
    if (state.phase === 'response') {
      const pending = state.pendingAction;
      if (!pending) return null;
      if (pending.type === 'self') return pending.playerId || null;
      return pending.queue?.[0]?.playerId || null;
    }
  }

  if (room.gameType === 'guandan') {
    return state.currentPlayer || null;
  }

  if (room.gameType === 'undercover') {
    if (state.phase === 'describe') return state.currentDescriber || null;
    if (state.phase === 'vote') {
      const activePlayers = (state.players || room.players).filter(pid => !state.eliminatedPlayers?.includes(pid));
      return activePlayers.find(pid => !state.votes?.[pid]) || null;
    }
  }

  if (room.gameType === 'chess') {
    if (state.currentPlayer === 'red') return state.players?.[0] || room.players[0];
    if (state.currentPlayer === 'black') return state.players?.[1] || room.players[1];
  }

  if (room.gameType === 'rock_paper_scissors' && state.phase === 'choose') {
    const pending = room.players.filter(pid => !state.choices?.[pid]);
    return pending[0] || null;
  }

  if (room.gameType === 'quiz' && state.phase === 'question') {
    const pending = room.players.filter(pid => !state.answeredPlayers?.includes(pid));
    return pending[0] || null;
  }

  return null;
}

function getStateTimeoutMs(state) {
  return Number(state?.timer || 0) > 0
    ? Number(state.timer) * 1000
    : ACTION_TIMEOUT_FALLBACK_MS;
}

function hasStateTimerExpired(state) {
  if (!state || state.phase === 'finished' || !state.timerStarted) return false;
  return Date.now() - Number(state.timerStarted) >= getStateTimeoutMs(state);
}

function persistRoomProgress(room) {
  if (room.gameState?.phase === 'finished') {
    handleGameEnd(room);
    return;
  }
  store.saveRoom(room);
  emitGameState(room);
}

function maybeAdvanceTimedPhase(room) {
  const state = room.gameState;
  if (!hasStateTimerExpired(state)) return false;

  const engine = getEngine(room.gameType);
  if (!engine?.nextRound) return false;

  const autoAdvancePhases = {
    quiz: ['answer'],
    undercover: ['reveal'],
    rock_paper_scissors: ['reveal']
  };
  if (!autoAdvancePhases[room.gameType]?.includes(state.phase)) return false;

  room.gameState = engine.nextRound(state);
  persistRoomProgress(room);
  return true;
}

function getAutoMahjongAction(state, playerId) {
  if (state.phase === 'draw' && playerId === state.currentPlayer) {
    return { type: 'draw_done' };
  }

  if (state.phase === 'discard' && playerId === state.currentPlayer) {
    const hand = state.hands?.[playerId] || [];
    const card = hand[hand.length - 1] || hand[0];
    return card ? { type: 'discard', card } : null;
  }

  if (state.phase === 'response') {
    const pending = state.pendingAction;
    if (!pending) return null;
    if (pending.type === 'self' && pending.playerId === playerId) {
      return { type: 'pass' };
    }
    if (pending.queue?.[0]?.playerId === playerId) {
      return { type: 'pass' };
    }
  }

  return null;
}

function getAutoGuandanAction(state, playerId) {
  if (state.currentPlayer !== playerId) return null;
  if (state.lastPattern && state.lastLeadPlayer !== playerId) {
    return { type: 'pass' };
  }

  const hand = state.hands?.[playerId] || [];
  return hand[0] ? { type: 'play', cards: [hand[0]] } : null;
}

function getAutoUndercoverAction(state, playerId) {
  if (state.phase === 'describe' && state.currentDescriber === playerId) {
    return { type: 'describe', text: '托管发言' };
  }

  if (state.phase === 'vote' && !state.votes?.[playerId]) {
    const activePlayers = (state.players || []).filter(pid => !state.eliminatedPlayers?.includes(pid));
    const targetId = activePlayers.find(pid => pid !== playerId) || activePlayers[0];
    return targetId ? { type: 'vote', targetId } : null;
  }

  return null;
}

function getAutomatedAction(room, playerId) {
  const state = room.gameState || {};

  if (room.gameType === 'rock_paper_scissors' && state.phase === 'choose' && !state.choices?.[playerId]) {
    return { type: 'choose', choice: 'rock' };
  }

  if (room.gameType === 'guess_number' && state.phase === 'guess' && state.currentPlayer === playerId) {
    const low = Number(state.range?.low || 1);
    const high = Number(state.range?.high || 100);
    return { type: 'guess', guess: Math.floor((low + high) / 2) };
  }

  if (room.gameType === 'blackjack' && state.phase === 'play' && state.currentPlayer === playerId) {
    return { type: 'stand' };
  }

  if (room.gameType === 'zha_jin_hua') {
    if (state.phase === 'look') return { type: 'ready' };
    if (state.phase === 'bet' && state.currentPlayer === playerId) return { type: 'fold' };
  }

  if (room.gameType === 'guandan') {
    return getAutoGuandanAction(state, playerId);
  }

  if (room.gameType === 'mahjong') {
    return getAutoMahjongAction(state, playerId);
  }

  if (room.gameType === 'quiz' && state.phase === 'question' && !state.answeredPlayers?.includes(playerId)) {
    return { type: 'answer', answer: -1 };
  }

  if (room.gameType === 'undercover') {
    return getAutoUndercoverAction(state, playerId);
  }

  return null;
}

function shouldForfeitOnTimeout(gameType) {
  return ['rock_paper_scissors', 'guess_number', 'blackjack', 'gomoku', 'chess'].includes(gameType);
}

function handleActionTimeout(room) {
  if (!room || room.mode === 'quick' || room.status !== 'playing') return;
  const state = room.gameState;
  if (!state || state.phase === 'finished') return;

  if (maybeAdvanceTimedPhase(room)) return;

  const loserId = resolveCurrentActorId(room);
  if (!loserId) return;

  const timeoutExpired = hasStateTimerExpired(state);
  const offlineExpired = isPlayerOfflinePastGrace(room, loserId);
  if (!timeoutExpired && !offlineExpired) return;

  if (room.players.length === 2 && shouldForfeitOnTimeout(room.gameType)) {
    forfeitPlayer(room, loserId, offlineExpired ? 'disconnect_timeout' : 'action_timeout');
    return;
  }

  const action = getAutomatedAction(room, loserId);
  if (!action) return;

  const engine = getEngine(room.gameType);
  if (!engine) return;

  room.gameState = engine.update(room.gameState, action, loserId);
  skipUnavailableTurns(room);
  persistRoomProgress(room);
}

function forfeitPlayer(room, loserId, reason) {
  if (!room || room.status === 'finished') return;
  const winnerId = room.players.find(pid => pid !== loserId) || null;
  room.gameState = room.gameState || {};
  room.gameState.phase = 'finished';
  room.gameState.finalWinner = winnerId;
  room.gameState.winner = winnerId;
  room.gameState.forfeit = { playerId: loserId, reason };
  room.gameState.winningPlayers = winnerId ? [winnerId] : [];
  handleGameEnd(room);
}

function handlePlayerLeaveRoom(room, playerId, { confirmForfeit = false, reason = 'leave' } = {}) {
  if (!room || room.status === 'finished') return { success: true };

  if (room.status === 'readying') {
    const remainingIds = room.players.filter(pid => pid !== playerId);
    io.to(`player:${playerId}`).emit('room:left', { roomId: room.id });

    if (room.visibility === 'public') {
      const gameType = room.gameType;
      store.removeRoom(room.id);
      remainingIds.forEach(pid => {
        const p = store.getPlayer(pid);
        if (!p?.online) return;
        store.enqueue(pid, gameType);
        io.to(`player:${pid}`).emit('match:requeued', {
          gameType,
          message: '有玩家离开，已为你重新匹配'
        });
      });
      broadcastUpdate();
      return { success: true, left: true };
    }

    const updatedRoom = store.removePlayerFromRoom(room.id, playerId);
    if (!updatedRoom || updatedRoom.players.length === 0) {
      store.removeRoom(room.id);
    } else {
      ensureReadyDeadline(updatedRoom);
      store.saveRoom(updatedRoom);
      emitRoomUpdate(updatedRoom);
    }
    broadcastUpdate();
    return { success: true, left: true };
  }

  if (room.status === 'playing' && room.players.length === 2) {
    if (!confirmForfeit) {
      return {
        error: '返回大厅将视为认输',
        requiresConfirmation: true
      };
    }
    forfeitPlayer(room, playerId, reason);
    return { success: true, forfeited: true };
  }

  if (room.status === 'playing' && isTwoVsTwoRoom(room)) {
    markSeatConnection(room, playerId, 'online', { intent: 'abandoned' });
    skipUnavailableTurns(room);
    store.saveRoom(room);
    emitRoomUpdate(room);
    emitGameState(room);
    io.to(`player:${playerId}`).emit('room:abandoned', {
      roomId: room.id,
      message: '本局结束前不能参与其他游戏'
    });
    return { success: true, abandoned: true };
  }

  markSeatConnection(room, playerId, 'online', { intent: 'abandoned' });
  store.saveRoom(room);
  emitRoomUpdate(room);
  return { success: true, abandoned: true };
}

function monitorRooms() {
  for (const room of Array.from(store.rooms.values())) {
    if (room.status === 'readying') {
      handleReadyTimeout(room);
      continue;
    }

    if (room.status !== 'playing') continue;
    handleActionTimeout(room);
    const latest = store.getRoom(room.id);
    if (latest?.status === 'playing' && skipUnavailableTurns(latest)) {
      store.saveRoom(latest);
      emitGameState(latest);
    }
  }
}

function startRoomMonitor() {
  setInterval(monitorRooms, 1000);
}

// ========== 游戏结束处理 ==========
function handleGameEnd(room) {
  if (!room || room.status === 'finished') return;

  const config = getGameConfig(room.gameType);
  const winnerId = room.gameState.finalWinner ?? room.gameState.winner;
  const winningPlayers = room.gameState.winningPlayers || (winnerId && winnerId !== 'draw' ? [winnerId] : []);
  const pointsBefore = Object.fromEntries(
    room.players.map((pid) => [pid, Number(store.getPlayer(pid)?.points || 0)])
  );

  // 根据游戏类型采用不同的积分结算规则
  if (room.gameType === 'zha_jin_hua' || room.gameType === 'mahjong') {
    // 加番游戏：门票 + 加番金额
    settleGameWithPot(room, winningPlayers);
  } else if (room.gameType === 'guandan') {
    // 掼蛋 2v2 团队游戏
    settleGuandan(room, winningPlayers);
  } else if (room.players.length === 2) {
    // 1v1 游戏：输家输门票，赢家赢门票
    settle1v1(room, winnerId);
  } else {
    // 多玩家游戏（无加番）：赢家获得全部奖池
    settleMultiplayer(room, winningPlayers);
  }

  recordBattleHistory(room, config, winningPlayers, pointsBefore);

  room.status = 'finished';
  room.players.forEach(pid => {
    const p = store.getPlayer(pid);
    if (p?.currentRoom === room.id) {
      p.currentRoom = null;
      store.savePlayer(p);
    }
  });
  store.saveRoom(room);

  // 广播结算
  io.to(`room:${room.id}`).emit('game:result', {
    winner: winnerId,
    winningPlayers: winningPlayers,
    room: serializeRoom(room),
    players: room.players.map(pid => {
      const p = store.getPlayer(pid);
      const isWinner = winningPlayers.includes(pid);
      return {
        id: pid,
        nickname: p ? p.nickname : '未知',
        points: p ? p.points : 0,
        won: isWinner
      };
    })
  });

  // 更新排行榜
  broadcastUpdate();

  // 10分钟后清理房间
  setTimeout(() => store.removeRoom(room.id), 600000);
}

// 1v1 游戏结算（零和转移）
function settle1v1(room, winnerId) {
  const config = getGameConfig(room.gameType);
  const entryFee = config.entryFee;

  room.players.forEach(pid => {
    if (!winnerId || winnerId === 'draw') {
      store.recordGame(pid, null);
      return;
    }

    const isWinner = pid === winnerId;
    store.recordGame(pid, isWinner);
    
    if (isWinner) {
      store.updatePoints(pid, entryFee, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: true }); // 赢家净 +门票
    } else {
      store.updatePoints(pid, -entryFee, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: false }); // 输家净 -门票
    }
  });
}

// 多玩家游戏结算（无加番）
function settleMultiplayer(room, winningPlayers) {
  const config = getGameConfig(room.gameType);
  const entryFee = config.entryFee;
  const totalPool = entryFee * room.players.length;
  const numWinners = winningPlayers.length || 1;
  const winAmount = Math.floor(totalPool / numWinners);

  room.players.forEach(pid => {
    const isWinner = winningPlayers.includes(pid);
    store.recordGame(pid, isWinner);
    
    if (isWinner) {
      store.updatePoints(pid, winAmount - entryFee, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: true });
    } else {
      store.updatePoints(pid, -entryFee, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: false });
    }
  });
}

// 掼蛋 2v2 结算
function settleGuandan(room, winningPlayers) {
  const entryFee = 80;
  const totalPool = entryFee * 4;
  const winAmount = Math.floor(totalPool / 2); // 2人平分

  room.players.forEach(pid => {
    const isWinner = winningPlayers.includes(pid);
    store.recordGame(pid, isWinner);
    
    if (isWinner) {
      store.updatePoints(pid, winAmount - entryFee, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: true }); // 净 +80
    } else {
      store.updatePoints(pid, -entryFee, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: false }); // 净 -80
    }
  });
}

// 加番游戏结算（炸金花、麻将）
function settleGameWithPot(room, winningPlayers) {
  const config = getGameConfig(room.gameType);
  const entryFee = config.entryFee;
  const totalPot = room.gameState.pot || (entryFee * room.players.length);

  // 炸金花：赢家获得全部奖池
  if (room.gameType === 'zha_jin_hua') {
    room.players.forEach(pid => {
      const isWinner = winningPlayers.includes(pid);
      const playerBet = room.gameState.playerBets?.[pid] || entryFee;
      store.recordGame(pid, isWinner);
      
      if (isWinner) {
        store.updatePoints(pid, totalPot - playerBet, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: true });
      } else {
        store.updatePoints(pid, -playerBet, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: false });
      }
    });
  }

  // 麻将：使用游戏引擎中的 scores 进行结算
  if (room.gameType === 'mahjong') {
    const scores = room.gameState.scores || {};
    room.players.forEach(pid => {
      const isWinner = winningPlayers.includes(pid);
      store.recordGame(pid, isWinner);
      
      // 麻将的 scores 已经是净收益（包含门票和番数）
      const scoreDelta = scores[pid] || 0;
      store.updatePoints(pid, scoreDelta, 'game_settlement', { roomId: room.id, gameType: room.gameType, won: isWinner });
    });
  }
}

// ========== 广播更新 ==========
function buildBattlePlayerSummary(playerId) {
  const player = store.getPlayer(playerId);
  return {
    id: playerId,
    nickname: player?.nickname || '未知玩家',
    busNumber: player?.busNumber || '',
    isBot: Boolean(player?.isBot)
  };
}

function getBattleParticipants(room, playerId) {
  const everyoneElse = room.players.filter((pid) => pid !== playerId);

  if (room.gameType !== 'guandan') {
    return {
      teammates: [],
      opponents: everyoneElse.map(buildBattlePlayerSummary)
    };
  }

  const teams = room.gameState?.teams || {};
  const myTeam = Object.values(teams).find((members) => Array.isArray(members) && members.includes(playerId)) || [];
  const teammateIds = myTeam.filter((pid) => pid !== playerId);
  const opponentIds = room.players.filter((pid) => pid !== playerId && !myTeam.includes(pid));

  return {
    teammates: teammateIds.map(buildBattlePlayerSummary),
    opponents: opponentIds.map(buildBattlePlayerSummary)
  };
}

function recordBattleHistory(room, config, winningPlayers, pointsBefore) {
  const finishedAt = Date.now();

  room.players.forEach((playerId) => {
    const player = store.getPlayer(playerId);
    if (!player || player.isBot) return;

    const before = Number(pointsBefore[playerId] ?? 0);
    const after = Number(player.points ?? before);
    const scoreDelta = after - before;
    const result = winningPlayers.length === 0
      ? 'draw'
      : (winningPlayers.includes(playerId) ? 'win' : 'loss');
    const { teammates, opponents } = getBattleParticipants(room, playerId);

    store.recordGameRecord({
      playerId,
      roomId: room.id,
      gameType: room.gameType,
      gameName: config?.name || room.gameType,
      result,
      scoreDelta,
      pointsBefore: before,
      pointsAfter: after,
      opponents,
      teammates,
      createdAt: finishedAt,
      metadata: {
        winningPlayers,
        entryFee: Number(config?.entryFee || 0)
      }
    });
  });
}

function broadcastUpdate() {
  io.emit('server:update', {
    personal: store.getPersonalLeaderboard(),
    bus: store.getBusLeaderboard(),
    stats: store.getStats()
  });
}

function serializeRoom(room) {
  if (!room) return null;

  return {
    roomId: room.id,
    id: room.id,
    gameType: room.gameType,
    gameName: getGameConfig(room.gameType)?.name || room.gameType,
    minPlayers: getGameConfig(room.gameType)?.minPlayers || room.players.length,
    maxPlayers: getGameConfig(room.gameType)?.maxPlayers || room.players.length,
    players: getRoomPlayerSummaries(room),
    status: room.status,
    mode: room.mode || 'normal',
    visibility: room.visibility || 'public',
    ownerId: room.ownerId || null,
    ready: room.ready || {},
    readyDeadline: room.readyDeadline || null,
    seatStates: room.seatStates || {},
    gameState: room.gameState
  };
}

function cleanupPlayerBotRooms(playerId) {
  const rooms = store.getRoomsForPlayer(playerId);
  const blockingRooms = [];

  rooms.forEach((room) => {
    const otherHumanIds = room.players.filter(pid => {
      if (pid === playerId) return false;
      const p = store.getPlayer(pid);
      return p && !p.isBot;
    });

    if (otherHumanIds.length > 0) {
      blockingRooms.push(room);
      return;
    }

    room.players.forEach(pid => {
      const p = store.getPlayer(pid);
      if (!p) return;
      if (p.currentRoom === room.id) {
        p.currentRoom = null;
        store.savePlayer(p);
      }
      if (p.isBot) store.removePlayer(pid);
    });

    store.removeRoom(room.id);
  });

  return blockingRooms;
}

// ========== 房间状态推送 ==========
// 当匹配成功后，通知房间玩家
const originalCreateRoom = store.createRoom.bind(store);
store.createRoom = function(gameType, players, options = {}) {
  const room = originalCreateRoom(gameType, players, {
    ...options,
    status: options.status || 'readying',
    mode: options.mode || 'normal',
    visibility: options.visibility || 'public'
  });

  ensureReadyDeadline(room);
  store.saveRoom(room);
  notifyRoomPlayers(room, 'game:matched');
  return room;
};

// ========== 快速游戏 (人机对战：一点即玩) ==========
const quickPlayRooms = new Map(); // roomId → { timer, bots }

// 获取当前应该行动的机器人玩家ID
function getCurrentBotPlayer(state, gameType) {
  if (!state) return null;
  switch (gameType) {
    case 'rock_paper_scissors': {
      const allPlayers = state.players || Object.keys(state.scores || {});
      const unchosen = allPlayers.filter(p => !state.choices?.[p]);
      return unchosen.find(p => p.startsWith('bot_')) || null;
    }
    case 'guess_number':
      return state.currentPlayer?.startsWith('bot_') ? state.currentPlayer : null;
    case 'blackjack':
      if (state.finishedPlayers?.includes(state.currentPlayer)) return null;
      return state.currentPlayer?.startsWith('bot_') ? state.currentPlayer : null;
    case 'zha_jin_hua':
      if (state.phase === 'look') {
        return state.activePlayers?.find(p =>
          p.startsWith('bot_') && !state.actedThisRound?.includes(p)
        ) || null;
      }
      return (state.phase === 'bet' && state.currentPlayer?.startsWith('bot_')) ? state.currentPlayer : null;
    case 'undercover': {
      if (state.phase === 'describe') {
        const desc = state.currentDescriber;
        if (desc && desc.startsWith('bot_') && !state.eliminatedPlayers?.includes(desc)) return desc;
      }
      if (state.phase === 'vote') {
        const alive = state.players?.filter(p => !state.eliminatedPlayers?.includes(p) && p.startsWith('bot_'));
        const unvoted = alive?.filter(p => !state.votes?.[p]);
        return unvoted?.[0] || null;
      }
      return null;
    }
    case 'quiz':
      return state.players?.find(p => p.startsWith('bot_') && !state.answeredPlayers?.includes(p)) || null;
    case 'guandan':
      return state.currentPlayer?.startsWith('bot_') ? state.currentPlayer : null;
    case 'mahjong':
      if (state.phase === 'response') {
        if (state.pendingAction?.type === 'self') {
          return state.pendingAction.playerId?.startsWith('bot_') ? state.pendingAction.playerId : null;
        }
        const claimant = state.pendingAction?.queue?.[0]?.playerId;
        return claimant?.startsWith('bot_') ? claimant : null;
      }
      return state.currentPlayer?.startsWith('bot_') ? state.currentPlayer : null;
    case 'gomoku':
    case 'chess': {
      // 这些游戏使用颜色作为 currentPlayer，需要映射到玩家 ID
      const currentColor = state.currentPlayer;
      if (!currentColor) return null;
      
      // players[0] 是红方，players[1] 是黑方
      const playerIndex = currentColor === 'red' ? 0 : 1;
      const playerId = state.players?.[playerIndex];
      
      return playerId?.startsWith('bot_') ? playerId : null;
    }
    default:
      return null;
  }
}

function startQuickPlayLoop(room, bots) {
  const engine = getEngine(room.gameType);
  if (!engine) return null;

  const timer = setInterval(() => {
    // 房间已清理
    if (!quickPlayRooms.has(room.id)) { clearInterval(timer); return; }
    if (room.status === 'finished') {
      clearInterval(timer);
      setTimeout(() => {
        quickPlayRooms.delete(room.id);
        store.removeRoom(room.id);
        bots.forEach(b => store.removePlayer(b.id));
      }, 10000);
      return;
    }

    const state = room.gameState;
    if (!state) return;

    const currentPlayer = getCurrentBotPlayer(state, room.gameType);
    if (!currentPlayer) return;

    const strategy = BotStrategy[room.gameType];
    if (!strategy) return;

    const action = strategy(state, currentPlayer);
    if (!action) return;

    if (action.type === 'next_round') {
      if (engine.nextRound) room.gameState = engine.nextRound(room.gameState);
    } else {
      room.gameState = engine.update(room.gameState, action, currentPlayer);
    }
    store.saveRoom(room);

    // 广播状态更新
    const allPlayers = room.players.map(pid => {
      const p = store.getPlayer(pid);
      return p ? { id: p.id, nickname: p.nickname || p.name, busNumber: p.busNumber, isBot: p.isBot || false } : null;
    }).filter(Boolean);

    io.to(`room:${room.id}`).emit('game:state', { gameState: room.gameState, players: allPlayers });

    // 游戏结束处理
    if (room.gameState.phase === 'finished') {
      const config = getGameConfig(room.gameType);
      const winnerId = room.gameState.finalWinner ?? room.gameState.winner;
      const winningPlayers = room.gameState.winningPlayers || (winnerId && winnerId !== 'draw' ? [winnerId] : []);
      const entryFee = config.entryFee;

      // 根据游戏类型采用不同的积分结算规则
      if (room.gameType === 'zha_jin_hua' || room.gameType === 'mahjong') {
        settleGameWithPot(room, winningPlayers);
      } else if (room.gameType === 'guandan') {
        settleGuandan(room, winningPlayers);
      } else if (room.players.length === 2) {
        settle1v1(room, winnerId);
      } else {
        settleMultiplayer(room, winningPlayers);
      }

      room.status = 'finished';
      room.players.forEach(pid => {
        const p = store.getPlayer(pid);
        if (p?.currentRoom === room.id) {
          p.currentRoom = null;
          store.savePlayer(p);
        }
      });
      store.saveRoom(room);

      io.to(`room:${room.id}`).emit('game:result', {
        winner: winnerId,
        winningPlayers,
        room: serializeRoom(room),
        players: room.players.map(pid => {
          const p = store.getPlayer(pid);
          const isWinner = winningPlayers.includes(pid);
          return { id: pid, nickname: p ? (p.nickname || p.name) : '未知', points: p ? p.points : 0, won: isWinner };
        })
      });

      broadcastUpdate();
    }
  }, 1500);

  return timer;
}

// POST /api/bots/quick-play - 一点即玩
app.post('/api/bots/quick-play', express.json(), (req, res) => {
  const { playerId, gameType } = req.body;

  const player = store.getPlayer(playerId);
  if (!player) return res.status(404).json({ error: '玩家不存在' });

  const config = getGameConfig(gameType);
  if (!config) return res.status(400).json({ error: '游戏不存在' });

  const blockingRooms = cleanupPlayerBotRooms(playerId);
  if (blockingRooms.length > 0) {
    return res.status(400).json({ error: '你仍在多人房间中，请先结束当前对局' });
  }

  if (player.currentRoom) {
    const existingRoom = store.getRoom(player.currentRoom);
    if (!existingRoom || existingRoom.status === 'finished') {
      if (existingRoom) store.removeRoom(existingRoom.id);
      player.currentRoom = null;
      store.savePlayer(player);
    } else {
      return res.status(400).json({ error: '你已在游戏中' });
    }
  }

  // 创建机器人填满剩余位置
  const numBots = (config.maxPlayers || 2) - 1;
  const bots = [];
  for (let i = 0; i < numBots; i++) {
    const bot = new BotPlayer(gameType);
    bot.points = 5000;
    bot.totalGames = 0;
    bot.wins = 0;
    bot.isBot = true;
    bot.online = true;
    bot.currentRoom = null;
    bot.createdAt = Date.now();
    bot.busNumber = 99;
    const savedBot = store.addPlayer(bot);
    bots.push(savedBot);
  }

  const allPlayers = [player, ...bots];

  // 使用原始 createRoom（不广播 game:matched）
  const room = originalCreateRoom(gameType, allPlayers, {
    mode: 'quick',
    status: 'playing',
    visibility: 'quick',
    ready: Object.fromEntries(allPlayers.map(p => [p.id, true])),
    seatStates: Object.fromEntries(allPlayers.map(p => [
      p.id,
      { ready: true, connection: 'online', intent: 'active' }
    ]))
  });

  // 初始化游戏状态
  const engine = getEngine(gameType);
  const pids = allPlayers.map(p => p.id);
  if (engine) room.gameState = engine.init(room, pids);
  room.status = 'playing';
  store.saveRoom(room);

  const matchPayload = serializeRoom(room);

  // 只给真人玩家发送 game:matched
  io.to(`player:${playerId}`).emit('game:matched', matchPayload);

  // 启动机器人对局循环
  const timer = startQuickPlayLoop(room, bots);
  quickPlayRooms.set(room.id, { timer, bots });

  console.log(`🎮 快速游戏: ${room.id} (${config.name}, 真人+${numBots}机器人)`);
  res.json({ success: true, ...matchPayload });
});

// ========== 自动匹配循环（每2秒检查一次） ==========
let matchingTickRunning = false;

function startMatchmakingLoop() {
  setInterval(async () => {
    if (matchingTickRunning) return;
    matchingTickRunning = true;

    try {
      const matches = await tryMatch();
      matches.forEach(({ gameType, players }) => {
        store.createRoom(gameType, players);
        broadcastUpdate();
      });
    } catch (error) {
      console.error(`[matchmaker] ${error.message}`);
    } finally {
      matchingTickRunning = false;
    }
  }, 2000);
}

// 启动
async function startServer() {
  await store.init();

  const socketAdapter = redisStore.getSocketAdapter();
  if (socketAdapter) {
    io.adapter(socketAdapter);
    console.log('[socket.io] Redis adapter enabled');
  }

  const PORT = process.env.PORT || 3457;
  server.listen(PORT, () => {
    console.log(`🚌 团建大巴游戏平台已启动: http://localhost:${PORT}`);
    console.log(`   Socket.io 就绪`);
  });

  startMatchmakingLoop();
  startRoomMonitor();
}

startServer().catch((error) => {
  console.error(`[startup] ${error.stack || error.message}`);
  process.exit(1);
});
