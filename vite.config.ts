import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    // Em dev o frontend fala com o backend por /api, sem CORS no meio.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Nossa Sessão 🍿 | Eduardo & Laura',
        short_name: 'Nossa Sessão',
        description: 'App exclusivo de filmes e músicas de Eduardo e Laura',
        theme_color: '#08090D',
        background_color: '#08090D',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Capas e thumbs: cache longo, elas nunca mudam.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(lh3\.googleusercontent\.com|i\.ytimg\.com|image\.tmdb\.org)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'capas-e-posters',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Músicas baixadas para ouvir offline. rangeRequests é
            // obrigatório: sem isso o <audio> não consegue dar seek
            // numa faixa servida do cache.
            urlPattern: /\/api\/music\/audio\//,
            handler: 'CacheFirst',
            method: 'GET',
            options: {
              cacheName: 'musicas-offline',
              rangeRequests: true,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200, 206] },
            },
          },
        ],
        // Streams de IPTV e proxy de áudio nunca devem cair no
        // precache do build.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
