// 匹配引擎 - 检查队列并尝试配对
const store = require('./store');
const { getGameConfig } = require('./game-engine');

async function tryMatch() {
  const lock = await store.acquireLock('matchmaker', 1800);
  if (!lock) return [];

  const results = [];

  try {
    for (const [gameType, queue] of store.matchQueue) {
      const config = getGameConfig(gameType);
      if (!config) continue;

      const validPlayers = queue.filter(pid => {
        const p = store.getPlayer(pid);
        return p && p.online && !p.currentRoom;
      });

      const roomSize = config.maxPlayers || config.minPlayers;
      if (validPlayers.length < roomSize) {
        const staleIds = queue.filter(pid => !validPlayers.includes(pid));
        if (staleIds.length > 0) {
          staleIds.forEach(pid => {
            const idx = queue.indexOf(pid);
            if (idx !== -1) queue.splice(idx, 1);
          });
          store.saveQueue(gameType);
        }
        continue;
      }

      const players = validPlayers.map(id => store.getPlayer(id)).filter(Boolean);
      while (players.length >= roomSize) {
        const matched = players.splice(0, roomSize);
        matched.forEach(p => {
          const idx = queue.indexOf(p.id);
          if (idx !== -1) queue.splice(idx, 1);
        });
        results.push({ gameType, players: matched });
      }

      store.saveQueue(gameType);
    }

    return results;
  } finally {
    await lock.release();
  }
}

module.exports = { tryMatch };
