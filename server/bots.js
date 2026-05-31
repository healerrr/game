// 测试机器人 - 为每种游戏实现简单 AI
// 机器人不需要 Socket，直接操作游戏引擎

const { getEngine, getGameConfig } = require('./game-engine');
const cardBotStrategies = require('./bots/index.js');
const { gomokuStrategy } = require('./bots/gomoku');
const { chessStrategy } = require('./bots/chess');
const { randomUUID } = require('crypto');

const BOT_NAMES = [
  '小巴', '车车', '轮轮', '胎胎', '灯灯',
  '座座', '椅椅', '窗窗', '门门', '铃铃',
  '油油', '刹刹', '盘盘', '轴轴', '杠杠',
  '皮皮', '达达', '嘟嘟', '拉拉', '手手'
];

let botCounter = 0;

class BotPlayer {
  constructor(gameType) {
    this.gameType = gameType;
    this.name = BOT_NAMES[botCounter % BOT_NAMES.length];
    botCounter++;
    this.id = `bot_${randomUUID()}`;
    this.busNumber = 99; // 机器人统一 99 号车
  }
}

// ========== 游戏 AI 策略 ==========

const BotStrategy = {
  // 剪刀石头布：随机
  rock_paper_scissors(state, botId) {
    const moves = ['rock', 'paper', 'scissors'];
    return { type: 'choose', choice: moves[Math.floor(Math.random() * 3)] };
  },

  // 猜大小：折半搜索
  guess_number(state, botId) {
    if (state.currentPlayer !== botId) return null;
    const { low, high } = state.range;
    const guess = Math.floor((low + high) / 2);
    return { type: 'guess', guess };
  },

  // 21 点：简单策略（>= 17 停牌）
  blackjack(state, botId) {
    if (state.currentPlayer !== botId) return null;
    if (state.finishedPlayers?.includes(botId)) return null;

    const { getEngine: ge } = require('./game-engine');
    const engine = ge('blackjack');
    const handVal = engine.handValue(state.hands[botId]);

    return handVal >= 17
      ? { type: 'stand' }
      : { type: 'hit' };
  },

  // 炸金花：随机跟注/加注/弃牌
  zha_jin_hua(state, botId) {
    return cardBotStrategies.zha_jin_hua(state, botId);
  },

  // 谁是卧底：随机描述 + 随机投票
  undercover(state, botId) {
    if (state.phase === 'describe' && state.currentDescriber === botId) {
      if (!state.eliminatedPlayers?.includes(botId)) {
        const texts = ['是一种日常用品', '很大', '很小', '很贵', '很便宜',
          '在家里用', '在外面用', '圆的', '方的', '长条的'];
        return { type: 'describe', text: texts[Math.floor(Math.random() * texts.length)] };
      }
      return null;
    }

    if (state.phase === 'vote' && !state.votes[botId]) {
      if (state.eliminatedPlayers?.includes(botId)) return null;
      // 随机投给其他存活玩家
      const alive = state.players.filter(p =>
        !state.eliminatedPlayers.includes(p) && p !== botId
      );
      if (alive.length === 0) return null;
      return { type: 'vote', targetId: alive[Math.floor(Math.random() * alive.length)] };
    }

    return null;
  },

  // 快问快答：随机选答案
  quiz(state, botId) {
    if (state.phase !== 'question' || state.answeredPlayers?.includes(botId)) return null;
    const opts = state.currentQuestion?.options?.length || 4;
    return { type: 'answer', answer: Math.floor(Math.random() * opts) };
  },

  // 掼蛋：出最小的单张/对子
  guandan(state, botId) {
    return cardBotStrategies.guandan(state, botId);
  },

  // 斗地主：跟最小可压牌，农民之间尽量让牌
  doudizhu(state, botId) {
    return cardBotStrategies.doudizhu(state, botId);
  },

  // 麻将：摸牌后打最小的
  mahjong(state, botId) {
    return cardBotStrategies.mahjong(state, botId);
  },
  gomoku(state, botId) {
    return gomokuStrategy(state, botId);
  },
  chess(state, botId) {
    return chessStrategy(state, botId);
  }
};

// ========== 机器人房间 ==========
class BotRoom {
  constructor(store, io, gameType) {
    this.store = store;
    this.io = io;
    this.gameType = gameType;
    this.config = getGameConfig(gameType);
    this.engine = getEngine(gameType);
    this.bots = [];
    this.room = null;
    this.timers = [];

    this._createRoom();
  }

  _createRoom() {
    const numBots = this.config.maxPlayers;

    // 创建机器人玩家
    for (let i = 0; i < numBots; i++) {
      const bot = new BotPlayer(this.gameType);
      bot.points = 5000; // 机器人无限积分
      bot.totalGames = 0;
      bot.wins = 0;
      bot.currentRoom = null;
      bot.online = true;
      bot.createdAt = Date.now();
      bot.isBot = true;
      this.bots.push(this.store.addPlayer(bot));
    }

    // 创建房间
    this.room = this.store.createRoom(this.gameType, this.bots);
    this.room.gameState = this.engine.init(this.room, this.bots.map(b => b.id));
    this.room.status = 'playing';
    this.store.saveRoom(this.room);

    // 广播匹配信息（供观战者接收）
    this.io.emit('bot:room_created', {
      roomId: this.room.id,
      gameType: this.gameType,
      gameName: this.config.name,
      players: this.bots.map(b => ({ id: b.id, nickname: b.name, busNumber: b.busNumber, isBot: true })),
      gameState: this.room.gameState
    });

    console.log(`🤖 机器人房间已创建: ${this.room.id} (${this.config.name}, ${numBots}人)`);

    // 开始自动对局
    this._gameLoop();
  }

