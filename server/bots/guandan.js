const { identifyPattern, comparePattern } = require('../game-engines/guandan');

function groupByRank(hand) {
  return hand.reduce((map, card) => {
    const list = map.get(card.rank) || [];
    list.push(card);
    map.set(card.rank, list);
    return map;
  }, new Map());
}

function buildPatternCandidates(hand, level) {
  const groups = [...groupByRank(hand).values()].sort((a, b) => a[0].value - b[0].value);
  const candidates = [];

  hand.forEach((card) => {
    candidates.push({ cards: [card], pattern: identifyPattern([card], level) });
  });

  groups.forEach((group) => {
    if (group.length >= 2) {
      const cards = group.slice(0, 2);
      candidates.push({ cards, pattern: identifyPattern(cards, level) });
    }
    if (group.length >= 3) {
      const cards = group.slice(0, 3);
      candidates.push({ cards, pattern: identifyPattern(cards, level) });
    }
    if (group.length >= 4) {
      const cards = group.slice(0, group.length);
      candidates.push({ cards, pattern: identifyPattern(cards, level) });
    }
  });

  const triples = groups.filter((group) => group.length >= 3);
  triples.forEach((group) => {
    const wingSource = hand.find((card) => card.rank !== group[0].rank);
    if (wingSource) {
      const cards = [...group.slice(0, 3), wingSource];
      const pattern = identifyPattern(cards, level);
      if (pattern && pattern.type !== 'invalid') candidates.push({ cards, pattern });
    }
  });

  triples.forEach((group) => {
    const pairSource = groups.find((candidate) => candidate[0].rank !== group[0].rank && candidate.length >= 2);
    if (pairSource) {
      const cards = [...group.slice(0, 3), ...pairSource.slice(0, 2)];
      const pattern = identifyPattern(cards, level);
      if (pattern && pattern.type !== 'invalid') candidates.push({ cards, pattern });
    }
  });

  return candidates.filter((item) => item.pattern && item.pattern.type !== 'invalid');
}

function findPlayableSets(hand, level, lastPattern) {
  return buildPatternCandidates(hand, level)
    .filter((item) => !lastPattern || comparePattern(item.pattern, lastPattern) > 0)
    .sort((a, b) => {
      if (a.pattern.type !== b.pattern.type) return a.pattern.mainValue - b.pattern.mainValue;
      return a.cards.length - b.cards.length || a.pattern.mainValue - b.pattern.mainValue;
    });
}

function guandanStrategy(state, botId) {
  if (state.currentPlayer !== botId || state.phase !== 'play') return null;
  const hand = state.hands[botId] || [];
  if (!hand.length) return null;

  const lastPattern = state.lastPattern;
  const playable = findPlayableSets(hand, state.level, lastPattern);
  if (playable.length === 0) {
    return { type: 'pass' };
  }

  const teamKey = state.teams.south_north.includes(botId) ? 'south_north' : 'east_west';
  const leadTeamKey = state.lastLeadPlayer
    ? (state.teams.south_north.includes(state.lastLeadPlayer) ? 'south_north' : 'east_west')
    : null;

  if (lastPattern && leadTeamKey === teamKey && playable.some((item) => item.pattern.type !== 'bomb' && item.pattern.type !== 'rocket')) {
    return { type: 'pass' };
  }

  const choice = playable.find((item) => item.pattern.type !== 'bomb' && item.pattern.type !== 'straight_flush' && item.pattern.type !== 'rocket') || playable[0];
  return { type: 'play', cards: choice.cards };
}

module.exports = { guandanStrategy };
