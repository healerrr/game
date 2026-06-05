const path = require('path');
const { test } = require('@playwright/test');

const BASE_URL = 'http://8.154.39.1:3006/';
const SOCKET_IO_CLIENT = path.join(
  __dirname,
  'client',
  'node_modules',
  'socket.io-client',
  'dist',
  'socket.io.js'
);

const GAMES = [
  { key: 'reaction_race', players: 4, timeoutMs: 60000 },
  { key: 'dice_roll', players: 4, timeoutMs: 60000 },
  { key: 'guess_dice', players: 4, timeoutMs: 60000 },
  { key: 'rock_paper_scissors', players: 2, timeoutMs: 60000 },
  { key: 'quiz', players: 4, timeoutMs: 90000 },
  { key: 'blackjack', players: 4, timeoutMs: 60000 },
  { key: 'gomoku', players: 2, timeoutMs: 60000 },
  { key: 'chess', players: 2, timeoutMs: 60000 },
  { key: 'zha_jin_hua', players: 4, timeoutMs: 70000 },
  { key: 'doudizhu', players: 3, timeoutMs: 120000 },
  { key: 'mahjong', players: 4, timeoutMs: 180000 },
  { key: 'guandan', players: 4, timeoutMs: 600000 }
];

const SELECTED_GAMES = process.env.ONLY_GAME
  ? GAMES.filter((game) => game.key === process.env.ONLY_GAME)
  : GAMES;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function emit(player, event, payload = {}) {
  const response = await player.page.evaluate(
    ({ event, payload }) => window.__pwEmit(event, payload),
    { event, payload }
  );
  if (response?.foldedOut) player.active = false;
  return response;
}

async function snapshot(player) {
  return player.page.evaluate(() => window.__pwSnapshot());
}

async function snapshots(players) {
  return Promise.all(players.map(snapshot));
}

function roomIdOf(room) {
  return room?.roomId || room?.id;
}

function roomHasPlayer(room, playerId) {
  return Boolean(room?.players?.some((item) => item === playerId || item?.id === playerId));
}

async function waitFor(players, description, predicate, timeoutMs = 30000) {
  const start = Date.now();
  let last = [];
  while (Date.now() - start < timeoutMs) {
    last = await snapshots(players);
    if (predicate(last)) return last;
    await sleep(250);
  }
  throw new Error(`${description} timed out. Last state: ${JSON.stringify(last.map(s => ({
    player: s.player?.nickname,
    roomStatus: s.room?.status,
    gamePhase: s.game?.phase,
    gameStage: s.game?.stage,
    currentPlayer: s.game?.currentPlayer,
    events: s.events?.slice(-5)
  })))}`);
}

async function createPlayer(browser, runId, gameKey, index) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  const label = `${gameKey}#${index + 1}`;

  page.on('pageerror', (error) => {
    console.log(`[pageerror:${label}] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    console.log(`[requestfailed:${label}] ${request.method()} ${request.url()} ${failure?.errorText || ''}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addScriptTag({ path: SOCKET_IO_CLIENT });
  const nickname = `PW-${runId}-${gameKey}-${index + 1}`;
  const busNumber = (index % 4) + 1;

  const playerInfo = await page.evaluate(
    async ({ nickname, busNumber }) => {
      const state = {
        player: null,
        room: null,
        game: null,
        events: [],
        responses: []
      };
      window.__pwState = state;

      const socket = window.io(window.location.origin, {
        reconnection: false,
        transports: ['websocket', 'polling']
      });
      window.__pwSocket = socket;

      function remember(event, data) {
        const room = event === 'game:state' ? data?.room : data;
        const game = event === 'game:state' ? data?.gameState : data?.gameState;
        if (room) state.room = room;
        if (game) state.game = game;
        if (event === 'game:result' && data?.room) {
          state.room = data.room;
          state.game = data.room.gameState || state.game;
        }
        state.events.push({
          event,
          roomStatus: state.room?.status,
          phase: state.game?.phase,
          stage: state.game?.stage,
          currentPlayer: state.game?.currentPlayer,
          at: Date.now()
        });
        if (state.events.length > 80) state.events.shift();
      }

      ['game:matched', 'room:update', 'room:started', 'game:state', 'game:result', 'room:kicked', 'room:left', 'match:requeued', 'room:abandoned']
        .forEach((event) => socket.on(event, (data) => remember(event, data)));

      window.__pwEmit = (event, payload = {}) => new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          resolve({ error: `emit_timeout:${event}` });
        }, 30000);
        socket.emit(event, payload, (response = {}) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          state.responses.push({ event, response, at: Date.now() });
          if (response.room) {
            state.room = response.room;
            state.game = response.room.gameState || state.game;
          }
          if (response.player) state.player = response.player;
          if (state.responses.length > 120) state.responses.shift();
          resolve(response);
        });
      });

      window.__pwSnapshot = () => ({
        player: state.player,
        room: state.room,
        game: state.game,
        events: state.events,
        responses: state.responses,
        connected: socket.connected
      });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('socket connect timeout')), 10000);
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once('connect_error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      const registered = await window.__pwEmit('player:register', { nickname, busNumber });
      if (registered.error) throw new Error(registered.error);
      state.player = registered.player;
      state.room = registered.currentRoom || null;
      state.game = registered.currentRoom?.gameState || null;
      return registered.player;
    },
    { nickname, busNumber }
  );

  return { context, page, nickname, playerInfo, active: true };
}

