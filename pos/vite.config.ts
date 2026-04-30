import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: Number(process.env.PORT) || 3000,
  },
  preview: {
    host: true,
    allowedHosts: ['pos.organza-moda.com'],
    port: Number(process.env.PORT) || 4102,
  },
})

