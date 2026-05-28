const { randomUUID } = require('crypto');
const mysqlStore = require('./persistence/mysql');
const redisStore = require('./persistence/redis');

class Store {
  constructor() {
    this.players = new Map();
    this.rooms = new Map();
    this.matchQueue = new Map();
    this.spectators = new Map();
    this.instanceId = `srv_${randomUUID()}`;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const mysqlEnabled = await mysqlStore.initMysql();
    if (mysqlEnabled) {
      const players = await mysqlStore.loadPlayers();
      players.forEach((player) => this.players.set(player.id, player));
      console.log(`[store] MySQL enabled, loaded ${players.length} players`);
    } else {
      console.log('[store] MySQL disabled, using in-memory player persistence');
    }

    const redisEnabled = await redisStore.initRedis(this.instanceId, (event) => {
      this.applyRemoteStateEvent(event);
    });

    if (redisEnabled) {
      await this.loadRedisSnapshot();
      console.log('[store] Redis enabled for Socket.io adapter and transient state');
    } else {
      console.log('[store] Redis disabled, transient state is process-local');
    }

    this.initialized = true;
  }

  async loadRedisSnapshot() {
    const [players, rooms, queues, spectators] = await Promise.all([
      redisStore.hGetAllJson('players'),
      redisStore.hGetAllJson('rooms'),
      redisStore.hGetAllJson('queues'),
      redisStore.hGetAllJson('spectators')
    ]);

    players.forEach((player, id) => this.players.set(id, player));
    rooms.forEach((room, id) => this.rooms.set(id, room));
    queues.forEach((queue, gameType) => {
      this.matchQueue.set(gameType, Array.isArray(queue) ? queue : []);
    });
    spectators.forEach((list, roomId) => {
      this.spectators.set(roomId, Array.isArray(list) ? list : []);
    });
  }

  applyRemoteStateEvent(event) {
    const { type, op, id, data } = event;

    if (type === 'player') {
      if (op === 'delete') this.players.delete(id);
      if (op === 'upsert') this.players.set(id, data);
      return;
    }

    if (type === 'room') {
      if (op === 'delete') this.rooms.delete(id);
      if (op === 'upsert') this.rooms.set(id, data);
      return;
    }

    if (type === 'queue') {
      if (op === 'delete') this.matchQueue.delete(id);
      if (op === 'upsert') this.matchQueue.set(id, Array.isArray(data) ? data : []);
      return;
    }

    if (type === 'spectator') {
      if (op === 'delete') this.spectators.delete(id);
      if (op === 'upsert') this.spectators.set(id, Array.isArray(data) ? data : []);
    }
  }