async function setupRoom(browser, game, runId) {
  const players = [];
  for (let i = 0; i < game.players; i += 1) {
    players.push(await createPlayer(browser, runId, game.key, i));
  }

  const created = await emit(players[0], 'room:create', { gameType: game.key });
  if (created.error) throw new Error(`${game.key}: room:create failed: ${created.error}`);
  const roomId = roomIdOf(created.room);
  await emit(players[0], 'room:join', { roomId });

  for (let i = 1; i < players.length; i += 1) {
    const invited = await emit(players[0], 'room:invite', {
      roomId,
      playerId: players[i].playerInfo.id
    });
    if (invited.error) throw new Error(`${game.key}: invite player ${i + 1} failed: ${invited.error}`);

    const accepted = await emit(players[i], 'room:invite:accept', { roomId });
    if (accepted.error) throw new Error(`${game.key}: accept invite player ${i + 1} failed: ${accepted.error}`);
    await emit(players[i], 'room:join', { roomId });
  }

  for (const player of players) {
    const ready = await emit(player, 'room:ready', { ready: true });
    if (ready.error) throw new Error(`${game.key}: room:ready failed: ${ready.error}`);
  }

  await waitFor(
    players,
    `${game.key}: game start`,
    (items) => items.some((item) => item.room?.status === 'playing' && item.game?.phase),
    30000
  );

  return players;
}

function playerIndexById(players, playerId) {
  return players.findIndex((player) => player.playerInfo.id === playerId);
}

function findPlayerById(players, playerId) {
  return players.find((player) => player.playerInfo.id === playerId) || null;
}

function publicState(snaps, players) {
  return snaps.find((snap, index) => (
    snap.game &&
    snap.room?.status === 'playing' &&
    roomHasPlayer(snap.room, players[index]?.playerInfo.id)
  ))?.game
    || snaps.find((snap) => snap.game && snap.room?.status === 'playing')?.game
    || snaps.find((snap) => snap.game)?.game
    || null;
}

