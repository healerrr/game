<template>
  <span class="seat-badge" :class="[seat, team]">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  seat: { type: String, default: '' },
  team: { type: String, default: '' }
})

const label = computed(() => {
  const seatText = {
    south: '南',
    east: '东',
    west: '西',
    north: '北'
  }
  const teamText = {
    south_north: '南北',
    east_west: '东西'
  }
  return [seatText[props.seat], teamText[props.team]].filter(Boolean).join(' ')
})
</script>

<style scoped>
.seat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.12);
  color: #6c86b3;
}

.seat-badge.south_north {
  color: #2e84ff;
}

.seat-badge.east_west {
  color: #f5a623;
}
</style>
