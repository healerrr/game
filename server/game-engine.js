// 游戏引擎 - 每款游戏的核心逻辑
// 每个引擎暴露: init(room, players) → update(action, playerId) → getState()

const { randomInt } = require('crypto');
const store = require('./store');
const cardEngines = require('./game-engines');

// ========== 剪刀石头布 ==========
class RockPaperScissors {
  init(room, players) {
    return {
      phase: 'choose',
      round: 1,
      maxRounds: 3,
      targetScore: 2,
      scores: { [players[0]]: 0, [players[1]]: 0 },
      choices: {},
      result: null,
      timer: 3,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (state.phase === 'choose' && action.type === 'choose') {
      if (!['rock', 'paper', 'scissors'].includes(action.choice)) return state;
      if (state.choices[playerId]) return state;
      state.choices[playerId] = action.choice; // rock | paper | scissors
      // 两人都选了 → 判定
      if (Object.keys(state.choices).length === 2) {
        return this.resolve(state);
      }
    }
    return state;
  }

  resolve(state) {
    const pids = Object.keys(state.choices);
    const c1 = state.choices[pids[0]];
    const c2 = state.choices[pids[1]];

    let winner = null;
    if (c1 !== c2) {
      if ((c1 === 'rock' && c2 === 'scissors') ||
          (c1 === 'scissors' && c2 === 'paper') ||
          (c1 === 'paper' && c2 === 'rock')) {
        winner = pids[0];
      } else {
        winner = pids[1];
      }
    }

    if (winner) {
      state.scores[winner]++;
    }

    state.result = {
      winner,
      choices: { ...state.choices },
      round: state.round,
      scores: { ...state.scores }
    };

    state.phase = 'reveal';
    state.timer = 3;
    state.timerStarted = Date.now();
    return state;
  }

  nextRound(state) {
    if (state.phase === 'finished') return state;

    if (state.result?.winner && state.scores[state.result.winner] >= (state.targetScore || 2)) {
      state.phase = 'finished';
      state.finalWinner = state.result.winner;
      state.winningPlayers = [state.result.winner];
      state.timerStarted = null;
      return state;
    }

    if (state.result?.winner) {
      state.round++;
    }

    state.phase = 'choose';
    state.choices = {};
    state.result = null;
    state.timer = 3;
    state.timerStarted = Date.now();
    return state;
  }
}

// ========== 看谁快 ==========
class ReactionRace {
  init(room, players) {
    const waitMs = randomInt(1800, 4201);
    return {
      phase: 'waiting',
      players,
      signalAt: Date.now() + waitMs,
      clicks: {},
      falseStarts: [],
      reactionRanking: [],
      timer: Math.ceil(waitMs / 1000),
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (!state.players?.includes(playerId)) return state;
    if (state.phase === 'finished') return state;
    if (action.type !== 'tap') return state;
    if (state.clicks[playerId] || state.falseStarts?.includes(playerId)) return state;

    const now = Date.now();
    if (state.phase === 'waiting' && now < Number(state.signalAt || 0)) {
      state.falseStarts = [...(state.falseStarts || []), playerId];
      return this.maybeFinish(state);
    }

    if (state.phase === 'waiting') {
      this.startSignal(state, now);
    }

    if (state.phase === 'go') {
      const reactionMs = Math.max(0, now - Number(state.signalAt || now));
      state.clicks[playerId] = { playerId, reactionMs, clickedAt: now };
      return this.maybeFinish(state);
    }

    return state;
  }

  startSignal(state, now = Date.now()) {
    state.phase = 'go';
    state.signalAt = Number(state.signalAt || now);
    state.timer = 5;
    state.timerStarted = now;
    return state;
  }

  nextRound(state) {
    if (state.phase === 'waiting') return this.startSignal(state);
    if (state.phase === 'go') return this.finish(state);
    return state;
  }

  maybeFinish(state) {
    const falseStarts = new Set(state.falseStarts || []);
    const remaining = (state.players || []).filter(pid => !falseStarts.has(pid) && !state.clicks?.[pid]);
    return remaining.length === 0 ? this.finish(state) : state;
  }

  finish(state) {
    const ranking = Object.values(state.clicks || {})
      .sort((a, b) => a.reactionMs - b.reactionMs || a.clickedAt - b.clickedAt);
    const winner = ranking[0]?.playerId || null;

    state.phase = 'finished';
    state.reactionRanking = ranking;
    state.finalWinner = winner;
    state.winner = winner;
    state.winningPlayers = winner ? [winner] : [];
    state.timer = 0;
    state.timerStarted = Date.now();
    return state;
  }
}

// ========== 摇骰子 ==========
class DiceRoll {
  init(room, players) {
    return {
      phase: 'rolling',
      players,
      activePlayers: [...players],
      rollRound: 1,
      rolls: {},
      history: [],
      standings: [],
      timer: 12,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (!['rolling', 'tiebreak'].includes(state.phase)) return state;
    if (action.type !== 'roll') return state;
    if (!state.activePlayers?.includes(playerId)) return state;
    if (state.rolls?.[playerId]) return state;

    const dice = [randomInt(1, 7), randomInt(1, 7)];
    state.rolls[playerId] = {
      playerId,
      dice,
      total: dice[0] + dice[1],
      highDie: Math.max(...dice),
      rolledAt: Date.now(),
      round: state.rollRound
    };

    const allRolled = state.activePlayers.every(pid => state.rolls?.[pid]);
    return allRolled ? this.resolveRound(state) : state;
  }

  nextRound(state) {
    if (!['rolling', 'tiebreak'].includes(state.phase)) return state;
    for (const pid of state.activePlayers || []) {
      if (!state.rolls?.[pid]) {
        state.rolls[pid] = {
          playerId: pid,
          dice: [0, 0],
          total: 0,
          highDie: 0,
          rolledAt: Date.now(),
          round: state.rollRound,
          timeout: true
        };
      }
    }
    return this.resolveRound(state);
  }

  resolveRound(state) {
    const roundRolls = Object.values(state.rolls || {});
    const sorted = [...roundRolls].sort((a, b) => (
      b.total - a.total ||
      b.highDie - a.highDie ||
      a.rolledAt - b.rolledAt
    ));
    const best = sorted[0];
    if (!best) return state;

    const tied = sorted.filter(item => item.total === best.total && item.highDie === best.highDie);
    state.history = [
      ...(state.history || []),
      {
        round: state.rollRound,
        rolls: Object.fromEntries(roundRolls.map(item => [item.playerId, item]))
      }
    ];
    state.standings = sorted;

    if (roundRolls.length > 0 && roundRolls.every(item => item.timeout)) {
      state.phase = 'finished';
      state.finalWinner = null;
      state.winner = 'draw';
      state.winningPlayers = [];
      state.timer = 0;
      state.timerStarted = Date.now();
      return state;
    }

    if (tied.length > 1) {
      state.phase = 'tiebreak';
      state.activePlayers = tied.map(item => item.playerId);
      state.rollRound += 1;
      state.rolls = {};
      state.timer = 12;
      state.timerStarted = Date.now();
      return state;
    }

    state.phase = 'finished';
    state.finalWinner = best.playerId;
    state.winner = best.playerId;
    state.winningPlayers = [best.playerId];
    state.timer = 0;
    state.timerStarted = Date.now();
    return state;
  }
}

// ========== 猜点数 ==========
class GuessDice {
  init(room, players) {
    return {
      phase: 'guessing',
      players,
      guesses: {},
      dice: null,
      winningPlayers: [],
      timer: 15,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (state.phase !== 'guessing') return state;
    if (action.type !== 'guess') return state;
    if (!state.players?.includes(playerId)) return state;
    if (state.guesses?.[playerId]) return state;

    const guess = Number(action.guess);
    if (!Number.isInteger(guess) || guess < 1 || guess > 6) return state;

    state.guesses[playerId] = {
      playerId,
      guess,
      guessedAt: Date.now()
    };

    const allGuessed = state.players.every(pid => state.guesses?.[pid]);
    return allGuessed ? this.finish(state) : state;
  }

  nextRound(state) {
    if (state.phase !== 'guessing') return state;
    for (const pid of state.players || []) {
      if (!state.guesses?.[pid]) {
        state.guesses[pid] = {
          playerId: pid,
          guess: null,
          guessedAt: Date.now(),
          timeout: true
        };
      }
    }
    return this.finish(state);
  }

  finish(state) {
    const dice = randomInt(1, 7);
    const winningPlayers = (state.players || []).filter(pid => state.guesses?.[pid]?.guess === dice);

    state.phase = 'finished';
    state.dice = dice;
    state.finalWinner = winningPlayers[0] || null;
    state.winner = state.finalWinner;
    state.winningPlayers = winningPlayers;
    state.timer = 0;
    state.timerStarted = Date.now();
    return state;
  }
}

class ZhaJinHua {
  constructor() {
    this.SUITS = ['spade', 'heart', 'club', 'diamond'];
    this.RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    this.RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
    this.ENTRY_FEE = 10;
    this.BASE_BET = 5;
    this.BLIND_BET_LIMIT = 20;
    this.LOOKED_BET_LIMIT = 40;
    this.MAX_ROUNDS = 5;
  }

