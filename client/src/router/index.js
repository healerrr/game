import { createRouter, createWebHistory } from 'vue-router'
import { ensureAuthenticated } from '../socket'

const routes = [
  { path: '/', name: 'Landing', component: () => import('../views/Landing.vue') },
  { path: '/lobby', name: 'Lobby', component: () => import('../views/Lobby.vue'), meta: { requiresAuth: true } },
  { path: '/game/:roomId', name: 'GameRoom', component: () => import('../views/GameRoom.vue'), meta: { requiresAuth: true } },
  { path: '/spectate/:roomId', name: 'Spectator', component: () => import('../views/Spectator.vue') },
  { path: '/leaderboard', name: 'Leaderboard', component: () => import('../views/Leaderboard.vue') },
  { path: '/results', name: 'Results', component: () => import('../views/Results.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'Admin', component: () => import('../views/Admin.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  const player = await ensureAuthenticated()
  if (player) return true

  return { path: '/', query: { redirect: to.fullPath } }
})

export default router
