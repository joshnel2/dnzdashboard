import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const clioBaseUrl = env.VITE_CLIO_API_BASE_URL || 'https://app.clio.com/api/v4'
  const clioToken = env.VITE_CLIO_API_KEY || env.CLIO_ACCESS_TOKEN || ''

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api/clio': {
          target: clioBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/clio/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Add Clio authentication
              if (clioToken) {
                proxyReq.setHeader('Authorization', `Bearer ${clioToken}`)
              }
              proxyReq.setHeader('Accept', 'application/json')
              
              console.log('[Vite Proxy] Forwarding to Clio:', req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, res) => {
              console.log('[Vite Proxy] Response from Clio:', proxyRes.statusCode, req.url)
            })
            proxy.on('error', (err, req, res) => {
              console.error('[Vite Proxy] Error:', err.message)
            })
          }
        }
      }
    },
    esbuild: {
      legalComments: 'none',
    },
    build: {
      sourcemap: false,
    },
  }
})
