import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  define: {
    // Expose non-VITE_ prefixed env vars to the frontend
    'import.meta.env.CLIO_BASE_URL': JSON.stringify(process.env.CLIO_BASE_URL),
    'import.meta.env.CLIO_CLIENT_ID': JSON.stringify(process.env.CLIO_CLIENT_ID),
    'import.meta.env.CLIO_API_KEY': JSON.stringify(process.env.CLIO_API_KEY),
  },
})
