/// <reference types="vitest" />

import path from 'node:path'
import basicSsl from '@vitejs/plugin-basic-ssl'
// import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig, loadEnv } from 'vite'
import { injectVersion } from './vite-plugin-inject-version.ts'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, '.')
  const isHttps = env.VITE_HTTPS === 'true'
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8090'

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
        '@': path.resolve(import.meta.dirname, './src'),
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
        '^/[^/.]+/f/.+': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '^/[^/]+/n/[^/]+/?$': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '^/(?!home/?$|login/?$|register/?$|deleted/?$|framework7-preview/?$|api(?:/|$)|_)[^/.]+/?$': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/e': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/d': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