function actionForPlayer(gameKey, player, index, state) {
  const id = player.playerInfo.id;
  if (player.active === false) return null;
  if (!state || state.phase === 'finished') return null;

  if (gameKey === 'reaction_race') {
    if (state.phase === 'go' && !state.clicks?.[id] && !(state.falseStarts || []).includes(id)) {
      return { type: 'tap' };
    }
    return null;
  }

  if (gameKey === 'dice_roll') {
    if (['rolling', 'tiebreak'].includes(state.phase) && (state.activePlayers || []).includes(id) && !state.rolls?.[id]) {
      return { type: 'roll' };
    }
    return null;
  }

  if (gameKey === 'guess_dice') {
    if (state.phase === 'guessing' && !state.guesses?.[id]) {
      return { type: 'guess', guess: (index % 6) + 1 };
    }
    return null;
  }

  if (gameKey === 'rock_paper_scissors') {
    if (state.phase === 'choose' && !state.choices?.[id]) {
      return { type: 'choose', choice: ['rock', 'paper', 'scissors'][index % 3] };
    }
    return null;
  }

  if (gameKey === 'quiz') {
    if (state.phase === 'question' && !(state.answeredPlayers || []).includes(id)) {
      return { type: 'answer', answer: index % 4 };
    }
    if (state.phase === 'answer' && index === 0) return { type: 'next_round' };
    return null;
  }

  if (gameKey === 'blackjack') {
    if (state.phase === 'play' && state.currentPlayer === id) return { type: 'stand' };
    return null;
  }

  if (gameKey === 'gomoku') {
    if (state.phase !== 'playing' || state.currentPlayer !== id) return null;
    const firstId = state.players?.[0];
    const ownMoves = (state.moveHistory || []).filter((move) => move.player === id).length;
    const blackPlan = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
    const whitePlan = [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]];
    const next = (id === firstId ? blackPlan : whitePlan)[ownMoves];
    return next ? { type: 'place', x: next[0], y: next[1] } : null;
  }

  if (gameKey === 'chess') {
    if (state.phase !== 'playing') return null;
    if (!state.drawOffer && index === 0) return { type: 'offer_draw' };
    if (state.drawOffer?.playerId && state.drawOffer.playerId !== id) return { type: 'offer_draw' };
    return null;
  }

  if (gameKey === 'zha_jin_hua') {
    if (state.phase === 'look' && (state.activePlayers || []).includes(id) && !(state.actedThisRound || []).includes(id)) {
      return { type: 'ready' };
    }
    if (state.phase === 'bet' && state.currentPlayer === id) return { type: 'fold' };
    return null;
  }

  return null;
}

function actionForCardGame(gameKey, player, index, state) {
  const id = player.playerInfo.id;
  if (player.active === false) return null;
  if (!state || state.phase === 'finished') return null;

  if (gameKey === 'doudizhu') {
    if (state.phase === 'bid' && state.currentPlayer === id) {
      return state.currentBid ? { type: 'pass' } : { type: 'bid', score: 1 };
    }
    if (state.phase !== 'play' || state.currentPlayer !== id) return null;
    if (state.lastPattern && state.lastLeadPlayer !== id) return { type: 'pass' };
    const hand = state.hands?.[id] || [];
    return hand[0] ? { type: 'play', cards: [hand[0]] } : null;
  }

  if (gameKey === 'guandan') {
    if (state.phase === 'round_finished' && index === 0) return { type: 'next_round' };
    if (state.phase !== 'play' || state.currentPlayer !== id) return null;
    if (state.lastPattern && state.lastLeadPlayer !== id) {
      const hints = Array.isArray(state.currentHints) ? state.currentHints : [];
      const bestHint = hints
        .filter((item) => Array.isArray(item.cards) && item.cards.length > 0)
        .sort((a, b) => b.cards.length - a.cards.length)[0];
      return bestHint ? { type: 'play', cards: bestHint.cards } : { type: 'pass' };
    }
    const hand = state.hands?.[id] || [];
    return hand[0] ? { type: 'play', cards: [hand[0]] } : null;
  }

  if (gameKey === 'mahjong') {
    if (state.phase === 'draw' && state.currentPlayer === id) return { type: 'draw_done' };
    if (state.phase === 'discard' && state.currentPlayer === id) {
      const hand = state.hands?.[id] || [];
      const card = hand[hand.length - 1] || hand[0];
      return card ? { type: 'discard', card } : null;
    }
    if (state.phase === 'response') {
      const pending = state.pendingAction;
      if (pending?.type === 'self' && pending.playerId === id) return { type: 'pass' };
      if (pending?.queue?.[0]?.playerId === id) return { type: 'pass' };
    }
  }

  return null;
}

