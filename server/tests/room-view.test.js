const test = require('node:test');
const assert = require('node:assert/strict');

const store = require('../store');
const { GuandanEngine } = require('../game-engines/guandan');
const { getPlayerGameState, getPublicGameState, serializeRoom } = require('../room-view');
const { handleActionTimeout, maybeStartReadyRoom, prepareRoomRematch } = require('../index');

function card(rank, suit, value) {
  return { rank, suit, value, id: `${rank}-${suit}` };
}

function makeGuandanRoom() {
  const players = ['p1', 'p2', 'p3', 'p4'];
  players.forEach((id, index) => {
    store.savePlayer({
      id,
      nickname: id,
      busNumber: index + 1,
      online: true,
      currentRoom: 'room-privacy'
    });
  });

  const engine = new GuandanEngine();
  const gameState = engine.init(null, players);
  gameState.hands = {
    p1: [card('3', 'spade', 3)],
    p2: [card('4', 'spade', 4), card('5', 'spade', 5)],
    p3: [card('6', 'spade', 6), card('7', 'spade', 7), card('8', 'spade', 8)],
    p4: [card('9', 'spade', 9), card('10', 'spade', 10), card('J', 'spade', 11), card('Q', 'spade', 12)]
  };
  gameState.handCounts = Object.fromEntries(Object.entries(gameState.hands).map(([pid, hand]) => [pid, hand.length]));

  return {
    id: 'room-privacy',
    gameType: 'guandan',
    status: 'playing',
    mode: 'normal',
    visibility: 'public',
    players,
    ready: Object.fromEntries(players.map(pid => [pid, true])),
    seatStates: {},
    gameState
  };
}

test('room serialization only exposes the viewer hand in Guandan', () => {
  const room = makeGuandanRoom();

  const p1View = serializeRoom(room, 'p1').gameState;
  assert.deepEqual(Object.keys(p1View.hands), ['p1']);
  assert.deepEqual(p1View.hands.p1, room.gameState.hands.p1);
  assert.equal(p1View.hands.p2, undefined);
  assert.deepEqual(p1View.handCounts, { p1: 1, p2: 2, p3: 3, p4: 4 });

  const publicView = getPublicGameState(room);
  assert.deepEqual(publicView.hands, {});
  assert.deepEqual(publicView.handCounts, { p1: 1, p2: 2, p3: 3, p4: 4 });
});

test('quick Guandan room timeout auto-passes instead of stalling at zero', () => {
  const room = makeGuandanRoom();
  room.id = 'room-timeout';
  room.mode = 'quick';
  room.gameState.currentPlayer = 'p1';
  room.gameState.lastLeadPlayer = 'p4';
  room.gameState.lastPattern = { type: 'single', mainValue: 12, length: 1 };
  room.gameState.lastPlay = { playerId: 'p4', cards: [room.gameState.hands.p4[3]], pattern: room.gameState.lastPattern };
  room.gameState.timer = 1;
  room.gameState.timerStarted = Date.now() - 2000;

  handleActionTimeout(room);

  assert.deepEqual(room.gameState.passedPlayers, ['p1']);
  assert.equal(room.gameState.currentPlayer, 'p2');
});

test('offline Guandan player is auto-managed immediately', () => {
  const room = makeGuandanRoom();
  room.id = 'room-offline-auto';
  room.mode = 'normal';
  room.gameState.currentPlayer = 'p1';
  room.gameState.lastLeadPlayer = 'p4';
  room.gameState.lastPattern = { type: 'single', mainValue: 12, length: 1 };
  room.gameState.lastPlay = { playerId: 'p4', cards: [room.gameState.hands.p4[3]], pattern: room.gameState.lastPattern };
  room.gameState.timer = 30;
  room.gameState.timerStarted = Date.now();
  room.seatStates.p1 = { connection: 'offline', intent: 'active', disconnectedAt: Date.now() };
  const p1 = store.getPlayer('p1');
  p1.online = false;
  p1.currentRoom = room.id;
  store.savePlayer(p1);

  handleActionTimeout(room);

  assert.deepEqual(room.gameState.passedPlayers, ['p1']);
  assert.equal(room.gameState.currentPlayer, 'p2');
});

