import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'dentvision-backend/src/modules/dentcash/**/*.test.ts',
      'dentvision-backend/src/modules/ai/lib/**/*.test.ts',
      'dentvision-backend/src/modules/billing/planEntitlements.test.ts',
    ],
    exclude: ['node_modules', 'dist', 'server'],
  },
})
