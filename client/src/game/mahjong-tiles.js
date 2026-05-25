const BASE_TILE_PATH = '/assets/mahjong-tiles/Regular'

const WIND_MAP = {
  east: 'Ton.svg',
  south: 'Nan.svg',
  west: 'Shaa.svg',
  north: 'Pei.svg'
}

const DRAGON_MAP = {
  red: 'Chun.svg',
  green: 'Hatsu.svg',
  white: 'Haku.svg'
}

function numberedFile(prefix, rank) {
  const num = Number(rank)
  if (!Number.isInteger(num) || num < 1 || num > 9) return null
  return `${prefix}${num}.svg`
}

export function getTileTextureFile(tile, fallback = 'Back.svg') {
  if (!tile) return fallback

  if (tile.suit === 'wan') return numberedFile('Man', tile.rank) || fallback
  if (tile.suit === 'tong') return numberedFile('Pin', tile.rank) || fallback
  if (tile.suit === 'tiao') return numberedFile('Sou', tile.rank) || fallback
  if (tile.suit === 'wind') return WIND_MAP[tile.rank] || fallback
  if (tile.suit === 'dragon') return DRAGON_MAP[tile.rank] || fallback

  return fallback
}

export function getTileTexturePath(tile, fallback = 'Back.svg') {
  return `${BASE_TILE_PATH}/${getTileTextureFile(tile, fallback)}`
}

export function getBackTileTexturePath() {
  return `${BASE_TILE_PATH}/Back.svg`
}
