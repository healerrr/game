const { io } = require('../client/node_modules/socket.io-client');
const { BotStrategy } = require('../server/bots');
const fs = require('fs');
const path = require('path');

const SERVER = process.env.QA_SERVER || 'http://127.0.0.1:3457';
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const reportPath = path.join(__dirname, `qa-8games-mobile-bots-${runId}.json`);

const games = [
  { key: 'rock_paper_scissors', name: '剪刀石头布', players: 2, expectedZeroSum: true },
  { key: 'quiz', name: '快问快答', players: 4, expectedZeroSum: false },
  { key: 'gomoku', name: '五子棋', players: 2, expectedZeroSum: true },
  { key: 'chess', name: '象棋', players: 2, expectedZeroSum: true },
  { key: 'doudizhu', name: '斗地主', players: 3, expectedZeroSum: true },
  { key: 'guandan', name: '掼蛋', players: 4, expectedZeroSum: true },
  { key: 'zha_jin_hua', name: '炸金花', players: 5, expectedZeroSum: true },
  { key: 'mahjong', name: '红中麻将', players: 4, expectedZeroSum: true }
];

const botProfiles = [
  { nickname: `QA手机机器人-甲-${runId}`, busNumber: 1 },
  { nickname: `QA手机机器人-乙-${runId}`, busNumber: 2 },
  { nickname: `QA手机机器人-丙-${runId}`, busNumber: 3 },
  { nickname: `QA手机机器人-丁-${runId}`, busNumber: 4 }
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res = {}) => resolve(res));
  });
}

async function connectUser(profile) {
  const socket = io(SERVER, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    auth: { client: 'mobile-web-qa' }
  });

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  const user = {
    socket,
    profile,
    player: null,
    room: null,
    latestState: null,
    started: false,
    result: null,
    errors: []
  };

  socket.on('room:update', room => {
    user.room = room;
    user.latestState = room?.gameState || user.latestState;
  });
  socket.on('room:started', room => {
    user.room = room;
    user.latestState = room?.gameState || user.latestState;
    user.started = true;
  });
  socket.on('game:matched', room => {
    user.room = room;
    user.latestState = room?.gameState || user.latestState;
  });
  socket.on('game:state', data => {
    user.latestState = data?.gameState || user.latestState;
    user.room = data?.room || user.room;
  });
  socket.on('game:result', data => {
    user.result = data;
    user.latestState = data?.room?.gameState || user.latestState;
    user.room = data?.room || user.room;
  });
  socket.on('connect_error', error => user.errors.push(error.message));
  socket.on('error', error => user.errors.push(String(error?.message || error)));

  const res = await emitAck(socket, 'player:register', profile);
  if (res.error) throw new Error(`${profile.nickname} register failed: ${res.error}`);
  user.player = res.player;
  user.room = res.currentRoom || null;
  return user;
}

async function getAdminPlayers() {
  const res = await fetch(`${SERVER}/api/admin/players`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `admin players failed: ${res.status}`);
  return data.players || [];
}

function pointSnapshot(adminPlayers, participants) {
  const map = new Map(adminPlayers.map(player => [player.id, player]));
  return Object.fromEntries(participants.map(user => [
    user.player.id,
    {
      nickname: user.player.nickname,
      points: Number(map.get(user.player.id)?.points ?? user.player.points ?? 0)
    }
  ]));
}

async function waitFor(condition, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = condition();
    if (value) return value;
    await delay(100);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

function selectActorId(gameType, state, playerIds) {
  if (!state) return null;

  if (gameType === 'guandan' && state.phase === 'round_finished') {
    return '__NEXT_ROUND__';
  }

  if (gameType === 'chess') {
    if (state.phase !== 'playing') return null;
    if (state.currentPlayer === 'red') return state.players?.[0] || playerIds[0] || null;
    if (state.currentPlayer === 'black') return state.players?.[1] || playerIds[1] || null;
    return state.currentPlayer || null;
  }

  if (gameType === 'rock_paper_scissors') {
    if (state.phase === 'reveal') return '__NEXT_ROUND__';
    return playerIds.find(id => !state.choices?.[id]) || null;
  }

  if (gameType === 'quiz') {
    if (state.phase === 'answer') return '__NEXT_ROUND__';
    if (state.phase !== 'question') return null;
    return playerIds.find(id => !state.answeredPlayers?.includes(id)) || null;
  }

  if (gameType === 'zha_jin_hua') {
    if (state.phase === 'look') {
      return state.activePlayers?.find(id => playerIds.includes(id) && !state.actedThisRound?.includes(id)) || null;
    }
    if (state.phase === 'bet') return state.currentPlayer;
    return null;
  }

  if (gameType === 'mahjong') {
    if (state.phase === 'response') {
      if (state.pendingAction?.type === 'self') return state.pendingAction.playerId;
      return state.pendingAction?.queue?.[0]?.playerId || null;
    }
    return state.currentPlayer || null;
  }

  return state.currentPlayer || null;
}

function fallbackAction(gameType, state, actorId) {
  if (gameType === 'rock_paper_scissors') {
    return { type: 'choose', choice: ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)] };
  }
  if (gameType === 'quiz') {
    return { type: 'answer', answer: 0 };
  }
  if (gameType === 'zha_jin_hua') {
    if (state.phase === 'look') return { type: 'look' };
    return { type: 'call' };
  }
  if (gameType === 'mahjong') {
    const hand = state.hands?.[actorId] || [];
    if (state.phase === 'discard' && hand.length) return { type: 'discard', tile: hand[hand.length - 1] };
    return { type: 'pass' };
  }
  return null;
}

