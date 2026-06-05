const { createStandardDeck, shuffle, DEFAULT_RANK_VALUES } = require('./shared/cards');

const SEAT_ORDER = ['south', 'east', 'north', 'west'];
const LEVEL_SEQUENCE = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', '1'];
const FINAL_LEVEL = '1';
const DEFAULT_TEAM_LEVELS = {
  south_north: '2',
  east_west: '2'
};

function buildSeats(players) {
  return players.map((playerId, index) => ({
    playerId,
    seat: SEAT_ORDER[index] || `seat_${index}`
  }));
}

function buildTeams(players) {
  return {
    south_north: [players[0], players[2]].filter(Boolean),
    east_west: [players[1], players[3]].filter(Boolean)
  };
}

function getTeamKey(playerId, teams) {
  if (teams.south_north.includes(playerId)) return 'south_north';
  if (teams.east_west.includes(playerId)) return 'east_west';
  return 'unknown';
}

function getSeatMap(players) {
  return Object.fromEntries(buildSeats(players).map((item) => [item.playerId, item.seat]));
}

function createDeck() {
  return shuffle(createStandardDeck({
    decks: 2,
    includeJokers: true,
    rankValues: DEFAULT_RANK_VALUES
  }));
}

function isCardLike(card) {
  return Boolean(card && typeof card === 'object' && typeof card.suit === 'string' && card.rank !== undefined && card.rank !== null);
}

function isWild(card, level) {
  return card.suit === 'heart' && card.rank === level;
}

function rankPower(rank, level) {
  if (rank === 'SJ') return 16;
  if (rank === 'BJ') return 17;
  if (rank === level) return 15;
  return DEFAULT_RANK_VALUES[rank];
}

function sortHand(hand, level) {
  return [...hand].sort((a, b) => {
    const diff = rankPower(a.rank, level) - rankPower(b.rank, level);
    if (diff !== 0) return diff;
    return a.suit.localeCompare(b.suit);
  });
}

function getValueCounts(cards, level) {
  const counts = new Map();
  cards.forEach((card) => {
    const power = rankPower(card.rank, level);
    const item = counts.get(power) || { power, cards: [] };
    item.cards.push(card);
    counts.set(power, item);
  });
  return [...counts.values()].sort((a, b) => a.power - b.power);
}

function isPureSequence(values) {
  if (values.length < 2) return true;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function buildPattern(type, cards, mainValue, extras = {}) {
  return {
    type,
    cards: [...cards],
    mainValue,
    length: cards.length,
    ...extras
  };
}

// --- Pattern identification without wild cards (original logic) ---
function identifyPatternPure(sorted, level) {
  const counts = getValueCounts(sorted, level);
  const values = counts.map((entry) => entry.power);
  const suits = [...new Set(sorted.map((card) => card.suit))];
  const size = sorted.length;
  const maxCount = Math.max(...counts.map((entry) => entry.cards.length));

  if (size === 1) return buildPattern('single', sorted, values[0]);
  if (size === 2 && counts.length === 1) return buildPattern('pair', sorted, values[0]);
  if (size === 3 && counts.length === 1) return buildPattern('triple', sorted, values[0]);

  if (size >= 4 && counts.length === 1) {
    return buildPattern('bomb', sorted, values[0], { bombSize: size });
  }

  if (size === 5 && suits.length === 1 && values.length === 5 && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('straight_flush', sorted, values[values.length - 1]);
  }

  if (size === 5 && counts.length === 2 && counts.some((entry) => entry.cards.length === 3) && counts.some((entry) => entry.cards.length === 2)) {
    const triple = counts.find((entry) => entry.cards.length === 3);
    return buildPattern('triple_pair', sorted, triple.power);
  }

  if (size >= 5 && counts.every((entry) => entry.cards.length === 1) && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('straight', sorted, values[values.length - 1], { sequenceLength: size });
  }

  if (size >= 6 && size % 2 === 0 && counts.every((entry) => entry.cards.length === 2) && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('pair_straight', sorted, values[values.length - 1], { sequenceLength: size / 2 });
  }

  if (size >= 6 && size % 3 === 0 && counts.every((entry) => entry.cards.length === 3) && values[values.length - 1] <= 14 && isPureSequence(values)) {
    return buildPattern('steel', sorted, values[values.length - 1], { sequenceLength: size / 3 });
  }

  const tripleEntries = counts.filter((entry) => entry.cards.length === 3);
  if (tripleEntries.length >= 2) {
    const tripleValues = tripleEntries.map((entry) => entry.power).sort((a, b) => a - b);
    let sequence = [tripleValues[0]];
    for (let i = 1; i < tripleValues.length; i += 1) {
      if (tripleValues[i] === tripleValues[i - 1] + 1) {
        sequence.push(tripleValues[i]);
      } else {
        sequence = [tripleValues[i]];
      }
      if (sequence.length >= 2) {
        const wingCount = size - sequence.length * 3;
        if (wingCount === sequence.length || wingCount === sequence.length * 2) {
          return buildPattern('airplane', sorted, sequence[sequence.length - 1], {
            airplaneLength: sequence.length,
            wingCount
          });
        }
      }
    }
  }

  if (maxCount >= 4) {
    const bombEntry = counts.filter((entry) => entry.cards.length === maxCount).sort((a, b) => b.power - a.power)[0];
    return buildPattern('bomb', sorted, bombEntry.power, { bombSize: maxCount });
  }

  return buildPattern('invalid', sorted, 0);
}

// --- Wild card pattern helpers ---

function tryWildBomb(allCards, nonWilds, wildCount, level) {
  const size = allCards.length;
  if (size < 4) return null;

  if (nonWilds.length === 0) {
    // All wilds form a bomb of level value
    return buildPattern('bomb', allCards, rankPower(level, level), { bombSize: size, hasWild: true });
  }

  // All non-wilds must have the same rankPower
  const powers = nonWilds.map(c => rankPower(c.rank, level));
  const uniquePowers = new Set(powers);
  if (uniquePowers.size !== 1) return null;

  return buildPattern('bomb', allCards, powers[0], { bombSize: size, hasWild: true });
}

function tryWildStraightFlush(allCards, nonWilds, wildCount, level) {
  if (allCards.length !== 5) return null;
  if (nonWilds.length === 0) return null; // All wilds -> already a bomb

  // Non-wilds must all be same suit (not joker)
  const suits = [...new Set(nonWilds.map(c => c.suit))];
  if (suits.length > 1 || suits[0] === 'joker') return null;

  const values = nonWilds.map(c => rankPower(c.rank, level));
  if (values.some(v => v > 14 || v < 2)) return null;

  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length !== nonWilds.length) return null; // Duplicate values can't form straight

  const minV = unique[0];
  const maxV = unique[unique.length - 1];
  if (maxV - minV >= 5) return null;

  // Find the best 5-consecutive window that covers all unique values
  const gaps = (maxV - minV + 1) - unique.length;
  if (gaps > wildCount) return null;

  const remaining = wildCount - gaps;
  let seqEnd = maxV;
  let seqStart = minV;
  let extra = remaining;

  while (seqEnd - seqStart + 1 < 5 && extra > 0) {
    if (seqEnd + 1 <= 14) { seqEnd++; extra--; }
    else if (seqStart - 1 >= 2) { seqStart--; extra--; }
    else break;
  }
  if (seqEnd - seqStart + 1 < 5) {
    // Try extending downward first
    seqEnd = maxV; seqStart = minV; extra = remaining;
    while (seqEnd - seqStart + 1 < 5 && extra > 0) {
      if (seqStart - 1 >= 2) { seqStart--; extra--; }
      else if (seqEnd + 1 <= 14) { seqEnd++; extra--; }
      else break;
    }
  }
  if (seqEnd - seqStart + 1 !== 5) return null;

  return buildPattern('straight_flush', allCards, seqEnd, { hasWild: true });
}

