import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Force Vite to use port 5175 to match Auth0 configuration
  server: {
    port: 5175,
    host: true,
    strictPort: true // Fail if port is not available
  },

  // Production optimizations
  build: {
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          'chart-vendor': ['chart.js', 'react-chartjs-2', 'recharts'],
          'editor-vendor': ['@monaco-editor/react', 'prismjs'],
          'utils': ['axios', 'zustand', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    // Minification with esbuild (faster and built-in)
    minify: 'esbuild',
    // Source maps for production debugging (disabled for smaller bundle)
    sourcemap: false,
    // Target modern browsers for better optimization
    target: 'es2020',
    // Drop console and debugger in production
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },

  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'zustand',
      'socket.io-client',
    ],
  },
})
