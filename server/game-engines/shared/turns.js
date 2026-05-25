function nextIndex(length, currentIndex) {
  if (!length) return 0;
  return (currentIndex + 1) % length;
}

function nextPlayer(players, currentPlayer, skip = []) {
  if (!players.length) return null;
  const currentIndex = players.indexOf(currentPlayer);
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(currentIndex + offset + players.length) % players.length];
    if (!skip.includes(candidate)) return candidate;
  }
  return null;
}

module.exports = {
  nextIndex,
  nextPlayer
};