  _gameLoop() {
    // 每 1.5 秒尝试一次动作
    const timer = setInterval(() => this._tick(), 1500);
    this.timers.push(timer);
  }

  _tick() {
    if (!this.room || this.room.status === 'finished') {
      this._restart();
      return;
    }

    const state = this.room.gameState;
    if (!state) return;

    const strategy = BotStrategy[this.gameType];
    if (!strategy) return;

    // 找到当前应该行动的机器人
    const currentPlayer = this._getCurrentPlayer(state);
    if (!currentPlayer || !currentPlayer.startsWith('bot_')) return;

    const action = strategy(state, currentPlayer);
    if (!action) return;

    // 执行动作
    if (action.type === 'next_round') {
      if (this.engine.nextRound) {
        this.room.gameState = this.engine.nextRound(this.room.gameState);
      }
    } else {
      this.room.gameState = this.engine.update(this.room.gameState, action, currentPlayer);
    }
    this.store.saveRoom(this.room);

    // 广播状态更新
    this.io.to(`room:${this.room.id}`).emit('game:state', {
      gameState: this.room.gameState,
      players: this.bots.map(b => ({ id: b.id, nickname: b.name, busNumber: b.busNumber, isBot: true }))
    });

    // 游戏结束处理
    if (this.room.gameState.phase === 'finished') {
      this._handleGameEnd();
    }
  }

  _getCurrentPlayer(state) {
    switch (this.gameType) {
      case 'rock_paper_scissors':
        // RPS 需要两个玩家都出牌
        const allPlayers = state.players || Object.keys(state.scores);
        const unchosen = allPlayers.filter(p => !state.choices?.[p]);
        if (unchosen.length === 0) {
          // 都选了，等 nextRound
          return null;
        }
        return unchosen[0];
      case 'guess_number':
        return state.currentPlayer;
      case 'blackjack':
        return state.currentPlayer;
      case 'zha_jin_hua':
        if (state.phase === 'look') {
          return state.activePlayers?.find(p =>
            p.startsWith('bot_') && !state.actedThisRound?.includes(p)
          ) || null;
        }
        return (state.phase === 'bet') ? state.currentPlayer : null;
      case 'undercover':
        return state.currentDescriber || this._findAliveVoter(state);
      case 'quiz':
        // 需要所有未答题的玩家都回答
        const unanswered = state.players.filter(p => !state.answeredPlayers?.includes(p));
        return unanswered[0];
      case 'guandan':
      case 'doudizhu':
        return state.currentPlayer;
      case 'mahjong':
        if (state.phase === 'response') {
          if (state.pendingAction?.type === 'self') return state.pendingAction.playerId;
          return state.pendingAction?.queue?.[0]?.playerId || null;
        }
        return state.currentPlayer;
      case 'gomoku':
      case 'chess':
        return state.currentPlayer;
      default:
        return null;
    }
  }

  _findAliveVoter(state) {
    const alive = state.players?.filter(p => !state.eliminatedPlayers?.includes(p));
    if (!alive || alive.length === 0) return null;
    const unvoted = alive.filter(p => !state.votes?.[p]);
    return unvoted[0];
  }

  _handleGameEnd() {
    const winnerId = this.room.gameState.finalWinner;
    const winner = this.store.getPlayer(winnerId);

    console.log(`🏁 机器人房间 ${this.room.id} 结束，获胜者: ${winner?.nickname || '未知'}`);

    this.io.to(`room:${this.room.id}`).emit('game:result', {
      winner: winnerId,
      winningPlayers: this.room.gameState.winningPlayers,
      players: this.bots.map(b => ({
        id: b.id,
        nickname: b.name,
        points: b.points,
        won: this.room.gameState.winningPlayers?.includes(b.id) || b.id === winnerId
      }))
    });

    // 10 秒后重新开始
    this.store.saveRoom(this.room);
    setTimeout(() => this._restart(), 10000);
  }

  _restart() {
    // 清理旧房间
    if (this.room) {
      this.store.removeRoom(this.room.id);
      this.timers.forEach(t => clearInterval(t));
      this.timers = [];
    }

    // 清理旧机器人
    this.bots.forEach(b => this.store.removePlayer(b.id));
    this.bots = [];

    // 创建新房间
    this._createRoom();
  }

  destroy() {
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];
    if (this.room) {
      this.store.removeRoom(this.room.id);
    }
    this.bots.forEach(b => this.store.removePlayer(b.id));
    this.bots = [];
    console.log(`🗑️ 机器人房间已销毁: ${this.gameType}`);
  }
}

// ========== 管理器 ==========
class BotManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // gameType → BotRoom
  }

  start(store, gameType) {
    if (this.rooms.has(gameType)) {
      return { error: '该游戏的机器人已在运行' };
    }
    const room = new BotRoom(store, this.io, gameType);
    this.rooms.set(gameType, room);
    return { success: true, roomId: room.room.id, gameType };
  }

  stop(gameType) {
    const room = this.rooms.get(gameType);
    if (!room) return { error: '该游戏的机器人未运行' };
    room.destroy();
    this.rooms.delete(gameType);
    return { success: true };
  }

  stopAll() {
    for (const [type, room] of this.rooms) {
      room.destroy();
    }
    this.rooms.clear();
  }

  getActiveRooms() {
    const result = [];
    for (const [type, room] of this.rooms) {
      result.push({
        roomId: room.room.id,
        gameType: type,
        gameName: room.config.name,
        players: room.bots.map(b => ({ id: b.id, nickname: b.name, busNumber: b.busNumber, isBot: true })),
        gameState: {
          phase: room.room.gameState?.phase,
          round: room.room.gameState?.round
        }
      });
    }
    return result;
  }
}

module.exports = { BotManager, BotPlayer, BotStrategy };
