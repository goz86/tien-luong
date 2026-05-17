import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('scheduler') || id.includes('zustand')) return 'vendor-react';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('html-to-image') || id.includes('canvas-confetti')) return 'vendor-export';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174
  }
});
