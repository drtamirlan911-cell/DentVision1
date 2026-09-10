import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __SENTRY_RELEASE__: JSON.stringify(gitSha()),
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-state': ['zustand'],
          // Keep the AI workspace as a normal route-level dynamic chunk.
          // Do not list it in manualChunks: Vite would otherwise emit a
          // modulepreload for the chunk even on the anonymous entry page.
          // Recharts is used by analytics/dashboard surfaces and should not
          // inflate the public entry bundle.
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5000,
  },
})
