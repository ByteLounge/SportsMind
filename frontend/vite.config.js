import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/elevenlabs': {
        target: 'https://api.elevenlabs.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elevenlabs/, '')
      }
    }
  }
})
