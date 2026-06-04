<template>
  <main class="rules-page">
    <div class="rules-shell">
      <header class="rules-hero">
        <button type="button" class="back-btn" @click="$router.push('/lobby')">← 返回</button>
        <div>
          <p class="eyebrow">Game Guide</p>
          <h1>规则说明</h1>
          <p class="hero-copy">快速了解每款游戏怎么玩，以及对局结束后积分如何增减。</p>
        </div>
      </header>

      <section class="summary-card">
        <h2>通用积分规则</h2>
        <div class="summary-grid">
          <article v-for="item in summaryRules" :key="item.title" class="summary-item">
            <strong>{{ item.title }}</strong>
            <span>{{ item.text }}</span>
          </article>
        </div>
      </section>

      <section class="games-rules">
        <article v-for="game in gameRules" :key="game.key" class="game-rule-card">
          <div class="game-rule-card__head">
            <div>
              <span class="game-tag">{{ game.tag }}</span>
              <h2>{{ game.name }}</h2>
            </div>
            <strong class="entry-fee">门票 {{ game.entryFee }}分</strong>
          </div>

          <div class="rule-block">
            <h3>玩法</h3>
            <p>{{ game.play }}</p>
          </div>

          <div class="rule-block">
            <h3>胜负判定</h3>
            <p>{{ game.win }}</p>
          </div>

          <div class="rule-block">
            <h3>积分结算</h3>
            <ul>
              <li v-for="rule in game.scoring" :key="rule">{{ rule }}</li>
            </ul>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup>
const summaryRules = [
  {
    title: '1v1 对局',
    text: '赢家净加门票分，输家净扣门票分；平局不产生积分变化。'
  },
  {
    title: '多人奖池',
    text: '无特殊倍率的多人局按门票形成奖池，赢家平分奖池收益，输家扣除门票。'
  },
  {
    title: '特殊结算',
    text: '斗地主、掼蛋、炸金花、红中麻将按各自倍率、奖池或牌局分数单独结算。'
  }
]

