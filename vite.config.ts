/// <reference types="vitest" />

import path from 'node:path'
import basicSsl from '@vitejs/plugin-basic-ssl'
// import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig, loadEnv } from 'vite'
import { injectVersion } from './vite-plugin-inject-version'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, '.')
  const isHttps = env.VITE_HTTPS === 'true'

  const plugins = [
    vue(),
    // legacy()
    UnoCSS(),
    injectVersion(),
  ]

  if (isHttps) {
    plugins.push(basicSsl())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup/vitest.setup.ts'],
      include: [
        'tests/unit/**/*.spec.ts',
        'tests/integration/**/*.spec.ts',
      ],
      exclude: ['tests/e2e/**'],
    },
    server: {
      port: 8888,
      host: '0.0.0.0',
      https: isHttps,
      proxy: {
        '/e': {
          target: 'https://next.0122.vip',
          changeOrigin: true,
        },
        '/d': {
          target: 'https://next.0122.vip',
          changeOrigin: true,
        },
        '/api': {
          target: 'https://api.0122.vip',
          changeOrigin: true,
        },
      },
    },
  }
})