  runAsync(task, label) {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error(`[store:${label}] ${error.message}`);
      });
  }

  makeId(prefix) {
    return `${prefix}_${randomUUID()}`;
  }

  normalizePlayer(player) {
    const now = Date.now();
    return {
      id: player.id || this.makeId('p'),
      nickname: player.nickname || player.name || '玩家',
      name: player.name,
      busNumber: player.busNumber || '',
      points: Number(player.points ?? 1000),
      totalGames: Number(player.totalGames || 0),
      wins: Number(player.wins || 0),
      currentRoom: player.currentRoom || null,
      online: player.online !== false,
      createdAt: Number(player.createdAt || now),
      winStreak: Number(player.winStreak || 0),
      lossStreak: Number(player.lossStreak || 0),
      isBot: Boolean(player.isBot)
    };
  }

  addPlayer(player) {
    const normalized = this.normalizePlayer(player);
    this.players.set(normalized.id, normalized);
    this.savePlayer(normalized);
    return normalized;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.runAsync(async () => {
      await redisStore.hDel('players', playerId);
      await redisStore.publishStateEvent({ type: 'player', op: 'delete', id: playerId });
    }, 'removePlayer');
  }

  savePlayer(player) {
    if (!player) return;

    this.players.set(player.id, player);
    this.runAsync(async () => {
      await mysqlStore.upsertPlayer(player);
      await redisStore.hSetJson('players', player.id, player);
      await redisStore.publishStateEvent({ type: 'player', op: 'upsert', id: player.id, data: player });
    }, 'savePlayer');
  }

  saveRoom(room) {
    if (!room) return;

    this.rooms.set(room.id, room);
    this.runAsync(async () => {
      await redisStore.hSetJson('rooms', room.id, room);
      await redisStore.publishStateEvent({ type: 'room', op: 'upsert', id: room.id, data: room });
    }, 'saveRoom');
  }

  saveQueue(gameType) {
    const queue = this.matchQueue.get(gameType) || [];
    this.runAsync(async () => {
      await redisStore.hSetJson('queues', gameType, queue);
      await redisStore.publishStateEvent({ type: 'queue', op: 'upsert', id: gameType, data: queue });
    }, 'saveQueue');
  }

  saveSpectators(roomId) {
    const list = this.spectators.get(roomId) || [];
    this.runAsync(async () => {
      await redisStore.hSetJson('spectators', roomId, list);
      await redisStore.publishStateEvent({ type: 'spectator', op: 'upsert', id: roomId, data: list });
    }, 'saveSpectators');
  }

  async acquireLock(name, ttlMs = 5000) {
    const token = randomUUID();
    const acquired = await redisStore.acquireLock(name, token, ttlMs);
    if (!acquired) return null;

    return {
      release: () => redisStore.releaseLock(name, token)
    };
  }

  addSpectator(roomId, playerId) {
    if (!this.spectators.has(roomId)) {
      this.spectators.set(roomId, []);
    }
    const list = this.spectators.get(roomId);
    if (!list.includes(playerId)) {
      list.push(playerId);
      this.saveSpectators(roomId);
    }
  }

  removeSpectator(roomId, playerId) {
    const list = this.spectators.get(roomId);
    if (!list) return;

    const idx = list.indexOf(playerId);
    if (idx !== -1) {
      list.splice(idx, 1);
      this.saveSpectators(roomId);
    }
  }

  getSpectators(roomId) {
    return this.spectators.get(roomId) || [];
  }

  createPlayer(nickname, busNumber) {
    return this.addPlayer({
      id: this.makeId('p'),
      nickname,
      busNumber,
      points: 1000,
      totalGames: 0,
      wins: 0,
      currentRoom: null,
      online: true,
      createdAt: Date.now(),
      winStreak: 0,
      lossStreak: 0
    });
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  updatePoints(playerId, delta, reason = 'game', metadata = null) {
    const p = this.players.get(playerId);
    if (!p) return;

    const numericDelta = Number(delta || 0);
    p.points += numericDelta;
    this.savePlayer(p);
    this.runAsync(async () => {
      await mysqlStore.upsertPlayer(p);
      await mysqlStore.recordPointTransaction(playerId, numericDelta, reason, metadata);
    }, 'recordPointTransaction');
  }

  recordGame(playerId, won) {
    const p = this.players.get(playerId);
    if (!p) return;

    p.totalGames++;
    if (won === null) {
      p.winStreak = 0;
      p.lossStreak = 0;
      this.savePlayer(p);
      return;
    }

    if (won) {
      p.wins++;
      p.winStreak = (p.winStreak || 0) + 1;
      p.lossStreak = 0;
    } else {
      p.lossStreak = (p.lossStreak || 0) + 1;
      p.winStreak = 0;
    }
    this.savePlayer(p);
  }

  createRoom(gameType, players) {
    const id = this.makeId('r');
    const room = {
      id,
      gameType,
      players: players.map(p => p.id),
      status: 'waiting',
      gameState: null,
      createdAt: Date.now()
    };

    this.rooms.set(id, room);
    players.forEach((p) => {
      p.currentRoom = id;
      this.savePlayer(p);
    });
    this.saveRoom(room);
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id);
  }

  getPlayerRoom(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.currentRoom) return null;
    return this.rooms.get(player.currentRoom);
  }

  getRoomsForPlayer(playerId) {
    const rooms = [];
    for (const room of this.rooms.values()) {
      if (room.players.includes(playerId)) rooms.push(room);
    }
    return rooms;
  }

  removeRoom(id) {
    const room = this.rooms.get(id);
    if (!room) return;

    room.players.forEach((pid) => {
      const p = this.players.get(pid);
      if (p) {
        p.currentRoom = null;
        this.savePlayer(p);
      }
    });
    this.rooms.delete(id);

    this.runAsync(async () => {
      await redisStore.hDel('rooms', id);
      await redisStore.hDel('spectators', id);
      await redisStore.publishStateEvent({ type: 'room', op: 'delete', id });
      await redisStore.publishStateEvent({ type: 'spectator', op: 'delete', id });
    }, 'removeRoom');
  }

  enqueue(playerId, gameType) {
    if (!this.matchQueue.has(gameType)) {
      this.matchQueue.set(gameType, []);
    }
    const queue = this.matchQueue.get(gameType);
    if (!queue.includes(playerId)) {
      queue.push(playerId);
      this.saveQueue(gameType);
    }
  }

  dequeue(playerId) {
    for (const [gameType, queue] of this.matchQueue) {
      const idx = queue.indexOf(playerId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        this.saveQueue(gameType);
        return gameType;
      }
    }
    return null;
  }

  getQueue(gameType) {
    return this.matchQueue.get(gameType) || [];
  }

  getPersonalLeaderboard(topN = 50) {
    const all = Array.from(this.players.values()).filter((p) => !p.isBot);
    all.sort((a, b) => b.points - a.points);
    return all.slice(0, topN).map((p, i) => ({
      rank: i + 1,
      id: p.id,
      nickname: p.nickname,
      busNumber: p.busNumber,
      points: p.points,
      wins: p.wins,
      totalGames: p.totalGames
    }));
  }

  getBusLeaderboard() {
    const busMap = new Map();
    for (const p of this.players.values()) {
      if (p.isBot) continue;
      if (!busMap.has(p.busNumber)) {
        busMap.set(p.busNumber, { totalPoints: 0, count: 0 });
      }
      const bus = busMap.get(p.busNumber);
      bus.totalPoints += p.points;
      bus.count++;
    }
    const result = Array.from(busMap.entries()).map(([bus, data]) => ({
      busNumber: bus,
      avgPoints: Math.round(data.totalPoints / data.count),
      totalPlayers: data.count
    }));
    result.sort((a, b) => b.avgPoints - a.avgPoints);
    return result.map((b, i) => ({ ...b, rank: i + 1 }));
  }

  getStats() {
    let online = 0;
    for (const p of this.players.values()) {
      if (!p.isBot && p.online) online++;
    }
    return {
      totalPlayers: Array.from(this.players.values()).filter((p) => !p.isBot).length,
      onlinePlayers: online,
      activeRooms: this.rooms.size
    };
  }
}

module.exports = new Store();