test('offline Guandan room settles after current hand with level gap x20', () => {
  const room = makeGuandanRoom();
  room.id = 'room-offline-settle';
  room.mode = 'normal';
  room.status = 'playing';
  room.seatStates = Object.fromEntries(room.players.map(pid => [pid, { connection: 'online', intent: 'active' }]));
  room.players.forEach((pid, index) => {
    const player = store.getPlayer(pid);
    Object.assign(player, {
      online: true,
      currentRoom: room.id,
      points: 1000,
      totalGames: 0,
      wins: 0,
      winStreak: 0,
      lossStreak: 0,
      busNumber: index + 1
    });
    store.savePlayer(player);
  });

  room.gameState.hands = {
    p1: [],
    p2: [],
    p3: [card('3', 'spade', 3)],
    p4: [card('4', 'spade', 4), card('5', 'spade', 5)]
  };
  room.gameState.handCounts = { p1: 0, p2: 0, p3: 1, p4: 2 };
  room.gameState.finishedOrder = ['p1', 'p2'];
  room.gameState.currentPlayer = 'p3';
  room.gameState.teamLevels = { south_north: '5', east_west: '3' };
  room.gameState.level = '5';
  room.gameState.lastPlay = null;
  room.gameState.lastPattern = null;
  room.gameState.lastLeadPlayer = null;
  room.gameState.timer = 30;
  room.gameState.timerStarted = Date.now();
  room.seatStates.p3 = { connection: 'offline', intent: 'active', disconnectedAt: Date.now() };
  const p3 = store.getPlayer('p3');
  p3.online = false;
  p3.currentRoom = room.id;
  store.savePlayer(p3);
  store.saveRoom(room);

  handleActionTimeout(room);

  assert.equal(room.status, 'finished');
  assert.equal(room.gameState.phase, 'finished');
  assert.deepEqual(room.gameState.winningPlayers, ['p1', 'p3']);
  assert.equal(room.gameState.offlineSettlement.reason, 'offline_after_round');
  assert.equal(store.getPlayer('p1').points, 1180);
  assert.equal(store.getPlayer('p3').points, 1180);
  assert.equal(store.getPlayer('p2').points, 820);
  assert.equal(store.getPlayer('p4').points, 820);
});

test('Guandan rematch waits for all players and starts a new match from 2', () => {
  const room = makeGuandanRoom();
  room.id = 'room-rematch';
  room.status = 'finished';
  room.visibility = 'private';
  room.gameState.phase = 'finished';
  room.gameState.settlement = { nextLevel: '5', winningPlayers: ['p1', 'p3'] };

  room.players.forEach(pid => {
    const player = store.getPlayer(pid);
    player.currentRoom = room.id;
    store.savePlayer(player);
  });

  const first = prepareRoomRematch(room, 'p1');
  assert.equal(first.success, true);
  assert.equal(room.status, 'readying');
  assert.equal(room.ready.p1, true);
  assert.equal(room.ready.p2, false);

  prepareRoomRematch(room, 'p2');
  prepareRoomRematch(room, 'p3');
  prepareRoomRematch(room, 'p4');

  assert.equal(room.status, 'playing');
  assert.equal(room.gameState.phase, 'play');
  assert.equal(room.gameState.level, '2');
});

test('flexible ready room waits before starting while seats remain open', () => {
  const players = ['flex1', 'flex2'];
  players.forEach((id, index) => {
    store.savePlayer({
      id,
      nickname: id,
      busNumber: index + 1,
      online: true,
      currentRoom: 'room-flex-ready'
    });
  });

  const room = {
    id: 'room-flex-ready',
    gameType: 'reaction_race',
    players,
    status: 'readying',
    mode: 'quick',
    visibility: 'public',
    ready: { flex1: true, flex2: true },
    readyDeadline: null,
    seatStates: Object.fromEntries(players.map(pid => [pid, { ready: true, connection: 'online', intent: 'active' }])),
    gameState: null
  };

  maybeStartReadyRoom(room);

  assert.equal(room.status, 'readying');
  assert.ok(room.readyDeadline > Date.now());

  room.readyDeadline = Date.now() - 1;
  maybeStartReadyRoom(room);

  assert.equal(room.status, 'playing');
  assert.equal(room.gameState.phase, 'waiting');
});

test('quiz hides answer fields while preserving reveal results', () => {
  const question = { q: '1+1=?', options: ['1', '2', '3', '4'], answer: 1 };
  const room = {
    id: 'room-quiz',
    gameType: 'quiz',
    status: 'playing',
    players: ['p1', 'p2'],
    gameState: {
      phase: 'question',
      players: ['p1', 'p2'],
      questions: [question],
      currentQuestion: question,
      answers: { p1: 1 },
      answeredPlayers: ['p1'],
      roundResult: null
    }
  };

  const p1QuestionView = getPlayerGameState(room, 'p1');
  assert.equal(Object.prototype.hasOwnProperty.call(p1QuestionView.currentQuestion, 'answer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(p1QuestionView.questions[0], 'answer'), false);
  assert.deepEqual(p1QuestionView.answers, { p1: 1 });

  const p2QuestionView = getPlayerGameState(room, 'p2');
  assert.deepEqual(p2QuestionView.answers, {});

  room.gameState.phase = 'answer';
  room.gameState.roundResult = {
    question,
    correct: 1,
    answers: { p1: 1, p2: 0 },
    correctPlayers: ['p1']
  };

  const answerView = getPlayerGameState(room, 'p2');
  assert.equal(Object.prototype.hasOwnProperty.call(answerView.currentQuestion, 'answer'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(answerView.roundResult.question, 'answer'), false);
  assert.equal(answerView.roundResult.correct, 1);
});
