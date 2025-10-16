import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
    },
    define: {
      // Expose non-VITE_ prefixed env vars to the frontend
      // These will be baked into the build at compile time
      'import.meta.env.CLIO_BASE_URL': JSON.stringify(env.CLIO_BASE_URL || process.env.CLIO_BASE_URL),
      'import.meta.env.CLIO_CLIENT_ID': JSON.stringify(env.CLIO_CLIENT_ID || process.env.CLIO_CLIENT_ID),
      'import.meta.env.CLIO_API_KEY': JSON.stringify(env.CLIO_API_KEY || process.env.CLIO_API_KEY),
      'import.meta.env.CLIO_ACCESS_TOKEN': JSON.stringify(env.CLIO_ACCESS_TOKEN || process.env.CLIO_ACCESS_TOKEN),
    },
  }
})
