<template>
  <div class="mahjong-tile" :class="[{ selected, small, concealed }]">
    <img class="tile-img" :src="tileSrc" :alt="altText" loading="lazy" decoding="async" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getBackTileTexturePath, getTileTexturePath } from '../../../game/mahjong-tiles'

const props = defineProps({
  tile: { type: Object, default: null },
  selected: { type: Boolean, default: false },
  small: { type: Boolean, default: false },
  concealed: { type: Boolean, default: false }
})

const tileSrc = computed(() => {
  if (props.concealed) return getBackTileTexturePath()
  return getTileTexturePath(props.tile)
})

const altText = computed(() => {
  if (props.concealed) return 'concealed tile'
  if (!props.tile) return 'mahjong tile'
  return `${props.tile.suit}-${props.tile.rank}`
})
</script>

<style scoped>
.mahjong-tile {
  width: 46px;
  height: 64px;
  border-radius: 7px;
  overflow: hidden;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.38);
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  background: rgba(255, 255, 255, 0.9);
}

.mahjong-tile.small {
  width: 32px;
  height: 44px;
  border-radius: 5px;
}

.mahjong-tile.selected {
  transform: translateY(-10px);
  box-shadow: 0 8px 16px rgba(255, 184, 0, 0.48);
  filter: brightness(1.04);
}

.tile-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
</style>
