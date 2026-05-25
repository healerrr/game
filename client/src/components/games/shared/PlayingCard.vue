<template>
  <div
    class="playing-card"
    :class="[card?.suit, { back, small, bj: card?.rank === 'BJ', sj: card?.rank === 'SJ' }]"
  >
    <template v-if="back">
      <span class="card-back">🂠</span>
    </template>
    <template v-else-if="isJoker">
      <span class="joker-corner top">JOKER</span>
      <svg
        class="joker-icon"
        viewBox="0 0 40 50"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <!-- 小丑帽：三尖角 + 帽箍 -->
        <g fill="currentColor">
          <path d="M7 27 L3 9 L14 27 Z" />
          <path d="M14 27 L20 2 L26 27 Z" />
          <path d="M26 27 L37 9 L33 27 Z" />
          <rect x="4.5" y="25.5" width="31" height="5.2" rx="2.2" />
        </g>
        <!-- 帽尖铃铛（金色，跨主题保持高亮） -->
        <circle cx="3" cy="9" r="2.3" fill="#ffd95a" stroke="currentColor" stroke-width="0.6" />
        <circle cx="20" cy="2.4" r="2.3" fill="#ffd95a" stroke="currentColor" stroke-width="0.6" />
        <circle cx="37" cy="9" r="2.3" fill="#ffd95a" stroke="currentColor" stroke-width="0.6" />
        <!-- 小丑脸 -->
        <circle cx="20" cy="39" r="6.2" fill="#ffe2c2" stroke="currentColor" stroke-width="0.8" />
        <circle cx="17.4" cy="38" r="0.85" fill="currentColor" />
        <circle cx="22.6" cy="38" r="0.85" fill="currentColor" />
        <path
          d="M16.2 41.2 Q20 44.2 23.8 41.2"
          stroke="currentColor"
          stroke-width="0.9"
          fill="none"
          stroke-linecap="round"
        />
        <!-- 脸颊小星点缀 -->
        <circle cx="13.6" cy="41" r="0.7" fill="currentColor" opacity="0.7" />
        <circle cx="26.4" cy="41" r="0.7" fill="currentColor" opacity="0.7" />
      </svg>
      <span class="joker-corner bottom">JOKER</span>
    </template>
    <template v-else>
      <span class="card-rank">{{ card?.rank }}</span>
      <span class="card-suit">{{ suitIcon }}</span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, default: null },
  back: { type: Boolean, default: false },
  small: { type: Boolean, default: false }
})

const isJoker = computed(() => props.card?.suit === 'joker')

const suitIcon = computed(() => {
  const icons = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }
  return icons[props.card?.suit] || '?'
})
</script>

<style scoped>
.playing-card {
  width: 58px;
  height: 82px;
  border-radius: 11px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0) 38%),
    linear-gradient(180deg, #ffffff, #f8fbff);
  color: #111;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 7px 14px rgba(18, 51, 92, 0.18);
  border: 1px solid rgba(164, 190, 230, 0.65);
  position: relative;
}

.playing-card.small {
  width: 44px;
  height: 62px;
  padding: 4px;
}

.playing-card.heart,
.playing-card.diamond {
  color: #d63031;
}

/* 小王：深灰主题 */
.playing-card.joker {
  color: #2c2c2c;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0) 38%),
    linear-gradient(180deg, #f3f3f5, #e2e2e6);
  align-items: stretch;
}

/* 大王：红色主题 */
.playing-card.joker.bj {
  color: #c0392b;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 38%),
    linear-gradient(180deg, #fff1f1, #ffe1e1);
}

.card-rank {
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
}

.playing-card.small .card-rank {
  font-size: 14px;
}

.card-suit {
  font-size: 20px;
  align-self: flex-end;
  line-height: 1;
}

.card-back {
  font-size: 24px;
  margin: auto;
}

.playing-card.back {
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.24) 0 14px, transparent 15px),
    linear-gradient(135deg, #4aa2ff, #1265ed);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.65);
}

/* ===== Joker 内联 SVG 样式 ===== */
.joker-corner {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.4px;
  line-height: 1;
  font-family: 'Georgia', 'Times New Roman', serif;
}

.joker-corner.top {
  align-self: flex-start;
}

.joker-corner.bottom {
  align-self: flex-end;
  transform: rotate(180deg);
}

.playing-card.small .joker-corner {
  font-size: 7px;
  letter-spacing: 1px;
}

.joker-icon {
  width: 78%;
  height: auto;
  margin: 0 auto;
  display: block;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.18));
}

.playing-card.small .joker-icon {
  width: 70%;
}
</style>