  createDeck() {
    const deck = [];
    for (const suit of this.SUITS) {
      for (const rank of this.RANKS) {
        deck.push({ suit, rank, value: this.RANK_VALUES[rank] });
      }
    }
    // 洗牌
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  makeQuestion({ q, correct, wrong, category }) {
    const wrongOptions = this.shuffle(wrong).slice(0, 3);
    const options = this.shuffle([correct, ...wrongOptions]);
    return {
      q,
      options,
      answer: options.indexOf(correct),
      category
    };
  }

  getGeneralQuestionFacts() {
    return [
      { category: 'geography', q: '下列哪座城市不在欧洲？', correct: '开罗', wrong: ['维也纳', '布拉格', '里斯本', '哥本哈根'] },
      { category: 'geography', q: '下列哪条河流最终流入地中海？', correct: '尼罗河', wrong: ['亚马孙河', '恒河', '密西西比河', '长江'] },
      { category: 'geography', q: '下列哪个国家同时跨越欧亚两洲？', correct: '土耳其', wrong: ['葡萄牙', '埃及', '墨西哥', '新西兰'] },
      { category: 'geography', q: '马六甲海峡主要连接哪两个海域？', correct: '印度洋与南海', wrong: ['地中海与红海', '黑海与地中海', '北海与波罗的海', '加勒比海与太平洋'] },
      { category: 'science', q: '声音在下列哪种介质中通常传播最快？', correct: '钢铁', wrong: ['空气', '真空', '水蒸气', '软木'] },
      { category: 'science', q: '下列哪一种变化属于化学变化？', correct: '铁生锈', wrong: ['冰融化', '水蒸发', '玻璃破碎', '盐溶于水'] },
      { category: 'science', q: '太阳能量主要来自哪一类过程？', correct: '核聚变', wrong: ['核裂变', '化学燃烧', '潮汐摩擦', '地热释放'] },
      { category: 'science', q: '人体血液中主要负责运输氧气的是？', correct: '红细胞', wrong: ['血小板', '白细胞', '淋巴细胞', '胆汁'] },
      { category: 'culture', q: '文艺复兴最早兴起于欧洲哪个地区？', correct: '意大利', wrong: ['北欧', '伊比利亚半岛', '巴尔干半岛', '不列颠群岛'] },
      { category: 'culture', q: '下列哪部作品通常被归为莎士比亚的悲剧？', correct: '《哈姆雷特》', wrong: ['《威尼斯商人》', '《仲夏夜之梦》', '《皆大欢喜》', '《暴风雨》'] },
      { category: 'culture', q: '下列哪一个节气最接近昼夜等长？', correct: '春分', wrong: ['小暑', '大雪', '立冬', '芒种'] },
      { category: 'reasoning', q: '如果“所有甲都是乙”成立，下列哪项一定成立？', correct: '不是乙的一定不是甲', wrong: ['所有乙都是甲', '有些甲不是乙', '不是甲的一定不是乙', '甲和乙完全相同'] },
      { category: 'reasoning', q: '“幸存者偏差”最接近下列哪种情况？', correct: '只观察留下来的样本而忽略消失的样本', wrong: ['随机样本数量太大', '所有样本概率完全相同', '重复实验导致结果稳定', '用平均数代替中位数'] },
      { category: 'economics', q: '“机会成本”指的是？', correct: '选择某项方案而放弃的最佳替代收益', wrong: ['已经发生且无法收回的成本', '账面上记录的全部成本', '产品售出后的净利润', '固定资产折旧总额'] },
      { category: 'economics', q: '“通货膨胀”通常表示？', correct: '总体物价水平持续上升', wrong: ['某一商品价格偶然上涨', '失业率持续下降', '货币购买力持续增强', '出口量必然增加'] },
      { category: 'math', q: '一个数增加20%后再减少20%，结果与原数相比？', correct: '减少4%', wrong: ['不变', '增加4%', '减少20%', '增加20%'] },
      { category: 'math', q: '若三个独立事件发生概率均为1/2，它们同时发生的概率是？', correct: '1/8', wrong: ['1/2', '1/4', '3/8', '1/16'] },
      { category: 'life', q: '做实验时设置对照组的主要目的是什么？', correct: '用于比较变量产生的影响', wrong: ['让实验人数更多', '保证结果一定正确', '减少记录工作', '替代实验组'] },
      { category: 'life', q: '阅读统计图时，最需要警惕哪种误导？', correct: '坐标轴截断造成差异被夸大', wrong: ['标题字号太大', '颜色数量太少', '图例放在右侧', '数据点太整齐'] }
    ];
  }

  makeGeneratedQuestion(seed) {
    const generators = [
      () => {
        const base = 12 + Math.floor(Math.random() * 24);
        const percent = [10, 15, 20, 25][Math.floor(Math.random() * 4)];
        const correct = String(Math.round(base * (1 - (percent / 100) ** 2) * 100) / 100);
        return {
          category: 'math',
          q: `某数先增加${percent}%，再减少${percent}%，若原数为${base}，结果最接近多少？`,
          correct,
          wrong: [String(base), String(Math.round(base * (1 - percent / 100) * 100) / 100), String(Math.round(base * (1 + percent / 100) * 100) / 100), String(base - percent / 10)]
        };
      },
      () => {
        const pairs = [
          ['水星', '太阳系中最靠近太阳的行星', ['金星', '火星', '木星', '土星']],
          ['臭氧层', '主要吸收太阳紫外线的地球大气结构', ['电离层', '对流层水汽', '磁层', '平流层云']],
          ['活字印刷术', '北宋毕昇相关的技术发明', ['指南针', '火药', '造纸术', '地动仪']],
          ['二十四节气', '古代中国用于指导农事的时间知识体系', ['十二生肖', '干支纪年', '五行学说', '星座体系']]
        ];
        const [correct, clue, wrong] = pairs[Math.floor(Math.random() * pairs.length)];
        return { category: 'culture', q: `下列哪一项最符合“${clue}”？`, correct, wrong };
      },
      () => {
        const examples = [
          ['把只返回问卷的人当成全部人群来判断', '自选择偏差', ['安慰剂效应', '沉没成本', '边际收益', '规模经济']],
          ['因为已经投入很多而继续投入一个明显不划算的项目', '沉没成本误区', ['幸存者偏差', '从众效应', '机会成本', '路径依赖']],
          ['看到两个变量同时变化，就断定其中一个导致另一个', '相关不等于因果', ['样本均衡', '边际递减', '复利效应', '风险对冲']],
          ['只凭少数醒目案例判断整体概率', '可得性偏差', ['价格歧视', '比较优势', '复盘效应', '对照实验']]
        ];
        const [scene, correct, wrong] = examples[Math.floor(Math.random() * examples.length)];
        return { category: 'reasoning', q: `下面情境最接近哪一个概念：${scene}？`, correct, wrong };
      }
    ];
    return this.makeQuestion(generators[seed % generators.length]());
  }

  generateQuestions(count) {
    const questions = [];
    const seen = new Set();
    const usedCategories = new Set();
    const facts = this.shuffle(this.getGeneralQuestionFacts());

    for (const fact of facts) {
      if (questions.length >= count) break;
      if (seen.has(fact.q) || usedCategories.has(fact.category)) continue;
      questions.push(this.makeQuestion(fact));
      seen.add(fact.q);
      usedCategories.add(fact.category);
    }

    for (const fact of facts) {
      if (questions.length >= count) break;
      if (seen.has(fact.q)) continue;
      questions.push(this.makeQuestion(fact));
      seen.add(fact.q);
    }

    let seed = 0;
    while (questions.length < count) {
      const question = this.makeGeneratedQuestion(seed++);
      if (seen.has(question.q)) continue;
      questions.push(question);
      seen.add(question.q);
    }

    return questions;
  }

  init(room, players) {
    const deck = this.createDeck();
    const hands = {};
    const activePlayers = [...players];

    // 发牌
    for (const pid of players) {
      hands[pid] = [deck.pop(), deck.pop(), deck.pop()];
    }

    return {
      phase: 'look',
      round: 1,
      players,
      activePlayers: [...players],
      hands,
      foldedPlayers: [],
      lookedPlayers: [],
      currentPlayer: players[0],
      currentBet: this.BASE_BET,
      baseBet: this.BASE_BET,
      baseScore: this.ENTRY_FEE,
      maxRounds: 5,
      blindBetLimit: this.BLIND_BET_LIMIT,
      lookedBetLimit: this.LOOKED_BET_LIMIT,
      pot: 0,
      playerBets: Object.fromEntries(players.map(p => [p, 0])),
      actedThisRound: [],
      lastAction: null,
      compareResult: null,
      timer: 25,
      timerStarted: Date.now(),
      result: null
    };
  }

  update(state, action, playerId) {
    if (!state.activePlayers.includes(playerId)) return state;

    if (state.phase === 'look') {
      return this.handleLookPhase(state, action, playerId);
    }

    if (state.phase === 'bet') {
      return this.handleBetPhase(state, action, playerId);
    }

    if (state.phase === 'look' && action.type === 'ready') {
      state.actedThisRound.push(playerId);
      // 所有人都ready → 进入下注阶段
      if (state.actedThisRound.length >= state.activePlayers.length) {
        state.phase = 'bet';
        state.actedThisRound = [];
        state.currentPlayer = state.activePlayers[0];
        state.timerStarted = Date.now();
      }
      return state;
    }

    if (state.phase === 'bet' && playerId === state.currentPlayer) {
      if (action.type === 'fold') {
        state.foldedPlayers.push(playerId);
        state.activePlayers = state.activePlayers.filter(p => p !== playerId);

        // 只剩一人 → 直接获胜
        if (state.activePlayers.length === 1) {
          state.phase = 'finished';
          state.finalWinner = state.activePlayers[0];
          return state;
        }
      } else if (action.type === 'call') {
        const toPay = state.currentBet - (state.playerBets[playerId] || 0);
        state.playerBets[playerId] = state.currentBet;
        state.pot += toPay;
      } else if (action.type === 'raise') {
        state.currentBet *= 2;
        const toPay = state.currentBet - (state.playerBets[playerId] || 0);
        state.playerBets[playerId] = state.currentBet;
        state.pot += toPay;
      }

      state.actedThisRound.push(playerId);

      // 推进到下一个玩家
      const nextIdx = (state.activePlayers.indexOf(playerId) + 1) % state.activePlayers.length;
      state.currentPlayer = state.activePlayers[nextIdx];

      // 一轮结束？
      if (state.actedThisRound.length >= state.activePlayers.length) {
        state.round++;
        if (state.round > state.maxRounds) {
          state.phase = 'showdown';
          return this.showdown(state);
        }
        state.actedThisRound = [];
      }
      state.timerStarted = Date.now();
    }

    return state;
  }

  showdown(state) {
    const handRanks = {};
    for (const pid of state.activePlayers) {
      handRanks[pid] = this.evaluateHand(state.hands[pid]);
    }

    // 找出最佳手牌
    let bestPlayer = state.activePlayers[0];
    let bestRank = handRanks[bestPlayer];

    for (let i = 1; i < state.activePlayers.length; i++) {
      const pid = state.activePlayers[i];
      const rank = handRanks[pid];
      if (this.compareHands(rank, bestRank, state.hands[pid], state.hands[bestPlayer]) > 0) {
        bestPlayer = pid;
        bestRank = rank;
      }
    }

    state.phase = 'finished';
    state.finalWinner = bestPlayer;
    state.showdownResult = {
      hands: Object.fromEntries(
        state.activePlayers.map(pid => [pid, state.hands[pid]])
      ),
      rankings: Object.fromEntries(
        state.activePlayers.map(pid => [pid, handRanks[pid]])
      ),
      winner: bestPlayer
    };
    return state;
  }

  handleLookPhase(state, action, playerId) {
    if (action.type === 'peek') {
      if (!state.actedThisRound.includes(playerId)) {
        this.markLooked(state, playerId);
        state.lastAction = { type: 'peek', playerId };
        state.timerStarted = Date.now();
      }
      return state;
    }

    if (action.type !== 'ready' || state.actedThisRound.includes(playerId)) {
      return state;
    }

    state.actedThisRound.push(playerId);
    state.lastAction = { type: 'ready', playerId };

    if (state.actedThisRound.length >= state.activePlayers.length) {
      state.phase = 'bet';
      state.actedThisRound = [];
      state.currentPlayer = state.activePlayers[0];
      state.compareResult = null;
    }

    state.timerStarted = Date.now();
    return state;
  }

  handleBetPhase(state, action, playerId) {
    if (playerId !== state.currentPlayer) return state;

    if (action.type === 'peek') {
      if (!this.isLooked(state, playerId)) {
        this.markLooked(state, playerId);
        state.lastAction = { type: 'peek', playerId };
        state.timerStarted = Date.now();
      }
      return state;
    }

    if (action.type === 'showdown') {
      return this.finishRound(state, this.getShowdownWinner(state), 'showdown');
    }

    if (action.type === 'fold') {
      this.foldPlayer(state, playerId);
      this.recordTurn(state, playerId);
      state.lastAction = { type: 'fold', playerId };
      state.compareResult = null;

      if (state.activePlayers.length === 1) {
        return this.finishRound(state, state.activePlayers[0], 'fold');
      }
    } else if (action.type === 'call') {
      const amount = this.getCallAmount(state, playerId);
      this.applyCost(state, playerId, amount);
      this.recordTurn(state, playerId);
      state.lastAction = { type: 'call', playerId, amount };
      state.compareResult = null;
    } else if (action.type === 'raise') {
      const amount = this.getRaiseAmount(state, playerId);
      state.currentBet *= 2;
      this.applyCost(state, playerId, amount);
      state.actedThisRound = [playerId];
      state.lastAction = { type: 'raise', playerId, amount, currentBet: state.currentBet };
      state.compareResult = null;
    } else if (action.type === 'compare') {
      const targetId = action.targetId;
      if (!targetId || targetId === playerId || !state.activePlayers.includes(targetId)) {
        return state;
      }

      const amount = this.getCompareAmount(state, playerId);
      this.applyCost(state, playerId, amount);

      const challengerRank = this.evaluateHand(state.hands[playerId]);
      const targetRank = this.evaluateHand(state.hands[targetId]);
      const challengerWins = this.compareHands(challengerRank, targetRank) > 0;
      const winner = challengerWins ? playerId : targetId;
      const loser = challengerWins ? targetId : playerId;

      state.compareResult = { challenger: playerId, targetId, winner, loser, amount };
      state.lastAction = { type: 'compare', playerId, targetId, amount, winner, loser };
      this.foldPlayer(state, loser);
      state.actedThisRound = state.actedThisRound.filter(pid => state.activePlayers.includes(pid));

      if (state.activePlayers.length === 1) {
        return this.finishRound(state, winner, 'compare');
      }

      state.currentPlayer = winner === playerId
        ? this.getNextActivePlayer(state, playerId)
        : winner;
      state.round += 1;
      state.timerStarted = Date.now();
      return state;
    } else {
      return state;
    }

    state.currentPlayer = this.getNextActivePlayer(state, playerId);

    if (state.actedThisRound.length >= state.activePlayers.length) {
      state.round += 1;
      state.actedThisRound = [];
    }

    state.timerStarted = Date.now();
    return state;
  }

  finishRound(state, winnerId, reason) {
    state.phase = 'finished';
    state.finalWinner = winnerId;
    state.finishReason = reason;
    state.showdownResult = this.buildShowdownResult(state, winnerId);
    return state;
  }

  buildShowdownResult(state, winnerId) {
    const hands = {};
    const rankings = {};
    for (const pid of state.players) {
      hands[pid] = state.hands[pid] || [];
      rankings[pid] = this.evaluateHand(hands[pid]);
    }

    return {
      hands,
      rankings,
      winner: winnerId,
      compareResult: state.compareResult || null
    };
  }

  getShowdownWinner(state) {
    const contenders = state.activePlayers.length ? state.activePlayers : state.players;
    let bestPlayer = contenders[0];
    let bestRank = this.evaluateHand(state.hands[bestPlayer]);

    for (let i = 1; i < contenders.length; i++) {
      const pid = contenders[i];
      const rank = this.evaluateHand(state.hands[pid]);
      if (this.compareHands(rank, bestRank) > 0) {
        bestPlayer = pid;
        bestRank = rank;
      }
    }

    return bestPlayer;
  }

  foldPlayer(state, playerId) {
    if (!state.foldedPlayers.includes(playerId)) {
      state.foldedPlayers.push(playerId);
    }
    state.activePlayers = state.activePlayers.filter(pid => pid !== playerId);
  }

  recordTurn(state, playerId) {
    if (!state.actedThisRound.includes(playerId)) {
      state.actedThisRound.push(playerId);
    }
  }

  applyCost(state, playerId, amount) {
    state.playerBets[playerId] = (state.playerBets[playerId] || 0) + amount;
    state.pot += amount;
  }

  isLooked(state, playerId) {
    return state.lookedPlayers?.includes(playerId);
  }

  markLooked(state, playerId) {
    if (!this.isLooked(state, playerId)) {
      state.lookedPlayers.push(playerId);
    }
  }

  getBetMultiplier(state, playerId) {
    return this.isLooked(state, playerId) ? 2 : 1;
  }

  getCallAmount(state, playerId) {
    return ((state.currentBet || this.BASE_BET) * 2) * this.getBetMultiplier(state, playerId);
  }

  getRaiseAmount(state, playerId) {
    return (state.currentBet || this.BASE_BET) * this.getBetMultiplier(state, playerId);
  }

  getCompareAmount(state, playerId) {
    return this.getCallAmount(state, playerId) * 2;
  }

  getNextActivePlayer(state, playerId) {
    const active = state.activePlayers || [];
    if (active.length === 0) return null;

    const activeIndex = active.indexOf(playerId);
    if (activeIndex >= 0) {
      return active[(activeIndex + 1) % active.length];
    }

    const originalIndex = state.players.indexOf(playerId);
    const next = active.find(pid => state.players.indexOf(pid) > originalIndex);
    return next || active[0];
  }

  evaluateHand(hand) {
    if (!hand || hand.length !== 3) {
      return {
        typeKey: 'unknown',
        typeLabel: '',
        typeValue: 0,
        values: [],
        suits: [],
        tieBreaker: []
      };
    }

    const normalized = [...hand].sort((a, b) => b.value - a.value);
    const normalizedValues = normalized.map(card => card.value);
    const normalizedSuits = normalized.map(card => card.suit);
    const isFlushNew = normalizedSuits[0] === normalizedSuits[1] && normalizedSuits[1] === normalizedSuits[2];
    const isWheel = normalizedValues[0] === 14 && normalizedValues[1] === 3 && normalizedValues[2] === 2;
    const isStraightNew = (normalizedValues[0] - normalizedValues[1] === 1 && normalizedValues[1] - normalizedValues[2] === 1) || isWheel;
    const isThreeNew = normalizedValues[0] === normalizedValues[1] && normalizedValues[1] === normalizedValues[2];
    const isPairNew = normalizedValues[0] === normalizedValues[1] || normalizedValues[1] === normalizedValues[2];

    if (isThreeNew) {
      return {
        typeKey: 'leizi',
        typeLabel: '豹子',
        typeValue: 6,
        values: normalizedValues,
        suits: normalizedSuits,
        tieBreaker: [normalizedValues[0]]
      };
    }

    if (isFlushNew && isStraightNew) {
      return {
        typeKey: 'tonghuashun',
        typeLabel: '同花顺',
        typeValue: 5,
        values: normalizedValues,
        suits: normalizedSuits,
        tieBreaker: [isWheel ? 3 : normalizedValues[0]]
      };
    }

    if (isFlushNew) {
      return {
        typeKey: 'tonghua',
        typeLabel: '同花',
        typeValue: 4,
        values: normalizedValues,
        suits: normalizedSuits,
        tieBreaker: normalizedValues
      };
    }

    if (isStraightNew) {
      return {
        typeKey: 'shunzi',
        typeLabel: '顺子',
        typeValue: 3,
        values: normalizedValues,
        suits: normalizedSuits,
        tieBreaker: [isWheel ? 3 : normalizedValues[0]]
      };
    }

    if (isPairNew) {
      const pairValue = normalizedValues[0] === normalizedValues[1] ? normalizedValues[0] : normalizedValues[1];
      const kicker = normalizedValues[0] === normalizedValues[1] ? normalizedValues[2] : normalizedValues[0];
      return {
        typeKey: 'duizi',
        typeLabel: '对子',
        typeValue: 2,
        values: normalizedValues,
        suits: normalizedSuits,
        tieBreaker: [pairValue, kicker]
      };
    }

    return {
      typeKey: 'danzhang',
      typeLabel: '单张',
      typeValue: 1,
      values: normalizedValues,
      suits: normalizedSuits,
      tieBreaker: normalizedValues
    };

    const sorted = [...hand].sort((a, b) => b.value - a.value);
    const values = sorted.map(c => c.value);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
    const isStraight = (values[0] - values[1] === 1 && values[1] - values[2] === 1) ||
                       (values[0] === 14 && values[1] === 3 && values[2] === 2); // A-3-2
    const isThree = values[0] === values[1] && values[1] === values[2];
    const isPair = values[0] === values[1] || values[1] === values[2];

    let type, typeValue;
    if (isThree) { type = '豹子'; typeValue = 6; }
    else if (isFlush && isStraight) { type = '同花顺'; typeValue = 5; }
    else if (isFlush) { type = '同花'; typeValue = 4; }
    else if (isStraight) { type = '顺子'; typeValue = 3; }
    else if (isPair) { type = '对子'; typeValue = 2; }
    else { type = '单张'; typeValue = 1; }

    return { type, typeValue, values, suits };
  }

  compareHands(a, b, handA, handB) {
    if (a.typeValue !== b.typeValue) return a.typeValue - b.typeValue;
    const tieA = a.tieBreaker || a.values || [];
    const tieB = b.tieBreaker || b.values || [];
    const maxLen = Math.max(tieA.length, tieB.length);
    for (let i = 0; i < maxLen; i++) {
      const valueA = tieA[i] || 0;
      const valueB = tieB[i] || 0;
      if (valueA !== valueB) return valueA - valueB;
    }
    return 0;

    if (a.typeValue !== b.typeValue) return a.typeValue - b.typeValue;
    // 同类型比较牌面
    for (let i = 0; i < 3; i++) {
      if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
    }
    return 0;
  }

  // 揭示后继续下一局
  nextRound(state) {
    const nextDeck = this.createDeck();
    const nextHands = {};
    for (const pid of state.players) {
      nextHands[pid] = [nextDeck.pop(), nextDeck.pop(), nextDeck.pop()];
    }

    return {
      phase: 'look',
      round: 1,
      players: state.players,
      activePlayers: [...state.players],
      hands: nextHands,
      foldedPlayers: [],
      lookedPlayers: [],
      currentPlayer: state.players[0],
      currentBet: this.BASE_BET,
      baseBet: this.BASE_BET,
      maxRounds: this.MAX_ROUNDS,
      pot: 0,
      playerBets: Object.fromEntries(state.players.map(pid => [pid, 0])),
      actedThisRound: [],
      lastAction: null,
      compareResult: null,
      timer: 25,
      timerStarted: Date.now(),
      result: null
    };

    const deck = this.createDeck();
    const hands = {};
    for (const pid of state.players) {
      hands[pid] = [deck.pop(), deck.pop(), deck.pop()];
    }

    return {
      phase: 'look',
      round: 1,
      maxRounds: 3,
      players: state.players,
      activePlayers: [...state.players],
      hands,
      foldedPlayers: [],
      currentPlayer: state.players[0],
      currentBet: 0,
      pot: 0,
      playerBets: Object.fromEntries(state.players.map(p => [p, 0])),
      actedThisRound: [],
      timer: 25,
      timerStarted: Date.now(),
      result: null
    };
  }
}

// ========== 21点 ==========
class Blackjack {
  constructor() {
    this.SUITS = ['spade', 'heart', 'club', 'diamond'];
    this.RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    this.RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':10,'Q':10,'K':10,'A':11 };
  }