async function driveGame(game, players) {
  const startedAt = Date.now();
  const actionLog = [];
  let idleTicks = 0;
  let nextProgressAt = startedAt + 30000;

  while (Date.now() - startedAt < game.timeoutMs) {
    const snaps = await snapshots(players);
    const finished = snaps.find((snap) => snap.room?.status === 'finished');
    if (finished) {
      return {
        key: game.key,
        ok: true,
        elapsedMs: Date.now() - startedAt,
        finalPhase: finished.game?.phase,
        finalStatus: finished.room?.status,
        winner: finished.game?.finalWinner || finished.game?.winner || null,
        winningPlayers: finished.game?.winningPlayers || [],
        actions: actionLog.length
      };
    }
    const phaseFinished = snaps.find((snap) => snap.game?.phase === 'finished');
    if (phaseFinished) {
      await sleep(500);
      continue;
    }

    const commonState = publicState(snaps, players);
    if (Date.now() >= nextProgressAt) {
      console.log(`[PROGRESS] ${game.key} phase=${commonState?.phase || 'n/a'} stage=${commonState?.stage || 'n/a'} current=${commonState?.currentPlayer || 'n/a'} actions=${actionLog.length}`);
      nextProgressAt = Date.now() + 30000;
    }
    const actions = [];

    for (let i = 0; i < players.length; i += 1) {
      const isMember = roomHasPlayer(snaps[i]?.room, players[i].playerInfo.id);
      if (players[i].active === false || isMember === false) {
        players[i].active = false;
        continue;
      }
      const ownState = snaps[i]?.game || commonState;
      const state = ['doudizhu', 'guandan', 'mahjong'].includes(game.key) ? ownState : commonState;
      const action = ['doudizhu', 'guandan', 'mahjong'].includes(game.key)
        ? actionForCardGame(game.key, players[i], i, state)
        : actionForPlayer(game.key, players[i], i, state);
      if (action) actions.push({ player: players[i], action });
    }

    if (actions.length) {
      idleTicks = 0;
      for (const item of actions) {
        const response = await emit(item.player, 'game:action', { action: item.action });
        actionLog.push({
          player: item.player.nickname,
          action: item.action.type,
          error: response.error || null
        });
        if (response.error) {
          if (String(response.error).startsWith('emit_timeout:')) {
            console.log(`[WARN] ${game.key} ${item.action.type} timeout for ${item.player.nickname}; polling state and retrying if needed`);
            await sleep(1000);
            continue;
          }
          throw new Error(`${game.key}: action ${item.action.type} failed for ${item.player.nickname}: ${response.error}`);
        }
        await sleep(80);
      }
    } else {
      idleTicks += 1;
      await sleep(idleTicks > 20 ? 1000 : 250);
    }
  }

  const last = await snapshots(players);
  return {
    key: game.key,
    ok: false,
    elapsedMs: Date.now() - startedAt,
    last: last.map((snap, index) => ({
      player: snap.player?.nickname,
      playerId: snap.player?.id,
      expectedId: players[index]?.playerInfo.id,
      roomStatus: snap.room?.status,
      phase: snap.game?.phase,
      stage: snap.game?.stage,
      currentPlayer: snap.game?.currentPlayer,
      handCount: snap.game?.hands?.[snap.player?.id]?.length,
      events: snap.events?.slice(-6)
    })),
    actions: actionLog.length
  };
}

test.setTimeout(20 * 60 * 1000);

test('online all games can finish with simulated browser players', async ({ browser }) => {
  const runId = `${Date.now().toString(36)}`;
  const results = [];

  for (const game of SELECTED_GAMES) {
    const players = await setupRoom(browser, game, runId);
    try {
      const result = await driveGame(game, players);
      results.push(result);
      console.log(`[${result.ok ? 'OK' : 'FAIL'}] ${game.key} ${JSON.stringify(result)}`);
      if (!result.ok) throw new Error(`${game.key} did not finish: ${JSON.stringify(result.last)}`);
    } finally {
      await Promise.all(players.map((player) => player.context.close().catch(() => null)));
    }
  }

  console.log(`ONLINE_ALL_GAMES_RESULT ${JSON.stringify(results, null, 2)}`);
});
