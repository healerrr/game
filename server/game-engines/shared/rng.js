function randomInt(max, rng = Math.random) {
  return Math.floor(rng() * max);
}

function pick(list, rng = Math.random) {
  if (!list.length) return null;
  return list[randomInt(list.length, rng)];
}

module.exports = {
  randomInt,
  pick
};
