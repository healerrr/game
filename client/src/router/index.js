import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Landing', component: () => import('../views/Landing.vue') },
  { path: '/lobby', name: 'Lobby', component: () => import('../views/Lobby.vue') },
  { path: '/game/:roomId', name: 'GameRoom', component: () => import('../views/GameRoom.vue') },
  { path: '/spectate/:roomId', name: 'Spectator', component: () => import('../views/Spectator.vue') },
  { path: '/leaderboard', name: 'Leaderboard', component: () => import('../views/Leaderboard.vue') },
  { path: '/results', name: 'Results', component: () => import('../views/Results.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../views/Admin.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
