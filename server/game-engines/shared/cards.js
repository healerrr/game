const SUITS = ['spade', 'heart', 'club', 'diamond'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const DEFAULT_RANK_VALUES = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

function shuffle(array, rng = Math.random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createStandardDeck(options = {}) {
  const {
    decks = 1,
    includeJokers = false,
    rankValues = DEFAULT_RANK_VALUES
  } = options;

  const cards = [];
  for (let deckIndex = 0; deckIndex < decks; deckIndex += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `d${deckIndex}-${suit}-${rank}-${cards.length}`,
          deckIndex,
          suit,
          rank,
          value: rankValues[rank]
        });
      }
    }
  }

  if (includeJokers) {
    const jokerRanks = ['SJ', 'BJ'];
    for (let deckIndex = 0; deckIndex < decks; deckIndex += 1) {
      for (const rank of jokerRanks) {
        cards.push({
          id: `d${deckIndex}-joker-${rank}-${cards.length}`,
          deckIndex,
          suit: 'joker',
          rank,
          value: rank === 'SJ' ? 16 : 17
        });
      }
    }
  }

  return cards;
}

module.exports = {
  SUITS,
  RANKS,
  DEFAULT_RANK_VALUES,
  shuffle,
  createStandardDeck
};
