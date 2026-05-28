const mysql = require('mysql2/promise');

let pool = null;

function hasMysqlConfig() {
  return Boolean(process.env.MYSQL_URL || process.env.MYSQL_HOST);
}

function getMysqlConfig() {
  if (process.env.MYSQL_URL) {
    return {
      uri: process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      charset: 'utf8mb4'
    };
  }

  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'bus_game',
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    charset: 'utf8mb4'
  };
}

async function initMysql() {
  if (!hasMysqlConfig()) return false;

  if (!process.env.MYSQL_URL) {
    await ensureDatabaseExists();
  }

  pool = mysql.createPool(getMysqlConfig());
  await ensureSchema();
  return true;
}

function escapeIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

async function ensureDatabaseExists() {
  const config = getMysqlConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4'
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(config.database)}
       DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

async function ensureSchema() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id VARCHAR(80) NOT NULL PRIMARY KEY,
      nickname VARCHAR(80) NOT NULL,
      bus_number VARCHAR(32) NOT NULL,
      points INT NOT NULL DEFAULT 1000,
      total_games INT NOT NULL DEFAULT 0,
      wins INT NOT NULL DEFAULT 0,
      win_streak INT NOT NULL DEFAULT 0,
      loss_streak INT NOT NULL DEFAULT 0,
      current_room VARCHAR(80) NULL,
      online TINYINT(1) NOT NULL DEFAULT 0,
      is_bot TINYINT(1) NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      INDEX idx_players_points (points),
      INDEX idx_players_bus_number (bus_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(80) NOT NULL,
      delta_points INT NOT NULL,
      reason VARCHAR(120) NOT NULL,
      metadata JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_point_transactions_player (player_id),
      INDEX idx_point_transactions_created_at (created_at),
      CONSTRAINT fk_point_transactions_player
        FOREIGN KEY (player_id) REFERENCES players(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function isEnabled() {
  return Boolean(pool);
}

function rowToPlayer(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    busNumber: row.bus_number,
    points: Number(row.points || 0),
    totalGames: Number(row.total_games || 0),
    wins: Number(row.wins || 0),
    winStreak: Number(row.win_streak || 0),
    lossStreak: Number(row.loss_streak || 0),
    currentRoom: null,
    online: false,
    isBot: Boolean(row.is_bot),
    createdAt: Number(row.created_at || Date.now())
  };
}

async function loadPlayers() {
  if (!pool) return [];
  const [rows] = await pool.query('SELECT * FROM players WHERE is_bot = 0');
  return rows.map(rowToPlayer);
}

async function upsertPlayer(player) {
  if (!pool || !player || player.isBot) return;

  const now = Date.now();
  await pool.execute(
    `
      INSERT INTO players (
        id, nickname, bus_number, points, total_games, wins,
        win_streak, loss_streak, current_room, online, is_bot,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        bus_number = VALUES(bus_number),
        points = VALUES(points),
        total_games = VALUES(total_games),
        wins = VALUES(wins),
        win_streak = VALUES(win_streak),
        loss_streak = VALUES(loss_streak),
        current_room = VALUES(current_room),
        online = VALUES(online),
        updated_at = VALUES(updated_at)
    `,
    [
      player.id,
      player.nickname || player.name || '玩家',
      String(player.busNumber || ''),
      Number(player.points || 0),
      Number(player.totalGames || 0),
      Number(player.wins || 0),
      Number(player.winStreak || 0),
      Number(player.lossStreak || 0),
      player.currentRoom || null,
      player.online ? 1 : 0,
      player.isBot ? 1 : 0,
      Number(player.createdAt || now),
      now
    ]
  );
}

async function recordPointTransaction(playerId, delta, reason = 'game', metadata = null) {
  if (!pool || !playerId || String(playerId).startsWith('bot_')) return;

  await pool.execute(
    `
      INSERT INTO point_transactions (player_id, delta_points, reason, metadata)
      VALUES (?, ?, ?, ?)
    `,
    [
      playerId,
      Number(delta || 0),
      String(reason || 'game'),
      metadata ? JSON.stringify(metadata) : null
    ]
  );
}

async function closeMysql() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  initMysql,
  isEnabled,
  loadPlayers,
  upsertPlayer,
  recordPointTransaction,
  closeMysql
};