function getAction(gameType, state, actorId) {
  const strategy = BotStrategy[gameType];
  return (strategy && strategy(state, actorId)) || fallbackAction(gameType, state, actorId);
}

function summarizePointDelta(before, after) {
  const deltas = {};
  let total = 0;
  for (const [id, info] of Object.entries(before)) {
    const delta = Number(after[id]?.points ?? info.points) - Number(info.points);
    deltas[id] = {
      nickname: info.nickname,
      before: Number(info.points),
      after: Number(after[id]?.points ?? info.points),
      delta
    };
    total += delta;
  }
  return { deltas, totalDelta: total };
}

async function runGame(game, users, spectator) {
  const participants = users.slice(0, game.players);
  const owner = participants[0];
  const notes = [];
  const spectatorEvents = [];

  for (const user of [...participants, spectator]) {
    user.room = null;
    user.latestState = null;
    user.started = false;
    user.result = null;
    user.errors = [];
  }

  const before = pointSnapshot(await getAdminPlayers(), participants);
  const createRes = await emitAck(owner.socket, 'room:create', { gameType: game.key });
  if (createRes.error) throw new Error(`${game.name} create failed: ${createRes.error}`);
  owner.room = createRes.room;
  const roomId = createRes.room.roomId || createRes.room.id;

  for (const user of participants.slice(1)) {
    const inviteRes = await emitAck(owner.socket, 'room:invite', { roomId, playerId: user.player.id });
    if (inviteRes.error) throw new Error(`${game.name} invite ${user.player.nickname} failed: ${inviteRes.error}`);
    const acceptRes = await emitAck(user.socket, 'room:invite:accept', { roomId });
    if (acceptRes.error) throw new Error(`${game.name} accept ${user.player.nickname} failed: ${acceptRes.error}`);
    user.room = acceptRes.room;
  }

  const joinRes = await emitAck(spectator.socket, 'spectator:join', { roomId });
  if (joinRes.error) {
    notes.push(`观战加入失败：${joinRes.error}`);
  } else {
    spectatorEvents.push({ event: 'spectator:join', phase: joinRes.gameState?.phase || null, playerCount: joinRes.players?.length || 0 });
  }

  for (const user of participants) {
    const readyRes = await emitAck(user.socket, 'room:ready', { ready: true });
    if (readyRes.error) throw new Error(`${game.name} ready ${user.player.nickname} failed: ${readyRes.error}`);
  }

  await waitFor(() => participants.every(user => user.started || user.room?.status === 'playing'), 8000, `${game.name} start`);

  const stateTrace = [];
  const startedAt = Date.now();
  let actions = 0;
  let stalls = 0;
  let lastPhase = '';
  let lastActor = '';
  let lastActionAt = Date.now();
  const playerIds = participants.map(user => user.player.id);

  while (!participants[0].result && Date.now() - startedAt < 90000 && actions < 700) {
    const state = participants.find(user => user.latestState)?.latestState || participants[0].latestState;
    if (!state) {
      await delay(100);
      continue;
    }
    const phaseKey = `${state.phase}:${state.currentPlayer || ''}:${JSON.stringify(state.pendingAction || null)}`;
    if (phaseKey !== lastPhase) {
      stateTrace.push({
        t: Date.now() - startedAt,
        phase: state.phase,
        currentPlayer: state.currentPlayer || null,
        round: state.round || null,
        pot: state.pot || null
      });
      lastPhase = phaseKey;
    }

    if (state.phase === 'finished') break;

    const actorId = selectActorId(game.key, state, playerIds);
    if (!actorId) {
      stalls += 1;
      await delay(150);
      if (Date.now() - lastActionAt > 5000) notes.push(`等待动作超过 5 秒：phase=${state.phase}`);
      continue;
    }

    if (actorId === '__NEXT_ROUND__') {
      owner.socket.emit('game:action', { action: { type: 'next_round' } });
      actions += 1;
      lastActionAt = Date.now();
      await delay(120);
      continue;
    }

    const actor = participants.find(user => user.player.id === actorId);
    if (!actor) {
      notes.push(`找不到当前行动玩家：${actorId}`);
      await delay(150);
      continue;
    }

    const actorState = actor.latestState || state;
    const action = getAction(game.key, actorState, actorId);
    if (!action) {
      stalls += 1;
      if (actorId !== lastActor || Date.now() - lastActionAt > 2500) {
        notes.push(`策略未产出动作：phase=${actorState.phase}, actor=${actor.player.nickname}`);
      }
      lastActor = actorId;
      await delay(180);
      continue;
    }

    actor.socket.emit('game:action', { action });
    actions += 1;
    lastActor = actorId;
    lastActionAt = Date.now();
    await delay(140);
  }

  const finished = Boolean(participants[0].result || participants[0].latestState?.phase === 'finished');
  if (!finished) notes.push(`90 秒或 700 步内未完成，当前 phase=${participants[0].latestState?.phase || 'unknown'}`);

  await delay(500);
  const after = pointSnapshot(await getAdminPlayers(), participants);
  const pointSummary = summarizePointDelta(before, after);
  const result = participants[0].result || null;
  const winners = result?.winningPlayers || (result?.winner ? [result.winner] : []);

  if (finished && game.expectedZeroSum && pointSummary.totalDelta !== 0) {
    notes.push(`积分非零和：合计变化 ${pointSummary.totalDelta}`);
  }
  if (finished && !Object.values(pointSummary.deltas).some(item => item.delta !== 0)) {
    notes.push('游戏结束后参与者积分均未变化');
  }

  return {
    game: game.key,
    name: game.name,
    roomId,
    participantCount: participants.length,
    participants: participants.map(user => ({
      id: user.player.id,
      nickname: user.player.nickname,
      busNumber: user.player.busNumber
    })),
    finished,
    actions,
    stalls,
    durationMs: Date.now() - startedAt,
    finalPhase: participants[0].latestState?.phase || null,
    winners,
    pointSummary,
    stateTrace: stateTrace.slice(0, 60),
    spectatorEvents,
    socketErrors: participants.flatMap(user => user.errors.map(error => `${user.player.nickname}: ${error}`)),
    notes
  };
}

