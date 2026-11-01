import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/ftl-profile-editor/',
  plugins: [react()],
  test: {
    // The game-data parsers use DOMParser, which jsdom provides.
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
