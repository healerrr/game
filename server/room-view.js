const store = require('./store');
const { getEngine, getGameConfig } = require('./game-engine');

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

function getHandCounts(state) {
  if (!state) return {};
  if (state.handCounts) return { ...state.handCounts };
  if (!state.hands) return {};

  return Object.fromEntries(
    Object.entries(state.hands).map(([playerId, hand]) => [playerId, Array.isArray(hand) ? hand.length : 0])
  );
}

function hideHandsExcept(state, playerId) {
  if (!state?.hands) return state;

  const handCounts = getHandCounts(state);
  return {
    ...state,
    handCounts,
    hands: playerId
      ? { [playerId]: state.hands?.[playerId] || [] }
      : {}
  };
}

function omitAnswer(question) {
  if (!question) return question;
  const { answer, correctIndex, ...safeQuestion } = question;
  return safeQuestion;
}

function sanitizeGuessNumberState(state) {
  if (!state) return state;
  if (state.phase === 'finished') return state;
  const { secret, ...safeState } = state;
  return safeState;
}

function sanitizeQuizState(state, playerId) {
  if (!state) return state;

  const safeState = {
    ...state,
    currentQuestion: omitAnswer(state.currentQuestion),
    questions: Array.isArray(state.questions) ? state.questions.map(omitAnswer) : state.questions
  };

  if (safeState.roundResult?.question) {
    safeState.roundResult = {
      ...safeState.roundResult,
      question: omitAnswer(safeState.roundResult.question)
    };
  }

  if (state.phase === 'question') {
    safeState.answers = playerId && Object.prototype.hasOwnProperty.call(state.answers || {}, playerId)
      ? { [playerId]: state.answers[playerId] }
      : {};
  }

  return safeState;
}

function sanitizeGameState(room, state, viewerId = null) {
  if (!room || !state) return state;
  if (room.gameType === 'guess_number') return sanitizeGuessNumberState(state);
  if (room.gameType === 'quiz') return sanitizeQuizState(state, viewerId);
  return state;
}

function getPublicGameState(room) {
  const state = room?.gameState;
  if (!state) return state;

  const engine = getEngine(room.gameType);
  if (engine?.getPublicView) return sanitizeGameState(room, engine.getPublicView(state));
  if (engine?.getPlayerView || state.hands) {
    const view = hideHandsExcept(state, null);
    if (view && 'currentHints' in view) view.currentHints = [];
    return sanitizeGameState(room, view);
  }
  return sanitizeGameState(room, state);
}

function getPlayerGameState(room, playerId) {
  const state = room?.gameState;
  if (!state) return state;

  const engine = getEngine(room.gameType);
  if (engine?.getPlayerView) return sanitizeGameState(room, engine.getPlayerView(state, playerId), playerId);
  return sanitizeGameState(room, hideHandsExcept(state, playerId), playerId);
}

function serializeRoom(room, viewerId = null) {
  if (!room) return null;

  const config = getGameConfig(room.gameType);
  return {
    roomId: room.id,
    id: room.id,
    gameType: room.gameType,
    gameName: config?.name || room.gameType,
    minPlayers: config?.minPlayers || room.players.length,
    maxPlayers: config?.maxPlayers || room.players.length,
    players: getRoomPlayerSummaries(room),
    status: room.status,
    mode: room.mode || 'normal',
    visibility: room.visibility || 'public',
    ownerId: room.ownerId || null,
    ready: room.ready || {},
    readyDeadline: room.readyDeadline || null,
    seatStates: room.seatStates || {},
    gameState: viewerId ? getPlayerGameState(room, viewerId) : getPublicGameState(room)
  };
}

module.exports = {
  getPlayerGameState,
  getPublicGameState,
  getRoomPlayerSummaries,
  serializeRoom
};
