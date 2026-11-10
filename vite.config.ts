import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Versión que se muestra en el resumen para el asesor: la de package.json y la fecha de compilación.
  define: { __APP_VERSION__: JSON.stringify(`${process.env.npm_package_version ?? '0.0.0'} · compilada el ${new Date().toISOString().slice(0, 10)}`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // pdfjs (~1,7 MB entre librería y worker) solo hace falta al conciliar: no va en la instalación
        // inicial; se guarda en caché la primera vez que se usa y de ahí en adelante funciona offline.
        globIgnores: ['**/assets/pdf*.{js,mjs}'],
        runtimeCaching: [{ urlPattern: /\/assets\/pdf[^/]*\.m?js$/, handler: 'CacheFirst', options: { cacheName: 'pdfjs' } }],
      },
      manifest: {
        name: 'Greedy',
        short_name: 'Greedy',
        description: 'Tu plata, tus cuentas, tus deudas — todo en un solo lugar, claro y correcto.',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
