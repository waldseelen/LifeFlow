import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
                name: 'LifeFlow',
                short_name: 'LifeFlow',
                description: 'Offline-first time & habit tracking PWA',
                theme_color: '#6366f1',
                background_color: '#0f172a',
                display: 'standalone',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@modules': path.resolve(__dirname, './src/modules'),
            '@shared': path.resolve(__dirname, './src/shared'),
            '@db': path.resolve(__dirname, './src/db'),
            '@events': path.resolve(__dirname, './src/events'),
            '@infra': path.resolve(__dirname, './src/infra')
        }
    },
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    'echarts': ['echarts'],
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'ui-vendor': ['clsx', '@heroicons/react'],
                    'db-vendor': ['dexie', 'dexie-react-hooks'],
                    'time-vendor': ['luxon']
                }
            }
        },
        chunkSizeWarningLimit: 1000,
        cssCodeSplit: true,
        sourcemap: false,
        commonjsOptions: {
            transformMixedEsModules: true
        }
    }
});