function tryWildStraight(allCards, nonWilds, wildCount, level) {
  const size = allCards.length;
  if (size < 5) return null;

  const values = nonWilds.map(c => rankPower(c.rank, level));
  if (values.some(v => v > 14 || v < 2)) return null;

  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length !== nonWilds.length) return null; // Duplicates can't form straight

  if (unique.length === 0) {
    // All wilds: form a straight starting from 2
    if (size >= 5 && size + 1 <= 14) {
      return buildPattern('straight', allCards, size + 1, { sequenceLength: size, hasWild: true });
    }
    return null;
  }

  const minV = unique[0];
  const maxV = unique[unique.length - 1];

  // The sequence must be `size` consecutive values containing all unique values
  // gaps within [minV, maxV] + extension needed
  const span = maxV - minV + 1;
  if (span > size) return null;

  const internalGaps = span - unique.length;
  if (internalGaps > wildCount) return null;

  const extraWilds = wildCount - internalGaps;
  const extension = size - span;
  if (extension > extraWilds) return null;

  // Extend to reach `size` length
  let seqStart = minV;
  let seqEnd = maxV;
  let ext = extension;
  while (seqEnd - seqStart + 1 < size && ext > 0) {
    if (seqEnd + 1 <= 14) { seqEnd++; ext--; }
    else if (seqStart - 1 >= 2) { seqStart--; ext--; }
    else break;
  }
  if (seqEnd - seqStart + 1 !== size) return null;
  if (seqEnd > 14) return null;

  return buildPattern('straight', allCards, seqEnd, { sequenceLength: size, hasWild: true });
}