  createDeck() {
    const deck = [];
    for (const suit of this.SUITS) {
      for (const rank of this.RANKS) {
        deck.push({ suit, rank, value: this.RANK_VALUES[rank] });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  init(room, players) {
    const deck = this.createDeck();
    const hands = {};
    for (const pid of players) {
      hands[pid] = [deck.pop(), deck.pop()];
    }
    return {
      phase: 'play',
      players,
      hands,
      deck,
      currentPlayer: players[0],
      finishedPlayers: [],
      scores: Object.fromEntries(players.map(p => [p, 0])),
      bustedPlayers: [],
      timer: 20,
      timerStarted: Date.now()
    };
  }

  handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      total += c.value;
      if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  getPublicView(state) {
    const { deck, hands, ...view } = state;
    const handCounts = Object.fromEntries(
      Object.entries(hands || {}).map(([pid, hand]) => [pid, Array.isArray(hand) ? hand.length : 0])
    );
    return {
      ...view,
      deckCount: Array.isArray(deck) ? deck.length : 0,
      handCounts,
      hands: state.phase === 'finished' ? hands : {}
    };
  }

  getPlayerView(state, playerId) {
    const view = this.getPublicView(state);
    if (state.phase !== 'finished') {
      view.hands = {
        [playerId]: state.hands?.[playerId] || []
      };
    }
    return view;
  }

  update(state, action, playerId) {
    if (state.phase !== 'play') return state;
    if (playerId !== state.currentPlayer) return state;
    if (state.finishedPlayers.includes(playerId)) return state;
    if (!['hit', 'stand'].includes(action.type)) return state;

    if (action.type === 'hit') {
      const drawn = state.deck.pop();
      if (!drawn) return state;
      state.hands[playerId].push(drawn);
      const val = this.handValue(state.hands[playerId]);
      if (val > 21) {
        state.bustedPlayers.push(playerId);
        state.finishedPlayers.push(playerId);
      } else if (val === 21) {
        state.finishedPlayers.push(playerId);
      }
    } else if (action.type === 'stand') {
      state.finishedPlayers.push(playerId);
    }

    // 找下一个未完成的玩家
    const remaining = state.players.filter(p => !state.finishedPlayers.includes(p));
    if (remaining.length === 0) {
      return this.resolve(state);
    }
    const idx = (state.players.indexOf(playerId) + 1) % state.players.length;
    state.currentPlayer = state.players[idx];
    while (state.finishedPlayers.includes(state.currentPlayer)) {
      const next = (state.players.indexOf(state.currentPlayer) + 1) % state.players.length;
      state.currentPlayer = state.players[next];
      if (state.currentPlayer === state.players[idx]) {
        return this.resolve(state);
      }
    }
    state.timerStarted = Date.now();
    return state;
  }

  resolve(state) {
    state.phase = 'finished';
    const values = {};
    for (const pid of state.players) {
      if (state.bustedPlayers.includes(pid)) {
        values[pid] = -1; // 爆牌
      } else {
        values[pid] = this.handValue(state.hands[pid]);
      }
    }

    // 找最高分
    let best = null;
    let bestScore = -1;
    for (const pid of state.players) {
      if (values[pid] > bestScore) {
        bestScore = values[pid];
        best = pid;
      }
    }
    state.finalWinner = best;
    state.winner = best;
    state.winningPlayers = best ? [best] : [];
    state.showdownResult = { hands: state.hands, values };
    return state;
  }
}

// ========== 快问快答 ==========
class QuizGame {
  shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  makeQuestion({ q, correct, wrong, category }) {
    const wrongOptions = this.shuffle(wrong).slice(0, 3);
    const options = this.shuffle([correct, ...wrongOptions]);
    return { q, options, answer: options.indexOf(correct), category };
  }

  getGeneralQuestionFacts() {
    return [
      { category: 'geography', q: '下列哪座城市不在欧洲？', correct: '开罗', wrong: ['维也纳', '布拉格', '里斯本', '哥本哈根'] },
      { category: 'geography', q: '下列哪条河流最终流入地中海？', correct: '尼罗河', wrong: ['亚马孙河', '恒河', '密西西比河', '长江'] },
      { category: 'science', q: '声音在下列哪种介质中通常传播最快？', correct: '钢铁', wrong: ['空气', '真空', '水蒸气', '软木'] },
      { category: 'science', q: '下列哪一种变化属于化学变化？', correct: '铁生锈', wrong: ['冰融化', '水蒸发', '玻璃破碎', '盐溶于水'] },
      { category: 'culture', q: '文艺复兴最早兴起于欧洲哪个地区？', correct: '意大利', wrong: ['北欧', '伊比利亚半岛', '巴尔干半岛', '不列颠群岛'] },
      { category: 'culture', q: '下列哪部作品通常被归为莎士比亚的悲剧？', correct: '《哈姆雷特》', wrong: ['《威尼斯商人》', '《仲夏夜之梦》', '《皆大欢喜》', '《暴风雨》'] },
      { category: 'reasoning', q: '如果“所有甲都是乙”成立，下列哪项一定成立？', correct: '不是乙的一定不是甲', wrong: ['所有乙都是甲', '有些甲不是乙', '不是甲的一定不是乙', '甲和乙完全相同'] },
      { category: 'reasoning', q: '“幸存者偏差”最接近下列哪种情况？', correct: '只观察留下来的样本而忽略消失的样本', wrong: ['随机样本数量太大', '所有样本概率完全相同', '重复实验导致结果稳定', '用平均数代替中位数'] },
      { category: 'economics', q: '“机会成本”指的是？', correct: '选择某项方案而放弃的最佳替代收益', wrong: ['已经发生且无法收回的成本', '账面上记录的全部成本', '产品售出后的净利润', '固定资产折旧总额'] },
      { category: 'economics', q: '“通货膨胀”通常表示？', correct: '总体物价水平持续上升', wrong: ['某一商品价格偶然上涨', '失业率持续下降', '货币购买力持续增强', '出口量必然增加'] },
      { category: 'math', q: '一个数增加20%后再减少20%，结果与原数相比？', correct: '减少4%', wrong: ['不变', '增加4%', '减少20%', '增加20%'] },
      { category: 'math', q: '若三个独立事件发生概率均为1/2，它们同时发生的概率是？', correct: '1/8', wrong: ['1/2', '1/4', '3/8', '1/16'] },
      { category: 'life', q: '做实验时设置对照组的主要目的是什么？', correct: '用于比较变量产生的影响', wrong: ['让实验人数更多', '保证结果一定正确', '减少记录工作', '替代实验组'] },
      { category: 'life', q: '阅读统计图时，最需要警惕哪种误导？', correct: '坐标轴截断造成差异被夸大', wrong: ['标题字号太大', '颜色数量太少', '图例放在右侧', '数据点太整齐'] }
    ];
  }

  makeGeneratedQuestion(seed) {
    const generators = [
      () => {
        const base = 12 + Math.floor(Math.random() * 24);
        const percent = [10, 15, 20, 25][Math.floor(Math.random() * 4)];
        const correct = String(Math.round(base * (1 - (percent / 100) ** 2) * 100) / 100);
        return {
          category: 'math',
          q: `某数先增加${percent}%，再减少${percent}%，若原数为${base}，结果最接近多少？`,
          correct,
          wrong: [String(base), String(Math.round(base * (1 - percent / 100) * 100) / 100), String(Math.round(base * (1 + percent / 100) * 100) / 100), String(base - percent / 10)]
        };
      },
      () => {
        const pairs = [
          ['水星', '太阳系中最靠近太阳的行星', ['金星', '火星', '木星', '土星']],
          ['臭氧层', '主要吸收太阳紫外线的地球大气结构', ['电离层', '对流层水汽', '磁层', '平流层云']],
          ['活字印刷术', '北宋毕昇相关的技术发明', ['指南针', '火药', '造纸术', '地动仪']],
          ['二十四节气', '古代中国用于指导农事的时间知识体系', ['十二生肖', '干支纪年', '五行学说', '星座体系']]
        ];
        const [correct, clue, wrong] = pairs[Math.floor(Math.random() * pairs.length)];
        return { category: 'culture', q: `下列哪一项最符合“${clue}”？`, correct, wrong };
      },
      () => {
        const examples = [
          ['把只返回问卷的人当成全部人群来判断', '自选择偏差', ['安慰剂效应', '沉没成本', '边际收益', '规模经济']],
          ['因为已经投入很多而继续投入一个明显不划算的项目', '沉没成本误区', ['幸存者偏差', '从众效应', '机会成本', '路径依赖']],
          ['看到两个变量同时变化，就断定其中一个导致另一个', '相关不等于因果', ['样本均衡', '边际递减', '复利效应', '风险对冲']],
          ['只凭少数醒目案例判断整体概率', '可得性偏差', ['价格歧视', '比较优势', '复盘效应', '对照实验']]
        ];
        const [scene, correct, wrong] = examples[Math.floor(Math.random() * examples.length)];
        return { category: 'reasoning', q: `下面情境最接近哪一个概念：${scene}？`, correct, wrong };
      }
    ];
    return this.makeQuestion(generators[seed % generators.length]());
  }

  generateQuestions(count) {
    const questions = [];
    const seen = new Set();
    const usedCategories = new Set();
    const facts = this.shuffle(this.getGeneralQuestionFacts());

    for (const fact of facts) {
      if (questions.length >= count) break;
      if (seen.has(fact.q) || usedCategories.has(fact.category)) continue;
      questions.push(this.makeQuestion(fact));
      seen.add(fact.q);
      usedCategories.add(fact.category);
    }

    for (const fact of facts) {
      if (questions.length >= count) break;
      if (seen.has(fact.q)) continue;
      questions.push(this.makeQuestion(fact));
      seen.add(fact.q);
    }

    let seed = 0;
    while (questions.length < count) {
      const question = this.makeGeneratedQuestion(seed++);
      if (seen.has(question.q)) continue;
      questions.push(question);
      seen.add(question.q);
    }

    return questions;
  }

  constructor() {
    this.questionBank = [
      { q: '大巴车一般有多少个座位？', options: ['20-30', '30-50', '50-70', '70-90'], answer: 1 },
      { q: '中国最长的河流是？', options: ['黄河', '长江', '珠江', '黑龙江'], answer: 1 },
      { q: '一天有多少小时？', options: ['12', '20', '24', '48'], answer: 2 },
      { q: '水的化学式是？', options: ['CO2', 'H2O', 'O2', 'NaCl'], answer: 1 },
      { q: '世界上最高的山峰是？', options: ['K2', '珠穆朗玛峰', '乞力马扎罗', '富士山'], answer: 1 },
      { q: '一星期有几天？', options: ['5', '6', '7', '8'], answer: 2 },
      { q: '中国的首都是？', options: ['上海', '广州', '北京', '深圳'], answer: 2 },
      { q: '1年有几个月？', options: ['6', '8', '10', '12'], answer: 3 },
      { q: '光速大约是多少km/s？', options: ['30万', '300万', '3000', '3万'], answer: 0 },
      { q: '月亮绕地球一周大约需要？', options: ['7天', '15天', '28天', '365天'], answer: 2 },
      { q: '人民币最大的面值是？', options: ['50元', '100元', '500元', '1000元'], answer: 1 },
      { q: '地球上最大的洲是？', options: ['非洲', '北美洲', '欧洲', '亚洲'], answer: 3 },
      { q: '人体有多少块骨头（成人）？', options: ['106', '206', '306', '406'], answer: 1 },
      { q: '篮球比赛每队上场几人？', options: ['4', '5', '6', '7'], answer: 1 },
      { q: '奥运会几年举办一次？', options: ['2', '3', '4', '5'], answer: 2 },
      { q: '扑克牌有几种花色？', options: ['3', '4', '5', '6'], answer: 1 },
      { q: '一年有多少个节气？', options: ['12', '18', '24', '36'], answer: 2 },
      { q: '中国的母亲河是？', options: ['长江', '黄河', '淮河', '松花江'], answer: 1 },
      { q: '世界人口最多的国家是？', options: ['中国', '印度', '美国', '印尼'], answer: 1 },
      { q: '地球上最大的海洋是？', options: ['大西洋', '印度洋', '太平洋', '北冰洋'], answer: 2 },
      // 团建/办公室趣味题
      { q: '以下哪个不是团建常用活动？', options: ['狼人杀', '剧本杀', '报税', '飞盘'], answer: 2 },
      { q: '团建迟到，最合理的借口是？', options: ['堵车', '闹钟坏了', '外星人绑架', '以上都是'], answer: 3 },
      { q: '以下哪个职业不属于IT部门？', options: ['前端', '后端', '厨师', '测试'], answer: 2 },
      { q: '老板说"简单改一下"，通常意味着？', options: ['5分钟', '1小时', '改到凌晨', '以上都是'], answer: 3 },
      { q: '以下哪个是程序员的续命神器？', options: ['咖啡', '奶茶', '红牛', '以上都是'], answer: 3 }
    ];
  }

  init(room, players) {
    const roundCount = 3;
    {
      const questions = this.generateQuestions(roundCount);

      return {
        phase: 'question',       // question | answer | finished
        round: 1,
        maxRounds: roundCount,
        players,
        questions,
        currentQuestion: questions[0],
        answers: {},              // { playerId: answerIndex }
        answeredPlayers: [],
        scores: Object.fromEntries(players.map(p => [p, 0])),
        correctPlayers: [],
        timer: 15,
        timerStarted: Date.now(),
        roundResult: null
      };
    }
    const hardQuestions = [
      { q: '如果所有“甲类”都是“乙类”，且部分“乙类”是“丙类”，必然成立的是？', options: ['所有甲类是丙类', '部分甲类是丙类', '部分乙类可能不是甲类', '所有丙类是乙类'], answer: 2 },
      { q: '二进制数 101101 转换为十进制是多少？', options: ['41', '43', '45', '47'], answer: 2 },
      { q: '“纳什均衡”最常用于描述哪一类问题？', options: ['热力学平衡', '博弈策略稳定状态', '天体轨道共振', '统计抽样误差'], answer: 1 },
      { q: '成语“曲高和寡”原本更接近表达什么含义？', options: ['作品越高明，能理解的人越少', '音乐越响亮，观众越少', '曲调越快，唱和越难', '身份越高，朋友越少'], answer: 0 },
      { q: '在 Excel 中，若 A1=8、A2=3，公式 =MOD(A1,A2) 的结果是？', options: ['1', '2', '2.67', '5'], answer: 1 },
      { q: '太阳光到达地球大约需要多久？', options: ['8秒20毫秒', '8分20秒', '80分钟', '1天'], answer: 1 },
      { q: '下列哪一项最接近“幸存者偏差”的含义？', options: ['只分析留下来的样本导致判断偏差', '样本数量过大导致误差变小', '随机抽样时每个样本概率相同', '重复实验导致结果趋同'], answer: 0 },
      { q: '如果一个项目的关键路径延误 2 天，且没有备用缓冲，通常会怎样？', options: ['总工期大概率延误', '只影响非关键任务', '资源成本必然下降', '风险自动消除'], answer: 0 },
      { q: '“边际成本”指的是？', options: ['已经投入且无法收回的成本', '额外生产一单位带来的新增成本', '全部固定成本总和', '平均到每件产品的总成本'], answer: 1 },
      { q: 'HTTP 状态码 409 通常表示？', options: ['未授权', '资源冲突', '服务不可用', '永久重定向'], answer: 1 },
      { q: '若三个事件彼此独立，且概率均为 1/2，它们同时发生的概率是？', options: ['1/2', '1/4', '1/8', '3/8'], answer: 2 },
      { q: '下列哪种排序算法的平均时间复杂度通常为 O(n log n)？', options: ['冒泡排序', '插入排序', '快速排序', '线性查找'], answer: 2 }
    ];
    const shuffled = [...hardQuestions].sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, roundCount);

    return {
      phase: 'question',       // question | answer | finished
      round: 1,
      maxRounds: roundCount,
      players,
      questions,
      currentQuestion: questions[0],
      answers: {},              // { playerId: answerIndex }
      answeredPlayers: [],
      scores: Object.fromEntries(players.map(p => [p, 0])),
      correctPlayers: [],       // 本轮答对的
      timer: 15,                // 每题15秒
      timerStarted: Date.now(),
      roundResult: null
    };
  }

  update(state, action, playerId) {
    if (state.phase !== 'question') return state;
    if (state.answeredPlayers.includes(playerId)) return state;

    if (action.type === 'answer') {
      state.answers[playerId] = action.answer;
      state.answeredPlayers.push(playerId);

      // 所有人都答了 → 判定
      if (state.answeredPlayers.length >= state.players.length) {
        return this.resolveRound(state);
      }
    }

    return state;
  }

  resolveRound(state) {
    const correct = state.currentQuestion.answer;
    state.correctPlayers = [];

    for (const pid of state.answeredPlayers) {
      if (state.answers[pid] === correct) {
        state.correctPlayers.push(pid);
        state.scores[pid] += 1;
      }
    }

    state.roundResult = {
      question: state.currentQuestion,
      correct,
      answers: { ...state.answers },
      correctPlayers: [...state.correctPlayers],
      round: state.round
    };

    if (state.round >= state.maxRounds) {
      state.phase = 'finished';
      let best = state.players[0];
      for (const pid of state.players) {
        if (state.scores[pid] > state.scores[best]) {
          best = pid;
        }
      }
      state.finalWinner = best;
      state.showdownResult = { scores: state.scores };
      return state;
    }

    state.phase = 'answer';
    state.timer = 8;
    state.timerStarted = Date.now();
    return state;
  }

  nextRound(state) {
    state.round++;
    if (state.round > state.maxRounds) {
      state.phase = 'finished';
      // 找得分最高的
      let best = state.players[0];
      for (const pid of state.players) {
        if (state.scores[pid] > state.scores[best]) {
          best = pid;
        }
      }
      state.finalWinner = best;
      state.showdownResult = { scores: state.scores };
    } else {
      state.phase = 'question';
      state.currentQuestion = state.questions[state.round - 1];
      state.answers = {};
      state.answeredPlayers = [];
      state.correctPlayers = [];
      state.roundResult = null;
      state.timer = 15;
      state.timerStarted = Date.now();
    }
    return state;
  }
}

// ========== 掼蛋（简化版）==========
// 简化规则: 2人对战, 每人27张(2副牌104张去掉8张), 出牌型: 单张/对子/三张/顺子
// 上家出牌后下家必须出更大同牌型或过牌, 先出完手牌者获胜
class GuandanGame {
  constructor() {
    this.SUITS = ['spade', 'heart', 'club', 'diamond'];
    this.RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    this.RANK_VALUES = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
  }

  createDoubleDeck() {
    const deck = [];
    // 2副牌
    for (let d = 0; d < 2; d++) {
      for (const suit of this.SUITS) {
        for (const rank of this.RANKS) {
          deck.push({ suit, rank, value: this.RANK_VALUES[rank] });
        }
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // 牌型识别
  identifyPattern(cards) {
    if (!cards || cards.length === 0) return null;
    const sorted = [...cards].sort((a, b) => a.value - b.value);
    const values = sorted.map(c => c.value);

    // 单张
    if (cards.length === 1) return { type: 'single', value: values[0], cards };

    // 对子
    if (cards.length === 2 && values[0] === values[1]) return { type: 'pair', value: values[0], cards };

    // 三张
    if (cards.length === 3 && values[0] === values[1] && values[1] === values[2])
      return { type: 'triple', value: values[0], cards };

    // 三带一
    if (cards.length === 4) {
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const entries = Object.entries(counts).map(([v, c]) => ({ value: parseInt(v), count: c }));
      const triple = entries.find(e => e.count === 3);
      if (triple) return { type: 'triple1', value: triple.value, cards };
    }

    // 三带二(对子)
    if (cards.length === 5) {
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const entries = Object.entries(counts).map(([v, c]) => ({ value: parseInt(v), count: c }));
      const triple = entries.find(e => e.count === 3);
      const pair = entries.find(e => e.count === 2);
      if (triple && pair) return { type: 'triple2', value: triple.value, cards };
    }

    // 顺子(5张连续)
    if (cards.length === 5) {
      const unique = [...new Set(values)].sort((a, b) => a - b);
      if (unique.length === 5 && unique[4] - unique[0] === 4) {
        return { type: 'straight', value: unique[4], cards };
      }
    }

    // 连对(3对连续, 6张)
    if (cards.length === 6) {
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const pairs = Object.entries(counts).filter(([v, c]) => c === 2).map(([v]) => parseInt(v)).sort((a,b) => a-b);
      if (pairs.length === 3 && pairs[2] - pairs[0] === 2) {
        return { type: 'doubleStraight', value: pairs[2], cards };
      }
    }

    // 钢板(2个三张连续, 6张)
    if (cards.length === 6) {
      const counts = {};
      values.forEach(v => counts[v] = (counts[v] || 0) + 1);
      const triples = Object.entries(counts).filter(([v, c]) => c === 3).map(([v]) => parseInt(v)).sort((a,b) => a-b);
      if (triples.length === 2 && triples[1] - triples[0] === 1) {
        return { type: 'steel', value: triples[1], cards };
      }
    }

    return { type: 'invalid', value: 0, cards };
  }

  // 能否管上
  canBeat(newCards, lastPattern) {
    if (!lastPattern) return true; // 首家任意出牌
    const newPat = this.identifyPattern(newCards);
    if (!newPat || newPat.type === 'invalid') return false;
    if (newPat.type !== lastPattern.type) return false;
    return newPat.value > lastPattern.value;
  }

  init(room, players) {
    const deck = this.createDoubleDeck();
    const hands = {};
    // 每人27张 (104张牌 / 4 ≈ 26, 简化为2人各27)
    const perPlayer = 27;
    for (const pid of players) {
      hands[pid] = deck.splice(0, perPlayer);
      // 自动理牌(按value排序)
      hands[pid].sort((a, b) => a.value - b.value);
    }

    return {
      phase: 'play',           // play | finished
      players,
      hands,
      currentPlayer: players[0],
      lastPlay: null,          // { playerId, cards, pattern }
      lastPlayer: null,
      passedPlayers: [],       // 本轮过牌的玩家
      finishedOrder: [],       // 完成顺序
      timer: 30,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (state.phase !== 'play') return state;
    if (playerId !== state.currentPlayer) return state;

    if (action.type === 'play') {
      const cards = action.cards; // [{suit, rank, value}, ...]
      const pattern = this.identifyPattern(cards);
      if (!pattern || pattern.type === 'invalid') return state;

      // 检查是否能管上
      if (!this.canBeat(cards, state.lastPlay?.pattern)) return state;

      // 从手牌中移除出的牌
      const hand = state.hands[playerId];
      for (const card of cards) {
        const idx = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
        if (idx >= 0) hand.splice(idx, 1);
      }

      state.lastPlay = { playerId, cards, pattern };
      state.lastPlayer = playerId;
      state.passedPlayers = [];

      // 检查是否出完
      if (hand.length === 0) {
        state.phase = 'finished';
        state.finishedOrder.push(playerId);
        state.finalWinner = playerId;
        return state;
      }

      // 下一个玩家
      state.currentPlayer = state.players.find(p => p !== playerId);
      state.timerStarted = Date.now();
    }

    if (action.type === 'pass') {
      // 不能是首家(首家必须出牌)
      if (!state.lastPlay || state.lastPlayer === playerId) return state;

      state.passedPlayers.push(playerId);

      // 如果其他所有人都过牌 → 最后出牌的人重新获得出牌权
      const others = state.players.filter(p => p !== state.lastPlayer);
      if (others.every(p => state.passedPlayers.includes(p))) {
        state.currentPlayer = state.lastPlayer;
        state.lastPlay = null;
        state.passedPlayers = [];
      } else {
        state.currentPlayer = state.players.find(p =>
          p !== playerId && p !== state.currentPlayer
        );
      }
      state.timerStarted = Date.now();
    }

    return state;
  }
}

// ========== 四川麻将（简化版）==========
// 简化规则: 4人, 每人13张起手, 只保留万子(1-9)*4=36张, 简化到每人9张
// 核心循环: 摸牌 → 打牌 → 检查胡牌 → 下一人
// 胡牌检测: 简化版 n*AAA/AAA + 一对
class MahjongGame {
  constructor() {
    this.SUITS = ['wan']; // 只保留万子
    this.RANKS = ['1','2','3','4','5','6','7','8','9'];
  }

  createDeck() {
    const deck = [];
    for (const rank of this.RANKS) {
      for (let i = 0; i < 4; i++) { // 每张4张
        deck.push({ suit: 'wan', rank, value: parseInt(rank) });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // 检查是否能胡 (简化: 4组+1对, 共14张)
  checkWin(hand) {
    if (hand.length !== 14) return false;
    const sorted = [...hand].sort((a, b) => a.value - b.value);
    const counts = {};
    sorted.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1);

    // 尝试每种可能的将牌(对子)
    for (const pairVal of Object.keys(counts)) {
      if (counts[pairVal] < 2) continue;
      const remaining = { ...counts };
      remaining[pairVal] -= 2;

      if (this.canFormSets(remaining)) return true;
    }
    return false;
  }

  canFormSets(counts) {
    const vals = Object.keys(counts).map(Number).sort((a, b) => a - b);
    if (vals.length === 0) return true;

    const first = vals[0];
    if (!counts[first] || counts[first] === 0) {
      delete counts[first];
      return this.canFormSets(counts);
    }

    // 尝试刻子(三张相同)
    if (counts[first] >= 3) {
      const newCounts = { ...counts };
      newCounts[first] -= 3;
      if (newCounts[first] === 0) delete newCounts[first];
      if (this.canFormSets(newCounts)) return true;
    }

    // 尝试顺子(三张连续)
    if (counts[first + 1] > 0 && counts[first + 2] > 0) {
      const newCounts = { ...counts };
      newCounts[first]--;
      newCounts[first + 1]--;
      newCounts[first + 2]--;
      if (newCounts[first] === 0) delete newCounts[first];
      if (newCounts[first + 1] === 0) delete newCounts[first + 1];
      if (newCounts[first + 2] === 0) delete newCounts[first + 2];
      if (this.canFormSets(newCounts)) return true;
    }

    return false;
  }

  init(room, players) {
    const deck = this.createDeck();
    const hands = {};
    const perPlayer = 13;
    for (const pid of players) {
      hands[pid] = deck.splice(0, perPlayer);
      hands[pid].sort((a, b) => a.value - b.value);
    }

    return {
      phase: 'draw',           // draw | discard | win | finished
      players,
      hands,
      deck,
      currentPlayer: players[0],
      lastDiscard: null,       // { playerId, card }
      discarded: [],           // 所有打出的牌
      timer: 30,
      timerStarted: Date.now()
    };
  }

  update(state, action, playerId) {
    if (playerId !== state.currentPlayer) return state;

    // 摸牌阶段
    if (state.phase === 'draw') {
      if (state.deck.length === 0) {
        state.phase = 'finished';
        state.finalWinner = null; // 流局
        return state;
      }
      const drawn = state.deck.pop();
      state.hands[playerId].push(drawn);
      state.hands[playerId].sort((a, b) => a.value - b.value);

      // 检查是否自摸胡
      if (this.checkWin(state.hands[playerId])) {
        state.phase = 'finished';
        state.finalWinner = playerId;
        state.winType = '自摸';
        return state;
      }

      state.phase = 'discard';
      state.timerStarted = Date.now();
      return state;
    }

    // 打牌阶段
    if (state.phase === 'discard' && action.type === 'discard') {
      const card = action.card;
      const hand = state.hands[playerId];
      const idx = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      if (idx < 0) return state;

      hand.splice(idx, 1);
      state.lastDiscard = { playerId, card };
      state.discarded.push(card);

      // 检查其他玩家是否能胡这张牌
      for (const pid of state.players) {
        if (pid === playerId) continue;
        const testHand = [...state.hands[pid], card];
        if (this.checkWin(testHand)) {
          state.phase = 'finished';
          state.finalWinner = pid;
          state.winType = '点炮';
          state.winner = pid;
          return state;
        }
      }

      // 下一个玩家
      const idx2 = state.players.indexOf(playerId);
      state.currentPlayer = state.players[(idx2 + 1) % state.players.length];
      state.phase = 'draw';
      state.timerStarted = Date.now();
      return state;
    }

    return state;
  }
}

// ========== 引擎注册表 ==========
const engines = {
  rock_paper_scissors: new RockPaperScissors(),
  reaction_race: new ReactionRace(),
  dice_roll: new DiceRoll(),
  guess_dice: new GuessDice(),
  zha_jin_hua: cardEngines.zha_jin_hua,
  blackjack: new Blackjack(),
  quiz: new QuizGame(),
  guandan: cardEngines.guandan,
  doudizhu: cardEngines.doudizhu,
  mahjong: cardEngines.mahjong,
  gomoku: new (require('./game-engines/gomoku')).GomokuEngine(),
  chess: new (require('./game-engines/chess')).ChessEngine()
};

// 费用配置
const GAME_CONFIG = {
  rock_paper_scissors: {
    name: '剪刀石头布',
    entryFee: 10,
    category: 'quick',
    minPlayers: 2,
    maxPlayers: 2,
    duration: '10-20秒'
  },
  reaction_race: {
    name: '看谁快',
    entryFee: 10,
    category: 'quick',
    minPlayers: 2,
    maxPlayers: 6,
    duration: '10秒'
  },
  dice_roll: {
    name: '摇骰子',
    entryFee: 10,
    category: 'quick',
    minPlayers: 2,
    maxPlayers: 6,
    duration: '10秒'
  },
  guess_dice: {
    name: '猜点数',
    entryFee: 10,
    category: 'quick',
    minPlayers: 3,
    maxPlayers: 6,
    duration: '15秒'
  },
  blackjack: {
    name: '21点对决',
    entryFee: 30,
    category: 'medium',
    minPlayers: 2,
    maxPlayers: 4,
    duration: '1分钟'
  },
  zha_jin_hua: {
    name: '炸金花',
    entryFee: 10,
    category: 'card',
    minPlayers: 2,
    maxPlayers: 5,
    duration: '2分钟'
  },
  guandan: {
    name: '掼蛋',
    entryFee: 100,
    category: 'card',
    minPlayers: 4,
    maxPlayers: 4,
    duration: '3-5分钟'
  },
  doudizhu: {
    name: '斗地主',
    entryFee: 50,
    category: 'card',
    minPlayers: 3,
    maxPlayers: 3,
    duration: '3-5分钟'
  },
  mahjong: {
    name: '南京麻将',
    entryFee: 50,
    category: 'card',
    minPlayers: 4,
    maxPlayers: 4,
    duration: '5-10分钟'
  },
  quiz: {
    name: '快问快答',
    entryFee: 20,
    category: 'quick',
    minPlayers: 2,
    maxPlayers: 4,
    duration: '1分钟'
  },
  gomoku: {
    name: '五子棋',
    entryFee: 30,
    category: 'board',
    minPlayers: 2,
    maxPlayers: 2,
    duration: '2-5分钟'
  },
  chess: {
    name: '象棋',
    entryFee: 50,
    category: 'board',
    minPlayers: 2,
    maxPlayers: 2,
    duration: '5-10分钟'
  }
};

function getEngine(gameType) {
  return engines[gameType] || null;
}

function getGameConfig(gameType) {
  return GAME_CONFIG[gameType] || null;
}

function getAllGameConfigs() {
  return GAME_CONFIG;
}

module.exports = { getEngine, getGameConfig, getAllGameConfigs };
