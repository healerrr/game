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

      if (validPlayers.length < config.minPlayers) continue;

      validPlayers.sort((a, b) => {
        const pa = store.getPlayer(a);
        const pb = store.getPlayer(b);
        return (pa ? pa.points : 0) - (pb ? pb.points : 0);
      });

      const matched = [];
      const players = validPlayers.map(id => store.getPlayer(id)).filter(Boolean);

      for (let i = 0; i < players.length && matched.length < config.maxPlayers; i++) {
        if (matched.length === 0) {
          matched.push(players[i]);
        } else {
          const lastPoints = matched[matched.length - 1].points;
          if (Math.abs(players[i].points - lastPoints) <= 200) {
            matched.push(players[i]);
          }
        }
        if (matched.length >= config.minPlayers && matched.length <= config.maxPlayers) {
          break;
        }
      }

      if (matched.length >= config.minPlayers) {
        matched.forEach(p => {
          const idx = queue.indexOf(p.id);
          if (idx !== -1) queue.splice(idx, 1);
        });
        store.saveQueue(gameType);

        results.push({ gameType, players: matched });
      }
    }

    return results;
  } finally {
    await lock.release();
  }
}

module.exports = { tryMatch };
