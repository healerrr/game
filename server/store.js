// 内存数据存储 - 轻量级、无依赖
// 70人规模完全够用，后期可迁移到 SQLite/PostgreSQL

class Store {
  constructor() {
    this.players = new Map();       // id → player
    this.rooms = new Map();         // id → room
    this.matchQueue = new Map();    // gameType → [playerId, ...]
    this.spectators = new Map();    // roomId → [playerId, ...]
    this.playerCounter = 0;
    this.roomCounter = 0;
  }

  // 观战者操作
  addSpectator(roomId, playerId) {
    if (!this.spectators.has(roomId)) {
      this.spectators.set(roomId, []);
    }
    const list = this.spectators.get(roomId);
    if (!list.includes(playerId)) {
      list.push(playerId);
    }
  }

  removeSpectator(roomId, playerId) {
    const list = this.spectators.get(roomId);
    if (list) {
      const idx = list.indexOf(playerId);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  getSpectators(roomId) {
    return this.spectators.get(roomId) || [];
  }

  // 玩家操作
  createPlayer(nickname, busNumber) {
    const id = `p_${++this.playerCounter}`;
    const player = {
      id,
      nickname,
      busNumber,
      points: 500,
      totalGames: 0,
      wins: 0,
      currentRoom: null,
      online: true,
      createdAt: Date.now()
    };
    this.players.set(id, player);
    return player;
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  updatePoints(playerId, delta) {
    const p = this.players.get(playerId);
    if (p) {
      p.points += delta;
      // 允许负分，不设下限
    }
  }

  recordGame(playerId, won) {
    const p = this.players.get(playerId);
    if (p) {
      p.totalGames++;
      if (won) p.wins++;
    }
  }

  // 房间操作
  createRoom(gameType, players) {
    const id = `r_${++this.roomCounter}`;
    const room = {
      id,
      gameType,
      players: players.map(p => p.id),
      status: 'waiting', // waiting | playing | finished
      gameState: null,
      createdAt: Date.now()
    };
    this.rooms.set(id, room);
    // 标记玩家当前房间
    players.forEach(p => {
      p.currentRoom = id;
    });
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
    if (room) {
      room.players.forEach(pid => {
        const p = this.players.get(pid);
        if (p) p.currentRoom = null;
      });
      this.rooms.delete(id);
    }
  }

  // 匹配队列
  enqueue(playerId, gameType) {
    if (!this.matchQueue.has(gameType)) {
      this.matchQueue.set(gameType, []);
    }
    const queue = this.matchQueue.get(gameType);
    if (!queue.includes(playerId)) {
      queue.push(playerId);
    }
  }

  dequeue(playerId) {
    for (const [gameType, queue] of this.matchQueue) {
      const idx = queue.indexOf(playerId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        return gameType;
      }
    }
    return null;
  }

  getQueue(gameType) {
    return this.matchQueue.get(gameType) || [];
  }

  // 排行榜
  getPersonalLeaderboard(topN = 50) {
    const all = Array.from(this.players.values());
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
    const busMap = new Map(); // busNumber → { totalPoints, count }
    for (const p of this.players.values()) {
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

  // 统计
  getStats() {
    let online = 0;
    for (const p of this.players.values()) {
      if (p.online) online++;
    }
    return {
      totalPlayers: this.players.size,
      onlinePlayers: online,
      activeRooms: this.rooms.size
    };
  }
}

module.exports = new Store();
