import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // If VITE_API_URL is not set the app calls "/api" on its own origin;
    // during development this forwards those calls to the Express server.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
