import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'
const swVideos = process.env.SW_VIDEO_TARGET || 'http://127.0.0.1:9090'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true },
      '/sw-video': { target: swVideos, changeOrigin: true, rewrite: path => path.replace(/^\/sw-video/, '') }
    }
  },
  build: { chunkSizeWarningLimit: 1500 }
})
