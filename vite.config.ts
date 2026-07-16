import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: mode === 'production' ? '/highkings/' : '/',
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    // Split heavyweight vendors into their own long-lived chunks so game-code
    // changes don't re-download three.js et al. (rolldown's advancedChunks)
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules\/(three|@react-three)\// },
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'supabase', test: /node_modules\/@supabase\// },
            { name: 'motion', test: /node_modules\/(framer-motion|motion-dom|motion-utils)\// },
          ],
        },
      },
    },
  },
}))
