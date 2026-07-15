import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH est fourni par le workflow GitHub Actions (/<repo>/) ; '/' en dev local.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Dofus Touch Craft',
        short_name: 'Dofus Craft',
        description: 'Suivi de projets de craft et prix HDV pour Dofus Touch',
        lang: 'fr',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#1d232a',
        background_color: '#1d232a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Precache du shell uniquement : IndexedDB est le cache des données,
      // aucun runtime-caching réseau nécessaire.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: undefined,
      },
    }),
  ],
})
