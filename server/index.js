// 团建大巴游戏平台 - 主服务器
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const store = require('./store');
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
app.use(express.static(clientDist));

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

// 管理员API
app.get('/api/admin/players', (req, res) => {
  const players = Array.from(store.players.values()).map(p => ({
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
  store.updatePoints(playerId, amount);
  io.to(`player:${playerId}`).emit('admin:points_given', { amount, reason, newPoints: player.points });
  broadcastUpdate();
  res.json({ success: true, player: { id: player.id, points: player.points } });
});

// ========== 机器人管理 API ==========
const botManager = new BotManager(io);

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
    currentPlayer = player;
    socket.playerId = player.id;

    // 加入个人房间（用于定向推送）
    socket.join(`player:${player.id}`);
    // 加入大巴房间（用于大巴广播）
    socket.join(`bus:${player.busNumber}`);

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
    currentPlayer = player;
    socket.playerId = player.id;
    socket.join(`player:${player.id}`);
    socket.join(`bus:${player.busNumber}`);

    callback({ player });
    broadcastUpdate();
  });

  // 开始匹配
  socket.on('match:join', ({ gameType }, callback) => {
    if (!currentPlayer) return callback({ error: '请先注册' });

    const config = getGameConfig(gameType);
    if (!config) return callback({ error: '游戏不存在' });

    if (currentPlayer.currentRoom) {
      return callback({ error: '你已在游戏中' });
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
  socket.on('game:action', ({ action }) => {
    if (!currentPlayer) return;

    const room = store.getPlayerRoom(currentPlayer.id);
    if (!room) return;

    const engine = getEngine(room.gameType);
    if (!engine) return;

    // 处理 'next_round' 操作
    if (action.type === 'next_round') {
      if (engine.nextRound) {
        room.gameState = engine.nextRound(room.gameState);
      }
    } else if (room.status === 'playing') {
      room.gameState = engine.update(room.gameState, action, currentPlayer.id);
    }

    // 广播游戏状态更新到房间
    io.to(`room:${room.id}`).emit('game:state', {
      gameState: room.gameState,
      players: room.players.map(pid => {
        const p = store.getPlayer(pid);
        return p ? { id: p.id, nickname: p.nickname, busNumber: p.busNumber } : null;
      }).filter(Boolean)
    });

    // 游戏结束
    if (room.gameState.phase === 'finished') {
      handleGameEnd(room);
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
      currentPlayer.online = false;
      // 从匹配队列移除
      store.dequeue(currentPlayer.id);

      // 如果在房间中，通知其余玩家
      const room = store.getPlayerRoom(currentPlayer.id);
      if (room) {
        const otherPlayers = room.players.filter(pid => pid !== currentPlayer.id);
        otherPlayers.forEach((pid) => {
          io.to(`player:${pid}`).emit('game:opponent_disconnected', {
            nickname: currentPlayer.nickname
          });
        });
        // 30秒后仍未重连，直接结束当前房间
        setTimeout(() => {
          const p = store.getPlayer(currentPlayer.id);
          if (p && !p.online && store.getPlayerRoom(currentPlayer.id)) {
            const r = store.getPlayerRoom(currentPlayer.id);
            if (r) {
              r.gameState.phase = 'finished';
              r.gameState.finalWinner = otherPlayers[0] || null;
              r.gameState.winningPlayers = otherPlayers;
              handleGameEnd(r);
            }
          }
        }, 30000);
      }

      broadcastUpdate();
    }
  });
});

// ========== 游戏结束处理 ==========
function handleGameEnd(room) {
  if (!room || room.status === 'finished') return;

  const config = getGameConfig(room.gameType);
  const winnerId = room.gameState.finalWinner ?? room.gameState.winner;

  // 计算积分
  room.players.forEach(pid => {
    const isWinner = room.gameState.winningPlayers
      ? room.gameState.winningPlayers.includes(pid)
      : (pid === winnerId);
    store.recordGame(pid, isWinner);
    if (isWinner) {
      const poolTotal = config.entryFee * room.players.length;
      const numWinners = room.gameState.winningPlayers ? room.gameState.winningPlayers.length : 1;
      const winAmount = Math.floor(poolTotal * 0.7 / numWinners);
      store.updatePoints(pid, winAmount);
      if (room.gameState.pot) {
        store.updatePoints(pid, Math.floor(room.gameState.pot / numWinners));
      }
    }
  });

  room.status = 'finished';
  room.players.forEach(pid => {
    const p = store.getPlayer(pid);
    if (p?.currentRoom === room.id) p.currentRoom = null;
  });

  // 广播结算
  io.to(`room:${room.id}`).emit('game:result', {
    winner: winnerId,
    winningPlayers: room.gameState.winningPlayers,
    players: room.players.map(pid => {
      const p = store.getPlayer(pid);
      const isWinner = room.gameState.winningPlayers
        ? room.gameState.winningPlayers.includes(pid)
        : (pid === winnerId);
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

// ========== 广播更新 ==========
function broadcastUpdate() {
  io.emit('server:update', {
    personal: store.getPersonalLeaderboard(),
    bus: store.getBusLeaderboard(),
    stats: store.getStats()
  });
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
      if (p.currentRoom === room.id) p.currentRoom = null;
      if (p.isBot) store.players.delete(pid);
    });

    store.removeRoom(room.id);
  });

  return blockingRooms;
}

// ========== 房间状态推送 ==========
// 当匹配成功后，通知房间玩家
const originalCreateRoom = store.createRoom.bind(store);
store.createRoom = function(gameType, players) {
  const room = originalCreateRoom(gameType, players);
  const engine = getEngine(gameType);
  const pids = players.map(p => p.id);

  if (engine) {
    room.gameState = engine.init(room, pids);
  }
  room.status = 'playing';

  // 创建 Socket.io 房间
  players.forEach(p => {
    const sockets = io.sockets.adapter.rooms;
    // 通过emit给特定玩家
    io.to(`player:${p.id}`).emit('game:matched', {
      roomId: room.id,
      gameType,
      players: pids.map(pid => {
        const pl = store.getPlayer(pid);
        return pl ? { id: pl.id, nickname: pl.nickname, busNumber: pl.busNumber } : null;
      }).filter(Boolean),
      gameState: room.gameState
    });
  });

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
        bots.forEach(b => store.players.delete(b.id));
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
      const winningPlayers = room.gameState.winningPlayers;

      room.players.forEach(pid => {
        const isWinner = winningPlayers
          ? winningPlayers.includes(pid)
          : (pid === winnerId);
        store.recordGame(pid, isWinner);
        if (isWinner) {
          const poolTotal = (config.entryFee || 10) * room.players.length;
          const numWinners = winningPlayers ? winningPlayers.length : 1;
          const winAmount = Math.floor(poolTotal * 0.7 / numWinners);
          store.updatePoints(pid, winAmount);
          if (room.gameState.pot) store.updatePoints(pid, Math.floor(room.gameState.pot / numWinners));
        }
      });

      room.status = 'finished';
      room.players.forEach(pid => {
        const p = store.getPlayer(pid);
        if (p?.currentRoom === room.id) p.currentRoom = null;
      });

      io.to(`room:${room.id}`).emit('game:result', {
        winner: winnerId,
        winningPlayers,
        players: room.players.map(pid => {
          const p = store.getPlayer(pid);
          const isWinner = winningPlayers
            ? winningPlayers.includes(pid)
            : (pid === winnerId);
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
    bots.push(bot);
    store.players.set(bot.id, bot);
  }

  const allPlayers = [player, ...bots];

  // 使用原始 createRoom（不广播 game:matched）
  const room = originalCreateRoom(gameType, allPlayers);

  // 初始化游戏状态
  const engine = getEngine(gameType);
  const pids = allPlayers.map(p => p.id);
  if (engine) room.gameState = engine.init(room, pids);
  room.status = 'playing';

  const matchPayload = {
    roomId: room.id,
    gameType,
    players: allPlayers.map(p => ({
      id: p.id, nickname: p.nickname || p.name,
      busNumber: p.busNumber, isBot: p.isBot || false
    })),
    gameState: room.gameState
  };

  // 只给真人玩家发送 game:matched
  io.to(`player:${playerId}`).emit('game:matched', matchPayload);

  // 启动机器人对局循环
  const timer = startQuickPlayLoop(room, bots);
  quickPlayRooms.set(room.id, { timer, bots });

  console.log(`🎮 快速游戏: ${room.id} (${config.name}, 真人+${numBots}机器人)`);
  res.json({ success: true, ...matchPayload });
});

// ========== 自动匹配循环（每2秒检查一次） ==========
setInterval(() => {
  const matches = tryMatch();
  matches.forEach(({ gameType, players }) => {
    store.createRoom(gameType, players);
    broadcastUpdate();
  });
}, 2000);

// 启动
const PORT = process.env.PORT || 3457;
server.listen(PORT, () => {
  console.log(`🚌 团建大巴游戏平台已启动: http://localhost:${PORT}`);
  console.log(`   Socket.io 就绪`);
});