async function main() {
  const requestedGames = new Set(String(process.env.QA_GAMES || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean));
  const gamesToRun = requestedGames.size
    ? games.filter(game => requestedGames.has(game.key))
    : games;

  const report = {
    runId,
    server: SERVER,
    startedAt: new Date().toISOString(),
    botProfiles,
    games: [],
    fatalErrors: []
  };

  try {
    for (const game of gamesToRun) {
      const gameUsers = [];
      let spectator = null;
      try {
        const profiles = botProfiles.map(profile => ({
          ...profile,
          nickname: `${profile.nickname}-${game.key}`
        }));
        while (profiles.length < game.players) {
          profiles.push({
            nickname: `QA手机机器人-补位${profiles.length + 1}-${runId}-${game.key}`,
            busNumber: 5
          });
        }
        for (const profile of profiles) {
          gameUsers.push(await connectUser(profile));
        }
        spectator = await connectUser({ nickname: `QA观战专家-${runId}-${game.key}`, busNumber: 9 });

        console.log(`[QA] start ${game.name}`);
        const result = await withTimeout(runGame(game, gameUsers, spectator), 120000, game.name);
        report.games.push(result);
        console.log(`[QA] done ${game.name}: finished=${result.finished}, totalDelta=${result.pointSummary.totalDelta}`);
      } catch (error) {
        report.games.push({
          game: game.key,
          name: game.name,
          finished: false,
          error: error.message
        });
        console.log(`[QA] failed ${game.name}: ${error.message}`);
      } finally {
        for (const user of gameUsers) user.socket.disconnect();
        if (spectator) spectator.socket.disconnect();
      }

      await delay(1000);
    }
  } catch (error) {
    report.fatalErrors.push(error.message);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    report.reportPath = reportPath;
    console.log(JSON.stringify(report, null, 2));
  }
}

main();
