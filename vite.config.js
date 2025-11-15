import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Konfigurasi dasar untuk aplikasi HTML5 Anda
  root: '.', // Folder root proyek

  // Konfigurasi build
  build: {
    outDir: 'dist', // Output build akan disimpan di folder 'dist'
    assetsDir: 'assets', // Folder untuk file statis
    rollupOptions: {
      // Input file untuk build (entry point)
      input: {
        main: './index.html' // Titik masuk utama aplikasi
      }
    },
    // Opsi tambahan untuk mengurangi ukuran build
    target: 'es2020', // Target browser modern
    minify: 'esbuild', // Minify mode
  },

  // Server development
  server: {
    port: 5173, // Port default Vite
    strictPort: false, // Gunakan port lain jika 5173 sudah dipakai
    open: true, // Buka browser otomatis
    host: '0.0.0.0', // Izinkan akses dari alamat IP eksternal (diperlukan untuk ngrok)
    cors: true, // Izinkan CORS untuk integrasi eksternal
    hmr: {
      clientPort: 443, // Gunakan port 443 untuk HMR di server HTTPS seperti ngrok
      host: 'chelsey-micrological-ivonne.ngrok-free.dev' // Tambahkan host ngrok untuk HMR
    },
    // Izinkan akses dari host ngrok
    allowedHosts: [
      'chelsey-micrological-ivonne.ngrok-free.dev', // Host ngrok yang diizinkan
      'localhost',
      '127.0.0.1'
    ]
  },

  // Konfigurasi untuk web worker
  worker: {
    format: 'es' // Gunakan ES modules untuk worker
  },

  // Plugin untuk PWA dan Service Worker
  plugins: [
    VitePWA({
      strategies: 'generateSW', // Gunakan generateSW strategy
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,woff,woff2}'], // File yang akan di-cache (hapus svg karena terlalu besar)
        maximumFileSizeToCacheInBytes: 3000000, // Tingkatkan limit jadi 3MB (default 2MB)
        // Jangan coba cache API calls atau dynamic content
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*ngrok-free\.dev\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ngrok-dev-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Geo Camera Pro',
        short_name: 'Geo Cam',
        description: 'Aplikasi Kamera Geo dengan Watermark GPS dan Logo Kustom',
        start_url: '.',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  // Jika ada file statis yang tidak ingin diubah oleh build
  publicDir: false, // Atur ke false jika tidak ingin meng-copy file tambahan
});