const gameRules = [
  {
    key: 'rock_paper_scissors',
    name: '剪刀石头布',
    tag: '双人速决',
    entryFee: 10,
    play: '两名玩家每局同时选择剪刀、石头或布。石头胜剪刀，剪刀胜布，布胜石头；3 秒内未选择会自动出拳。',
    win: '三局两胜，先赢 2 局者获胜；如果双方出同样手势，平局不计分并立即重开当前局。',
    scoring: [
      '整场胜者 +10 分，败者 -10 分。',
      '小局平局不结算积分，最终分出整场胜负后才结算。'
    ]
  },
  {
    key: 'guess_dice',
    name: '猜点数',
    tag: '三到六人',
    entryFee: 10,
    play: '3 到 6 人参与。每名玩家选择 1 到 6 的一个点数，系统摇出一颗骰子作为开奖结果。',
    win: '猜中开奖结果的玩家获胜；可能多人同时猜中，也可能无人猜中。',
    scoring: [
      '猜中的玩家各 +10 分，猜错的玩家各 -10 分。',
      '如果所有玩家都猜中，则所有人都 +10 分；如果无人猜中，则所有人都 -10 分。'
    ]
  },
  {
    key: 'blackjack',
    name: '21点',
    tag: '二到四人',
    entryFee: 30,
    play: '2 到 4 人参与。每人开局发 2 张牌，轮到自己时可以要牌或停牌；A 可按 11 点或 1 点计算。',
    win: '所有玩家停牌、爆牌或达到 21 点后结算；未爆牌且点数最高的玩家获胜。',
    scoring: [
      '胜者按当前多人结算规则获得本局收益。',
      '爆牌玩家无法获胜；超时会自动停牌。'
    ]
  },
  {
    key: 'quiz',
    name: '快问快答',
    tag: '知识竞速',
    entryFee: 20,
    play: '2 到 4 人参与，共 3 题。每题限时作答，答对者本题得 1 分。',
    win: '三题结束后，题内得分最高的玩家获胜。',
    scoring: [
      '按多人奖池结算：总奖池 = 20 分 × 参赛人数。',
      '胜者获得奖池收益，净收益约为奖池份额 - 20 分；其他玩家各 -20 分。'
    ]
  },
  {
    key: 'gomoku',
    name: '五子棋',
    tag: '经典棋盘',
    entryFee: 30,
    play: '两名玩家轮流落子，棋盘为 14 × 14。先手执黑，后手执白。',
    win: '任意横、竖、斜方向先连成 5 子的一方获胜；棋盘下满仍无人连五则为平局。',
    scoring: [
      '胜者 +30 分，败者 -30 分。',
      '平局不增减积分。'
    ]
  },
  {
    key: 'chess',
    name: '象棋',
    tag: '残局博弈',
    entryFee: 50,
    play: '两名玩家按中国象棋规则轮流走子，红方先行。系统会校验合法走法和将帅照面。',
    win: '吃掉对方将/帅，或让对方无合法走法时获胜；双方同意和棋则为平局。',
    scoring: [
      '胜者 +50 分，败者 -50 分。',
      '和棋不增减积分。'
    ]
  },
  {
    key: 'doudizhu',
    name: '斗地主',
    tag: '三人扑克',
    entryFee: 50,
    play: '三人发牌后叫分抢地主，地主拿底牌并先出。玩家按牌型压牌或选择过牌，先出完手牌的一方获胜。',
    win: '地主先出完则地主单独获胜；任意农民先出完则两名农民共同获胜。',
    scoring: [
      '基础结算单位为 50 分。',
      '每出现 1 个炸弹或王炸，结算单位额外 +50 分。',
      '地主胜：地主 +(结算单位 × 2)，两名农民各 -结算单位。',
      '农民胜：地主 -(结算单位 × 2)，两名农民各 +结算单位。'
    ]
  },
  {
    key: 'guandan',
    name: '掼蛋',
    tag: '四人组队',
    entryFee: 100,
    play: '四人两副牌，南北一队、东西一队。玩家轮流出牌或过牌，牌型需大过上家，先出完者进入名次序列。',
    win: '按出完顺序结算本轮。头游所在队为胜方；同队包揽前两名升 3 级，头游和三游同队升 2 级，其他情况升 1 级。打到 1 级时比赛结束。',
    scoring: [
      '胜方每人获得：100 分 + 级差奖励；负方每人扣除同等分数。',
      '级差奖励 = 胜方结算后等级与负方等级的差值 × 20 分。',
      '例如从 2 升到 3 且对方仍为 2，本轮每名胜方玩家 +120 分，负方玩家 -120 分。'
    ]
  },
  {
    key: 'zha_jin_hua',
    name: '炸金花',
    tag: '筹码奖池',
    entryFee: 20,
    play: '2 到 5 人每人 3 张牌。玩家可看牌、跟注、加注、比牌或弃牌；看牌后下注按明牌倍数计算。',
    win: '其他玩家弃牌或比牌出局后，最后留在场上的玩家获胜；也可摊牌比较牌型，牌型大者获胜。',
    scoring: [
      '基础下注 20 分，加注步长 20 分。',
      '暗牌单次下注上限 50 分，明牌单次下注上限 100 分。',
      '赢家获得当前奖池扣除自己已投入后的净收益；输家扣除自己本局实际投入。',
      '提前弃牌的玩家按已投入分数即时扣除，不再参与最终奖池分配。'
    ]
  },
  {
    key: 'mahjong',
    name: '红中麻将',
    tag: '四人番型',
    entryFee: 50,
    play: '四人红中推倒胡，摸牌、打牌、碰、杠、胡按顺序进行。红中可参与胡牌判断，牌山剩余过少会流局。',
    win: '玩家自摸、点炮胡、杠上开花、抢杠胡、天胡、地胡或四红中均可结束对局；流局无人获胜。',
    scoring: [
      '底分为 50 分，最终直接按牌局内净分写入玩家积分。',
      '自摸、杠上开花、四红中、天胡：其余三家各赔 番数 × 50 分。',
      '点炮：放炮者赔 番数 × 50 × 3 分。',
      '抢杠胡：被抢杠者赔 番数 × 50 × 3 分。',
      '杠分即时结算：暗杠三家各赔 100 分，补杠三家各赔 50 分，明杠由点杠者赔 150 分。',
      '常见番型：平胡 1 番，对对胡 2 番，清一色 3 番，七对 3 番，杠上开花 2 番，天胡 5 番，地胡 4 番，四红中 4 番，无红中胡 2 番。'
    ]
  }
]
</script>

