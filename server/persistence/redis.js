const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'busgame';
const STATE_CHANNEL = `${KEY_PREFIX}:state-events`;
const TRANSIENT_TTL_SECONDS = Number(process.env.REDIS_TRANSIENT_TTL_SECONDS || 86400);

let commandClient = null;
let socketPubClient = null;
let socketSubClient = null;
let stateSubClient = null;
let instanceId = null;

function hasRedisConfig() {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function buildRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';
  const username = process.env.REDIS_USERNAME ? encodeURIComponent(process.env.REDIS_USERNAME) : '';
  const password = process.env.REDIS_PASSWORD ? encodeURIComponent(process.env.REDIS_PASSWORD) : '';
  const auth = username || password
    ? `${username}${password ? `:${password}` : ''}@`
    : '';
  const db = process.env.REDIS_DB ? `/${process.env.REDIS_DB}` : '';

  return `redis://${auth}${host}:${port}${db}`;
}

function attachErrorLogger(client, label) {
  client.on('error', (error) => {
    console.error(`[redis:${label}] ${error.message}`);
  });
}

async function initRedis(id, onStateEvent) {
  if (!hasRedisConfig()) return false;

  instanceId = id;

  commandClient = createClient({ url: buildRedisUrl() });
  socketPubClient = commandClient.duplicate();
  socketSubClient = commandClient.duplicate();
  stateSubClient = commandClient.duplicate();

  attachErrorLogger(commandClient, 'command');
  attachErrorLogger(socketPubClient, 'socket-pub');
  attachErrorLogger(socketSubClient, 'socket-sub');
  attachErrorLogger(stateSubClient, 'state-sub');

  await Promise.all([
    commandClient.connect(),
    socketPubClient.connect(),
    socketSubClient.connect(),
    stateSubClient.connect()
  ]);

  await stateSubClient.subscribe(STATE_CHANNEL, (message) => {
    try {
      const event = JSON.parse(message);
      if (!event || event.source === instanceId) return;
      onStateEvent(event);
    } catch (error) {
      console.error(`[redis:state-sub] Failed to parse state event: ${error.message}`);
    }
  });

  return true;
}

function isEnabled() {
  return Boolean(commandClient?.isOpen);
}

function hashKey(name) {
  return `${KEY_PREFIX}:${name}`;
}

function lockKey(name) {
  return `${KEY_PREFIX}:lock:${name}`;
}

async function hSetJson(hashName, id, value) {
  if (!isEnabled()) return;
  const key = hashKey(hashName);
  await commandClient.hSet(key, id, JSON.stringify(value));
  if (TRANSIENT_TTL_SECONDS > 0) {
    await commandClient.expire(key, TRANSIENT_TTL_SECONDS);
  }
}

async function hDel(hashName, id) {
  if (!isEnabled()) return;
  await commandClient.hDel(hashKey(hashName), id);
}

async function hGetAllJson(hashName) {
  if (!isEnabled()) return new Map();
  const raw = await commandClient.hGetAll(hashKey(hashName));
  const result = new Map();

  for (const [id, value] of Object.entries(raw)) {
    try {
      result.set(id, JSON.parse(value));
    } catch (error) {
      console.error(`[redis] Failed to parse ${hashName}:${id}: ${error.message}`);
    }
  }

  return result;
}

async function publishStateEvent(event) {
  if (!isEnabled()) return;
  await commandClient.publish(STATE_CHANNEL, JSON.stringify({ ...event, source: instanceId }));
}

async function acquireLock(name, token, ttlMs) {
  if (!isEnabled()) return true;
  const result = await commandClient.set(lockKey(name), token, {
    NX: true,
    PX: ttlMs
  });
  return result === 'OK';
}

async function releaseLock(name, token) {
  if (!isEnabled()) return;
  await commandClient.eval(
    `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `,
    {
      keys: [lockKey(name)],
      arguments: [token]
    }
  );
}

function getSocketAdapter() {
  if (!isEnabled()) return null;
  return createAdapter(socketPubClient, socketSubClient);
}

async function closeRedis() {
  const clients = [stateSubClient, socketSubClient, socketPubClient, commandClient].filter(Boolean);
  await Promise.allSettled(clients.map((client) => client.quit()));
  commandClient = null;
  socketPubClient = null;
  socketSubClient = null;
  stateSubClient = null;
}

module.exports = {
  initRedis,
  isEnabled,
  hSetJson,
  hDel,
  hGetAllJson,
  publishStateEvent,
  acquireLock,
  releaseLock,
  getSocketAdapter,
  closeRedis
};
