import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(() => {
  const serverTarget = process.env.VITE_SERVER_ORIGIN || 'http://localhost:3457'

  return {
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        '/api': serverTarget,
        '/socket.io': {
          target: serverTarget,
          ws: true
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets'
    }
  }
})