function tryWildPairStraight(allCards, nonWilds, wildCount, level) {
  const size = allCards.length;
  if (size < 6 || size % 2 !== 0) return null;
  const pairCount = size / 2;

  const values = nonWilds.map(c => rankPower(c.rank, level));
  if (values.some(v => v > 14 || v < 2)) return null;

  // Group non-wilds by value
  const groups = new Map();
  values.forEach(v => groups.set(v, (groups.get(v) || 0) + 1));
  // Each group must have <= 2 cards
  for (const cnt of groups.values()) {
    if (cnt > 2) return null;
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
  if (sortedKeys.length === 0) {
    if (pairCount >= 3 && pairCount + 1 <= 14) {
      return buildPattern('pair_straight', allCards, pairCount + 1, { sequenceLength: pairCount, hasWild: true });
    }
    return null;
  }

  const minV = sortedKeys[0];
  const maxV = sortedKeys[sortedKeys.length - 1];
  if (maxV - minV + 1 > pairCount) return null;

  // Calculate wilds needed: for each position in sequence, need 2 cards
  // Non-wilds provide some, wilds fill the rest
  let wildsNeeded = 0;
  const seqStart = Math.max(2, maxV - pairCount + 1);
  const seqEnd = seqStart + pairCount - 1;
  if (seqEnd > 14) return null;
  if (minV < seqStart || maxV > seqEnd) return null;

  for (let v = seqStart; v <= seqEnd; v++) {
    const have = groups.get(v) || 0;
    wildsNeeded += (2 - have);
  }
  if (wildsNeeded > wildCount) return null;

  return buildPattern('pair_straight', allCards, seqEnd, { sequenceLength: pairCount, hasWild: true });
}

function tryWildSteel(allCards, nonWilds, wildCount, level) {
  const size = allCards.length;
  if (size < 6 || size % 3 !== 0) return null;
  const tripleCount = size / 3;

  const values = nonWilds.map(c => rankPower(c.rank, level));
  if (values.some(v => v > 14 || v < 2)) return null;

  const groups = new Map();
  values.forEach(v => groups.set(v, (groups.get(v) || 0) + 1));
  for (const cnt of groups.values()) {
    if (cnt > 3) return null;
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
  if (sortedKeys.length === 0) {
    if (tripleCount >= 2 && tripleCount + 1 <= 14) {
      return buildPattern('steel', allCards, tripleCount + 1, { sequenceLength: tripleCount, hasWild: true });
    }
    return null;
  }

  const minV = sortedKeys[0];
  const maxV = sortedKeys[sortedKeys.length - 1];
  if (maxV - minV + 1 > tripleCount) return null;

  const seqStart = Math.max(2, maxV - tripleCount + 1);
  const seqEnd = seqStart + tripleCount - 1;
  if (seqEnd > 14) return null;
  if (minV < seqStart || maxV > seqEnd) return null;

  let wildsNeeded = 0;
  for (let v = seqStart; v <= seqEnd; v++) {
    const have = groups.get(v) || 0;
    wildsNeeded += (3 - have);
  }
  if (wildsNeeded > wildCount) return null;

  return buildPattern('steel', allCards, seqEnd, { sequenceLength: tripleCount, hasWild: true });
}

function tryWildTriplePair(allCards, nonWilds, wildCount, level) {
  if (allCards.length !== 5) return null;

  const counts = getValueCounts(nonWilds, level);
  const powers = counts.map(e => e.power);

  // Try all ways to split into triple(value A) + pair(value B)
  if (nonWilds.length === 0) {
    // 5 wilds: better as bomb (handled earlier)
    return null;
  }

  // Possible triple values: from non-wilds
  for (const entry of counts) {
    const tripleNeed = 3 - entry.cards.length;
    if (tripleNeed > wildCount) continue;
    const remainingWilds = wildCount - tripleNeed;
    const otherCards = nonWilds.filter(c => rankPower(c.rank, level) !== entry.power);
    // Need exactly 2 remaining cards for the pair
    if (otherCards.length + remainingWilds === 2) {
      // Check pair: other cards must all be same value, or wilds fill
      if (otherCards.length === 0) {
        return buildPattern('triple_pair', allCards, entry.power, { hasWild: true });
      }
      if (otherCards.length <= 2) {
        const otherPowers = otherCards.map(c => rankPower(c.rank, level));
        if (new Set(otherPowers).size === 1) {
          return buildPattern('triple_pair', allCards, entry.power, { hasWild: true });
        }
      }
    }
  }
  return null;
}

function tryWildTriple(allCards, nonWilds, wildCount, level) {
  if (allCards.length !== 3) return null;
  if (nonWilds.length === 0) {
    return buildPattern('triple', allCards, rankPower(level, level), { hasWild: true });
  }
  const powers = nonWilds.map(c => rankPower(c.rank, level));
  if (new Set(powers).size !== 1) return null;
  return buildPattern('triple', allCards, powers[0], { hasWild: true });
}

function tryWildPair(allCards, nonWilds, wildCount, level) {
  if (allCards.length !== 2) return null;
  if (nonWilds.length === 0) {
    return buildPattern('pair', allCards, rankPower(level, level), { hasWild: true });
  }
  return buildPattern('pair', allCards, rankPower(nonWilds[0].rank, level), { hasWild: true });
}

// --- Main identifyPattern with wild support ---
function identifyPattern(cards, level = '2') {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  if (!cards.every(isCardLike)) return null;

  const sorted = sortHand(cards, level);
  const size = sorted.length;

  // Rocket: 4 jokers (wilds cannot substitute jokers)
  if (size === 4 && sorted.every((card) => card.suit === 'joker')) {
    return buildPattern('rocket', sorted, 999);
  }

  const wilds = sorted.filter(c => isWild(c, level));
  const nonWilds = sorted.filter(c => !isWild(c, level));
  const wildCount = wilds.length;

  // Fast path: no wilds
  if (wildCount === 0) {
    return identifyPatternPure(sorted, level);
  }

  // Single wild card
  if (size === 1) {
    return buildPattern('single', sorted, rankPower(sorted[0].rank, level));
  }

  // Try patterns from strongest to weakest
  let pat;

  pat = tryWildBomb(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildStraightFlush(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildSteel(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildPairStraight(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildStraight(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildTriplePair(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildTriple(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  pat = tryWildPair(sorted, nonWilds, wildCount, level);
  if (pat) return pat;

  // Fallback: treat wilds as their own value (original logic)
  return identifyPatternPure(sorted, level);
}

function comparePattern(nextPattern, currentPattern) {
  if (!nextPattern || nextPattern.type === 'invalid') return -1;
  if (!currentPattern) return 1;

  const bombLike = ['bomb', 'straight_flush', 'rocket'];
  if (nextPattern.type === 'rocket') return currentPattern.type === 'rocket' ? 0 : 1;
  if (currentPattern.type === 'rocket') return -1;

  if (nextPattern.type === 'straight_flush' && currentPattern.type !== 'straight_flush' && currentPattern.type !== 'rocket') {
    return 1;
  }

  if (nextPattern.type === 'bomb' && !bombLike.includes(currentPattern.type)) {
    return 1;
  }
  if (currentPattern.type === 'bomb' && !bombLike.includes(nextPattern.type)) {
    return -1;
  }

  if (nextPattern.type !== currentPattern.type) return -1;

  if (nextPattern.type === 'bomb') {
    if (nextPattern.bombSize !== currentPattern.bombSize) {
      return nextPattern.bombSize - currentPattern.bombSize;
    }
    return nextPattern.mainValue - currentPattern.mainValue;
  }

  if (nextPattern.sequenceLength && nextPattern.sequenceLength !== currentPattern.sequenceLength) {
    return -1;
  }
  if (nextPattern.airplaneLength && nextPattern.airplaneLength !== currentPattern.airplaneLength) {
    return -1;
  }
  if (nextPattern.length !== currentPattern.length) {
    return -1;
  }

  return nextPattern.mainValue - currentPattern.mainValue;
}

function canBeat(cards, lastPattern, level) {
  const nextPattern = identifyPattern(cards, level);
  if (!lastPattern) return nextPattern && nextPattern.type !== 'invalid';
  return comparePattern(nextPattern, lastPattern) > 0;
}

// --- getHints: enumerate valid plays ---

function groupByPower(hand, level) {
  const map = new Map();
  hand.forEach(c => {
    const p = rankPower(c.rank, level);
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(c);
  });
  return map;
}

function getHints(hand, lastPlay, level) {
  if (!hand || hand.length === 0) return [];

  const wilds = hand.filter(c => isWild(c, level));
  const nonWilds = hand.filter(c => !isWild(c, level));
  const wildCount = wilds.length;
  const powerMap = groupByPower(nonWilds, level);
  const allPowers = [...powerMap.keys()].sort((a, b) => a - b);

  const results = [];

  if (!lastPlay) {
    // Free play: return basic single/pair/triple/bomb options
    collectFreePlays(results, hand, nonWilds, wilds, powerMap, allPowers, level);
  } else {
    const target = lastPlay.pattern;
    collectBeatingPlays(results, target, hand, nonWilds, wilds, powerMap, allPowers, level);
  }

  // Sort: prefer small cards, bombs last
  results.sort((a, b) => {
    const aIsBomb = ['bomb', 'straight_flush', 'rocket'].includes(a.pattern.type);
    const bIsBomb = ['bomb', 'straight_flush', 'rocket'].includes(b.pattern.type);
    if (aIsBomb !== bIsBomb) return aIsBomb ? 1 : -1;
    return a.pattern.mainValue - b.pattern.mainValue;
  });

  return results;
}

function collectFreePlays(results, hand, nonWilds, wilds, powerMap, allPowers, level) {
  const wildCount = wilds.length;

  // Singles
  for (const c of hand) {
    results.push({ cards: [c], pattern: identifyPattern([c], level) });
  }

  // Pairs
  for (const [power, cards] of powerMap) {
    if (cards.length >= 2) {
      results.push({ cards: cards.slice(0, 2), pattern: buildPattern('pair', cards.slice(0, 2), power) });
    }
    if (cards.length >= 1 && wildCount > 0) {
      const combo = [cards[0], wilds[0]];
      results.push({ cards: combo, pattern: buildPattern('pair', combo, power, { hasWild: true }) });
    }
  }
  if (wildCount >= 2) {
    const combo = wilds.slice(0, 2);
    results.push({ cards: combo, pattern: buildPattern('pair', combo, rankPower(level, level), { hasWild: true }) });
  }

  // Triples
  for (const [power, cards] of powerMap) {
    if (cards.length >= 3) {
      results.push({ cards: cards.slice(0, 3), pattern: buildPattern('triple', cards.slice(0, 3), power) });
    }
    if (cards.length >= 2 && wildCount > 0) {
      const combo = [...cards.slice(0, 2), wilds[0]];
      results.push({ cards: combo, pattern: buildPattern('triple', combo, power, { hasWild: true }) });
    }
  }

  // Bombs (4+ same value)
  collectAllBombs(results, nonWilds, wilds, powerMap, allPowers, level);

  // Limit free play results to keep it manageable
  if (results.length > 100) results.length = 100;
}

function collectBeatingPlays(results, target, hand, nonWilds, wilds, powerMap, allPowers, level) {
  const wildCount = wilds.length;
  const targetType = target.type;
  const targetMain = target.mainValue;

  // Same type plays that beat the target
  switch (targetType) {
    case 'single':
      hintSingles(results, targetMain, hand, wilds, powerMap, level);
      break;
    case 'pair':
      hintPairs(results, targetMain, nonWilds, wilds, powerMap, level);
      break;
    case 'triple':
      hintTriples(results, targetMain, nonWilds, wilds, powerMap, level);
      break;
    case 'straight':
      hintStraights(results, target, nonWilds, wilds, powerMap, allPowers, level);
      break;
    case 'pair_straight':
      hintPairStraights(results, target, nonWilds, wilds, powerMap, allPowers, level);
      break;
    case 'triple_pair':
      hintTriplePairs(results, targetMain, nonWilds, wilds, powerMap, allPowers, level);
      break;
    case 'straight_flush':
      hintStraightFlush(results, targetMain, hand, nonWilds, wilds, level);
      break;
    case 'bomb':
      hintBombs(results, target, nonWilds, wilds, powerMap, allPowers, level);
      break;
    default:
      break;
  }

  // Any non-bomb type can be beaten by bomb/straight_flush/rocket
  if (!['bomb', 'straight_flush', 'rocket'].includes(targetType)) {
    collectAllBombs(results, nonWilds, wilds, powerMap, allPowers, level);
    hintStraightFlush(results, 0, hand, nonWilds, wilds, level);
  }

  // Rocket beats everything except another rocket
  if (targetType !== 'rocket') {
    hintRocket(results, hand);
  }
}

function hintSingles(results, targetMain, hand, wilds, powerMap, level) {
  for (const c of hand) {
    const p = rankPower(c.rank, level);
    if (p > targetMain) {
      results.push({ cards: [c], pattern: buildPattern('single', [c], p) });
    }
  }
}

function hintPairs(results, targetMain, nonWilds, wilds, powerMap, level) {
  const wildCount = wilds.length;
  for (const [power, cards] of powerMap) {
    if (power <= targetMain) continue;
    if (cards.length >= 2) {
      results.push({ cards: cards.slice(0, 2), pattern: buildPattern('pair', cards.slice(0, 2), power) });
    }
    if (cards.length >= 1 && wildCount > 0) {
      const combo = [cards[0], wilds[0]];
      results.push({ cards: combo, pattern: buildPattern('pair', combo, power, { hasWild: true }) });
    }
  }
  // Two wilds as pair of level (power 15)
  if (wildCount >= 2 && rankPower(level, level) > targetMain) {
    const combo = wilds.slice(0, 2);
    results.push({ cards: combo, pattern: buildPattern('pair', combo, rankPower(level, level), { hasWild: true }) });
  }
}

function hintTriples(results, targetMain, nonWilds, wilds, powerMap, level) {
  const wildCount = wilds.length;
  for (const [power, cards] of powerMap) {
    if (power <= targetMain) continue;
    if (cards.length >= 3) {
      results.push({ cards: cards.slice(0, 3), pattern: buildPattern('triple', cards.slice(0, 3), power) });
    }
    if (cards.length >= 2 && wildCount >= 1) {
      const combo = [...cards.slice(0, 2), wilds[0]];
      results.push({ cards: combo, pattern: buildPattern('triple', combo, power, { hasWild: true }) });
    }
    if (cards.length >= 1 && wildCount >= 2) {
      const combo = [cards[0], ...wilds.slice(0, 2)];
      results.push({ cards: combo, pattern: buildPattern('triple', combo, power, { hasWild: true }) });
    }
  }
  if (wildCount >= 3 && rankPower(level, level) > targetMain) {
    const combo = wilds.slice(0, 3);
    results.push({ cards: combo, pattern: buildPattern('triple', combo, rankPower(level, level), { hasWild: true }) });
  }
}

function hintStraights(results, target, nonWilds, wilds, powerMap, allPowers, level) {
  const seqLen = target.sequenceLength || target.length;
  const targetMain = target.mainValue;
  const wildCount = wilds.length;

  // Enumerate all starting points for straights of length seqLen
  for (let start = 2; start + seqLen - 1 <= 14; start++) {
    const end = start + seqLen - 1;
    if (end <= targetMain) continue;

    let wildsUsed = 0;
    const combo = [];
    let valid = true;

    for (let v = start; v <= end; v++) {
      const available = powerMap.get(v);
      if (available && available.length > 0) {
        combo.push(available[0]);
      } else {
        wildsUsed++;
        if (wildsUsed > wildCount) { valid = false; break; }
        combo.push(wilds[wildsUsed - 1]);
      }
    }
    if (!valid) continue;

    const pat = buildPattern('straight', combo, end, {
      sequenceLength: seqLen,
      ...(wildsUsed > 0 ? { hasWild: true } : {})
    });
    results.push({ cards: combo, pattern: pat });
  }
}

function hintPairStraights(results, target, nonWilds, wilds, powerMap, allPowers, level) {
  const pairCount = target.sequenceLength || target.length / 2;
  const targetMain = target.mainValue;
  const wildCount = wilds.length;

  for (let start = 2; start + pairCount - 1 <= 14; start++) {
    const end = start + pairCount - 1;
    if (end <= targetMain) continue;

    let wildsUsed = 0;
    const combo = [];
    let valid = true;

    for (let v = start; v <= end; v++) {
      const available = powerMap.get(v) || [];
      const have = Math.min(available.length, 2);
      for (let i = 0; i < have; i++) combo.push(available[i]);
      const need = 2 - have;
      wildsUsed += need;
      if (wildsUsed > wildCount) { valid = false; break; }
      for (let i = 0; i < need; i++) combo.push(wilds[wildsUsed - need + i]);
    }
    if (!valid) continue;

    const pat = buildPattern('pair_straight', combo, end, {
      sequenceLength: pairCount,
      ...(wildsUsed > 0 ? { hasWild: true } : {})
    });
    results.push({ cards: combo, pattern: pat });
  }
}

function hintTriplePairs(results, targetMain, nonWilds, wilds, powerMap, allPowers, level) {
  const wildCount = wilds.length;

  // For each possible triple value > targetMain
  for (const [triPower, triCards] of powerMap) {
    if (triPower <= targetMain) continue;
    const triHave = triCards.length;
    const triNeed = 3 - Math.min(triHave, 3);
    if (triNeed > wildCount) continue;

    const triCombo = triCards.slice(0, Math.min(triHave, 3));
    let wildsForTri = triNeed;

    // Find a pair from remaining cards
    for (const [pairPower, pairCards] of powerMap) {
      if (pairPower === triPower) continue;
      const pairAvail = pairCards.length;
      const pairHave = Math.min(pairAvail, 2);
      const pairNeed = 2 - pairHave;
      if (wildsForTri + pairNeed > wildCount) continue;

      const combo = [
        ...triCombo,
        ...wilds.slice(0, wildsForTri),
        ...pairCards.slice(0, pairHave),
        ...wilds.slice(wildsForTri, wildsForTri + pairNeed)
      ];
      const pat = buildPattern('triple_pair', combo, triPower, {
        ...((wildsForTri + pairNeed) > 0 ? { hasWild: true } : {})
      });
      results.push({ cards: combo, pattern: pat });
      break; // One pair option per triple is enough
    }

    // Pair entirely from wilds
    if (wildsForTri + 2 <= wildCount && !results.find(r => r.pattern.type === 'triple_pair' && r.pattern.mainValue === triPower)) {
      const combo = [...triCombo, ...wilds.slice(0, wildsForTri + 2)];
      const pat = buildPattern('triple_pair', combo, triPower, { hasWild: true });
      results.push({ cards: combo, pattern: pat });
    }
  }
}

function hintStraightFlush(results, targetMain, hand, nonWilds, wilds, level) {
  const wildCount = wilds.length;
  // Group non-wild cards by suit
  const suitGroups = new Map();
  nonWilds.forEach(c => {
    if (c.suit === 'joker') return;
    const p = rankPower(c.rank, level);
    if (p > 14) return;
    if (!suitGroups.has(c.suit)) suitGroups.set(c.suit, new Map());
    const sg = suitGroups.get(c.suit);
    if (!sg.has(p)) sg.set(p, []);
    sg.get(p).push(c);
  });

  for (const [suit, valMap] of suitGroups) {
    for (let start = 2; start + 4 <= 14; start++) {
      const end = start + 4;
      if (end <= targetMain) continue;

      let wildsUsed = 0;
      const combo = [];
      let valid = true;

      for (let v = start; v <= end; v++) {
        const available = valMap.get(v);
        if (available && available.length > 0) {
          combo.push(available[0]);
        } else {
          wildsUsed++;
          if (wildsUsed > wildCount) { valid = false; break; }
          combo.push(wilds[wildsUsed - 1]);
        }
      }
      if (!valid || combo.length !== 5) continue;

      const pat = buildPattern('straight_flush', combo, end, {
        ...(wildsUsed > 0 ? { hasWild: true } : {})
      });
      results.push({ cards: combo, pattern: pat });
    }
  }
}

function hintBombs(results, target, nonWilds, wilds, powerMap, allPowers, level) {
  const targetBombSize = target.bombSize || 4;
  const targetMain = target.mainValue;
  const wildCount = wilds.length;

  // Find bombs of same size with higher value
  for (const [power, cards] of powerMap) {
    const maxSize = cards.length + wildCount;
    if (maxSize < targetBombSize) continue;

    // Same size, higher value
    if (cards.length + wildCount >= targetBombSize && power > targetMain) {
      const need = targetBombSize - Math.min(cards.length, targetBombSize);
      const combo = [...cards.slice(0, Math.min(cards.length, targetBombSize)), ...wilds.slice(0, need)];
      if (combo.length === targetBombSize) {
        const pat = buildPattern('bomb', combo, power, {
          bombSize: targetBombSize,
          ...(need > 0 ? { hasWild: true } : {})
        });
        results.push({ cards: combo, pattern: pat });
      }
    }
  }

  // Bigger bombs (more cards)
  for (const [power, cards] of powerMap) {
    for (let sz = targetBombSize + 1; sz <= cards.length + wildCount && sz <= 8; sz++) {
      if (cards.length < 1) continue;
      const have = Math.min(cards.length, sz);
      const need = sz - have;
      if (need > wildCount) continue;
      const combo = [...cards.slice(0, have), ...wilds.slice(0, need)];
      const pat = buildPattern('bomb', combo, power, {
        bombSize: sz,
        ...(need > 0 ? { hasWild: true } : {})
      });
      results.push({ cards: combo, pattern: pat });
    }
  }

  // Pure wild bombs
  if (wildCount >= 4 && wildCount > targetBombSize) {
    const combo = wilds.slice(0, wildCount);
    results.push({ cards: combo, pattern: buildPattern('bomb', combo, rankPower(level, level), { bombSize: wildCount, hasWild: true }) });
  }
}

function collectAllBombs(results, nonWilds, wilds, powerMap, allPowers, level) {
  const wildCount = wilds.length;

  for (const [power, cards] of powerMap) {
    // Natural bombs (4+ of same value)
    if (cards.length >= 4) {
      results.push({
        cards: cards.slice(0, 4),
        pattern: buildPattern('bomb', cards.slice(0, 4), power, { bombSize: 4 })
      });
    }
    // With wilds: need at least 1 natural card + wilds to reach 4
    if (cards.length >= 1 && cards.length < 4) {
      const need = 4 - cards.length;
      if (need <= wildCount) {
        const combo = [...cards, ...wilds.slice(0, need)];
        results.push({
          cards: combo,
          pattern: buildPattern('bomb', combo, power, { bombSize: 4, hasWild: true })
        });
      }
    }
  }

  // Pure wild bomb
  if (wildCount >= 4) {
    const combo = wilds.slice(0, 4);
    results.push({
      cards: combo,
      pattern: buildPattern('bomb', combo, rankPower(level, level), { bombSize: 4, hasWild: true })
    });
  }
}

function hintRocket(results, hand) {
  const jokers = hand.filter(c => c.suit === 'joker');
  if (jokers.length >= 4) {
    const combo = jokers.slice(0, 4);
    results.push({ cards: combo, pattern: buildPattern('rocket', combo, 999) });
  }
}

// --- Game flow helpers ---

function getNextPlayer(players, finishedSet, currentPlayer) {
  const alive = players.filter((playerId) => !finishedSet.has(playerId));
  if (alive.length === 0) return null;
  const currentIndex = players.indexOf(currentPlayer);
  if (currentIndex === -1) return alive[0];
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (!finishedSet.has(candidate)) return candidate;
  }
  return alive[0];
}

function getHandCounts(state) {
  return Object.fromEntries((state.players || []).map((pid) => [
    pid,
    (state.hands?.[pid] || []).length
  ]));
}

function syncHandCounts(state) {
  state.handCounts = getHandCounts(state);
}

function normalizeTeamLevels(levelOrTeamLevels = DEFAULT_TEAM_LEVELS) {
  if (typeof levelOrTeamLevels === 'string') {
    return {
      south_north: levelOrTeamLevels,
      east_west: levelOrTeamLevels
    };
  }
  return {
    ...DEFAULT_TEAM_LEVELS,
    ...(levelOrTeamLevels || {})
  };
}

function advanceLevel(level, levelUp) {
  const currentIndex = Math.max(0, LEVEL_SEQUENCE.indexOf(level));
  const nextIndex = Math.min(LEVEL_SEQUENCE.length - 1, currentIndex + levelUp);
  return LEVEL_SEQUENCE[nextIndex];
}

function getLevelScore(level) {
  if (level === FINAL_LEVEL) return 13;
  if (level === 'J') return 11;
  if (level === 'Q') return 12;
  if (level === 'K') return 13;
  const numeric = Number(level);
  return Number.isFinite(numeric) ? numeric : 2;
}

function resolveRoundEnd(finishedOrder, teams, levelOrTeamLevels) {
  if (finishedOrder.length < 2) return null;
  const firstTeam = getTeamKey(finishedOrder[0], teams);
  const secondTeam = getTeamKey(finishedOrder[1], teams);
  const thirdTeam = finishedOrder[2] ? getTeamKey(finishedOrder[2], teams) : null;
  const teamLevels = normalizeTeamLevels(levelOrTeamLevels);

  let levelUp = 1;
  if (firstTeam === secondTeam) {
    levelUp = 3;
  } else if (thirdTeam && firstTeam === thirdTeam) {
    levelUp = 2;
  }

  const currentLevel = teamLevels[firstTeam] || '2';
  const nextLevel = advanceLevel(currentLevel, levelUp);
  const nextTeamLevels = {
    ...teamLevels,
    [firstTeam]: nextLevel
  };
  return {
    winnerTeam: firstTeam,
    winningPlayers: teams[firstTeam] || [],
    currentLevel,
    levelUp,
    nextLevel,
    teamLevels: nextTeamLevels,
    matchFinished: nextLevel === FINAL_LEVEL
  };
}

// --- Engine class ---

class GuandanEngine {
  init(room, players) {
    const deck = createDeck();
    const teams = buildTeams(players);
    const hands = {};
    players.forEach((playerId) => {
      hands[playerId] = sortHand(deck.splice(0, 27), '2');
    });

    return {
      phase: 'play',
      stage: 'play',
      players,
      seats: buildSeats(players),
      seatMap: getSeatMap(players),
      teams,
      level: '2',
      teamLevels: { ...DEFAULT_TEAM_LEVELS },
      round: 1,
      dealerSeat: 'south',
      hands,
      currentPlayer: players[0],
      lastPlay: null,
      lastPattern: null,
      lastLeadPlayer: null,
      passedPlayers: [],
      finishedOrder: [],
      roundWinner: null,
      winningPlayers: [],
      settlement: null,
      timer: 30,
      timerStarted: Date.now(),
      handCounts: Object.fromEntries(players.map((pid) => [pid, hands[pid].length])),
      currentHints: []
    };
  }

  update(state, action, playerId) {
    if (state.phase !== 'play' || playerId !== state.currentPlayer) return state;
    if (state.finishedOrder.includes(playerId)) return state;

    if (action.type === 'play') {
      const hand = state.hands[playerId] || [];
      const selected = Array.isArray(action.cards) ? action.cards : [];
      if (!selected.every(isCardLike)) return state;
      const indexes = [];

      // Card validation: verify each card is in hand by suit+rank+id
      for (const card of selected) {
        const idx = hand.findIndex((item, index) => {
          if (indexes.includes(index)) return false;
          if (item.id && card.id) return item.id === card.id;
          return item.rank === card.rank && item.suit === card.suit;
        });
        if (idx === -1) return state; // Card not in hand - reject
        indexes.push(idx);
      }

      const pattern = identifyPattern(selected, state.level);
      if (!pattern || pattern.type === 'invalid') return state;
      if (state.lastPattern && comparePattern(pattern, state.lastPattern) <= 0) return state;

      indexes.sort((a, b) => b - a).forEach((idx) => hand.splice(idx, 1));
      state.hands[playerId] = sortHand(hand, state.level);
      state.lastPlay = { playerId, cards: selected, pattern };
      state.lastPattern = pattern;
      state.lastLeadPlayer = playerId;
      state.passedPlayers = [];

      if (state.hands[playerId].length === 0 && !state.finishedOrder.includes(playerId)) {
        state.finishedOrder.push(playerId);
      }
      syncHandCounts(state);

      if (state.finishedOrder.length >= state.players.length - 1) {
        const lastPlayer = state.players.find((id) => !state.finishedOrder.includes(id));
        if (lastPlayer) state.finishedOrder.push(lastPlayer);
        syncHandCounts(state);
        const settlement = resolveRoundEnd(state.finishedOrder, state.teams, state.teamLevels || state.level);
        if (settlement?.teamLevels) {
          state.teamLevels = settlement.teamLevels;
          state.level = settlement.nextLevel;
        }
        state.phase = settlement?.matchFinished ? 'finished' : 'round_finished';
        state.stage = settlement?.matchFinished ? 'settlement' : 'round_settlement';
        state.roundWinner = state.finishedOrder[0];
        state.finalWinner = state.finishedOrder[0];
        state.winningPlayers = settlement ? settlement.winningPlayers : [state.finishedOrder[0]];
        state.settlement = settlement;
        state.currentHints = [];
        state.currentPlayer = null;
        state.timerStarted = Date.now();
        return state;
      }

      const finishedSet = new Set(state.finishedOrder);
      state.currentPlayer = getNextPlayer(state.players, finishedSet, playerId);
      state.timerStarted = Date.now();

      // Generate hints for the next player
      this._updateHints(state);
      return state;
    }

    if (action.type === 'pass') {
      if (!state.lastPattern || state.lastLeadPlayer === playerId) return state;
      if (!state.passedPlayers.includes(playerId)) state.passedPlayers.push(playerId);

      const finishedSet = new Set(state.finishedOrder);
      const aliveOthers = state.players.filter((id) => !finishedSet.has(id) && id !== state.lastLeadPlayer);
      if (aliveOthers.every((id) => state.passedPlayers.includes(id))) {
        state.currentPlayer = finishedSet.has(state.lastLeadPlayer)
          ? getNextPlayer(state.players, finishedSet, state.lastLeadPlayer || playerId)
          : state.lastLeadPlayer;
        state.lastPlay = null;
        state.lastPattern = null;
        state.lastLeadPlayer = null;
        state.passedPlayers = [];
      } else {
        state.currentPlayer = getNextPlayer(state.players, finishedSet, playerId);
      }
      state.timerStarted = Date.now();
      syncHandCounts(state);

      // Generate hints for the next player
      this._updateHints(state);
      return state;
    }

    return state;
  }

  _updateHints(state) {
    if (state.phase !== 'play' || !state.currentPlayer) {
      state.currentHints = [];
      return;
    }
    const currentHand = state.hands[state.currentPlayer] || [];
    const lastPlay = state.lastPattern ? { pattern: state.lastPattern } : null;
    try {
      state.currentHints = getHints(currentHand, lastPlay, state.level);
    } catch (e) {
      state.currentHints = [];
    }
  }

  getPlayerView(state, playerId) {
    // Return state with hints only visible to the current player
    const handCounts = getHandCounts(state);
    const view = {
      ...state,
      handCounts,
      hands: {
        [playerId]: state.hands?.[playerId] || []
      }
    };
    if (playerId !== state.currentPlayer) {
      view.currentHints = [];
    }
    return view;
  }

  nextRound(state) {
    const nextState = this.init(null, state.players);
    if (state.phase === 'round_finished' && !state.settlement?.matchFinished) {
      const nextLevel = state.settlement?.nextLevel || state.level || '2';
      nextState.level = nextLevel;
      nextState.teamLevels = normalizeTeamLevels(state.settlement?.teamLevels || state.teamLevels);
      nextState.round = (state.round || 1) + 1;
      nextState.currentPlayer = state.roundWinner || state.players[0];
      Object.keys(nextState.hands || {}).forEach((pid) => {
        nextState.hands[pid] = sortHand(nextState.hands[pid], nextLevel);
      });
      syncHandCounts(nextState);
    }
    return nextState;
  }
}

module.exports = {
  GuandanEngine,
  SEAT_ORDER,
  LEVEL_SEQUENCE,
  rankPower,
  sortHand,
  identifyPattern,
  comparePattern,
  canBeat,
  resolveRoundEnd,
  getLevelScore,
  getHints,
  isWild
};