<style scoped>
.rules-page {
  min-height: 100vh;
  padding: 14px 10px 28px;
  background:
    radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.42), transparent 22%),
    radial-gradient(circle at 88% 0%, rgba(255, 225, 108, 0.34), transparent 18%),
    linear-gradient(180deg, #0b72f8 0%, #24a9ff 38%, #eaf8ff 100%);
}

.rules-shell {
  width: min(100%, 720px);
  margin: 0 auto;
}

.rules-hero {
  position: relative;
  overflow: hidden;
  min-height: 178px;
  padding: 16px;
  border-radius: 28px;
  color: #fff;
  background:
    radial-gradient(circle at 78% 18%, rgba(255, 230, 128, 0.36), transparent 20%),
    linear-gradient(150deg, #1168f2, #02a3f2 62%, #55d1ff);
  box-shadow: 0 18px 36px rgba(3, 74, 180, 0.24);
}

.rules-hero::after {
  content: '?';
  position: absolute;
  right: -12px;
  bottom: -54px;
  color: rgba(255, 255, 255, 0.16);
  font-size: 180px;
  line-height: 1;
  font-weight: 1000;
}

.back-btn {
  position: relative;
  z-index: 1;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  color: #0f61e8;
  background: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(0, 70, 175, 0.16);
}

.rules-hero div {
  position: relative;
  z-index: 1;
  margin-top: 20px;
}

.eyebrow,
.rules-hero h1,
.hero-copy,
.summary-card h2,
.game-rule-card h2,
.rule-block h3,
.rule-block p {
  margin: 0;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.8;
  font-weight: 800;
}

.rules-hero h1 {
  margin-top: 4px;
  font-size: 34px;
  line-height: 1.05;
  font-weight: 1000;
}

.hero-copy {
  width: min(100%, 360px);
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  line-height: 1.6;
  font-weight: 700;
}

.summary-card,
.game-rule-card {
  border: 2px solid var(--panel-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(239, 247, 255, 0.98));
  box-shadow: var(--shadow-soft);
}

.summary-card {
  margin-top: 14px;
  padding: 14px;
  border-radius: 26px;
}

.summary-card h2 {
  color: #153260;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 1000;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.summary-item {
  min-height: 112px;
  padding: 12px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #dceafb;
}

.summary-item strong,
.summary-item span {
  display: block;
}

.summary-item strong {
  color: #0e61e8;
  font-size: 15px;
  font-weight: 1000;
}

.summary-item span {
  margin-top: 8px;
  color: #5d779f;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 700;
}

.games-rules {
  margin-top: 14px;
  display: grid;
  gap: 12px;
}

.game-rule-card {
  padding: 14px;
  border-radius: 26px;
}

.game-rule-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.game-tag {
  display: inline-flex;
  min-height: 24px;
  padding: 0 10px;
  align-items: center;
  border-radius: 999px;
  background: #eaf4ff;
  color: #1665dd;
  font-size: 12px;
  font-weight: 1000;
}

.game-rule-card h2 {
  margin-top: 6px;
  color: #153260;
  font-size: 24px;
  line-height: 1.12;
  font-weight: 1000;
}

.entry-fee {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: linear-gradient(180deg, #fff4c7, #ffe07b);
  color: #b46500;
  font-size: 13px;
  font-weight: 1000;
  box-shadow: 0 8px 16px rgba(193, 129, 0, 0.12);
}

.rule-block {
  margin-top: 12px;
  padding: 12px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #dceafb;
}

.rule-block h3 {
  color: #0f61e8;
  font-size: 15px;
  line-height: 1.2;
  font-weight: 1000;
}

.rule-block p,
.rule-block li {
  color: #4f6c98;
  font-size: 14px;
  line-height: 1.62;
  font-weight: 700;
}

.rule-block p {
  margin-top: 7px;
}

.rule-block ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.rule-block li + li {
  margin-top: 5px;
}

@media (max-width: 560px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .summary-item {
    min-height: auto;
  }

  .rules-hero h1 {
    font-size: 32px;
  }

  .game-rule-card__head {
    display: grid;
  }

  .entry-fee {
    justify-self: start;
  }
}
</style>
