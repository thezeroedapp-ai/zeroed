import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@zeroed/core': path.resolve(__dirname, '../../packages/core/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        secure: (process.env.API_TARGET ?? '').startsWith('https'),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
