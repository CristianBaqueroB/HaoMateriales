import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'swivel-email-parking.ngrok-free.dev',
      '.ngrok-free.app', // Permite cualquier subdominio de ngrok
      '.ngrok-free.dev'
    ]
  }
})