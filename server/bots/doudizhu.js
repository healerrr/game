const { identifyPattern, comparePattern } = require('../game-engines/doudizhu');

function groupByRank(hand) {
  return hand.reduce((map, card) => {
    const list = map.get(card.rank) || [];
    list.push(card);
    map.set(card.rank, list);
    return map;
  }, new Map());
}

function pushCandidate(candidates, cards) {
  const pattern = identifyPattern(cards);
  if (pattern && pattern.type !== 'invalid') candidates.push({ cards, pattern });
}

function buildCandidates(hand) {
  const groups = [...groupByRank(hand).values()].sort((a, b) => a[0].value - b[0].value);
  const candidates = [];

  hand.forEach((card) => pushCandidate(candidates, [card]));

  groups.forEach((group) => {
    if (group.length >= 2) pushCandidate(candidates, group.slice(0, 2));
    if (group.length >= 3) pushCandidate(candidates, group.slice(0, 3));
    if (group.length === 4) pushCandidate(candidates, group.slice(0, 4));
  });

  groups.forEach((group) => {
    if (group.length < 3) return;
    const single = hand.find((card) => card.rank !== group[0].rank);
    if (single) pushCandidate(candidates, [...group.slice(0, 3), single]);
    const pair = groups.find((item) => item[0].rank !== group[0].rank && item.length >= 2);
    if (pair) pushCandidate(candidates, [...group.slice(0, 3), ...pair.slice(0, 2)]);
  });

  const jokers = hand.filter((card) => card.suit === 'joker');
  if (jokers.length === 2) pushCandidate(candidates, jokers);

  return candidates.filter((item) => item.pattern && item.pattern.type !== 'invalid');
}

function findPlayableSets(hand, lastPattern) {
  return buildCandidates(hand)
    .filter((item) => !lastPattern || comparePattern(item.pattern, lastPattern) > 0)
    .sort((a, b) => {
      const aBomb = ['bomb', 'rocket'].includes(a.pattern.type);
      const bBomb = ['bomb', 'rocket'].includes(b.pattern.type);
      if (aBomb !== bBomb) return aBomb ? 1 : -1;
      return a.pattern.mainValue - b.pattern.mainValue || a.cards.length - b.cards.length;
    });
}

function doudizhuStrategy(state, botId) {
  if (state.currentPlayer !== botId || state.phase !== 'play') return null;
  const hand = state.hands[botId] || [];
  if (!hand.length) return null;

  const lastPattern = state.lastPattern;
  const playable = findPlayableSets(hand, lastPattern);
  if (playable.length === 0) return { type: 'pass' };

  const isFarmer = botId !== state.landlord;
  const leadIsFarmerPartner = state.lastLeadPlayer &&
    state.lastLeadPlayer !== state.landlord &&
    state.lastLeadPlayer !== botId;
  if (lastPattern && isFarmer && leadIsFarmerPartner) {
    const nonBomb = playable.find((item) => !['bomb', 'rocket'].includes(item.pattern.type));
    if (nonBomb) return { type: 'pass' };
  }

  const choice = playable.find((item) => !['bomb', 'rocket'].includes(item.pattern.type)) || playable[0];
  return { type: 'play', cards: choice.cards };
}

module.exports = { doudizhuStrategy };
