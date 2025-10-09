import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      // Exclude shop-related files from the build
      external: [
        '/src/pages/shop/*',
        '/src/components/shop/*',
        '/src/hooks/useShop.ts',
        '/src/types/shop.ts'
      ]
    }
  }
});