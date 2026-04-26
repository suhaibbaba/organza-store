import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,       // listen on 0.0.0.0 so phone on same Wi-Fi can connect
    port: 3000,
    proxy: {
      '/medusa': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/medusa/, ''),
      },
    },
  },
})
