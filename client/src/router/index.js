import { createRouter, createWebHistory } from 'vue-router'
import Landing from '../views/Landing.vue'
import Lobby from '../views/Lobby.vue'
import GameRoom from '../views/GameRoom.vue'
import Leaderboard from '../views/Leaderboard.vue'
import Admin from '../views/Admin.vue'
import Spectator from '../views/Spectator.vue'

const routes = [
  { path: '/', name: 'Landing', component: Landing },
  { path: '/lobby', name: 'Lobby', component: Lobby },
  { path: '/game/:roomId', name: 'GameRoom', component: GameRoom },
  { path: '/spectate/:roomId', name: 'Spectator', component: Spectator },
  { path: '/leaderboard', name: 'Leaderboard', component: Leaderboard },
  { path: '/admin', name: 'Admin', component: Admin }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
