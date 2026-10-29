import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  // El workspace de contratos se compila a CommonJS fuera de node_modules.
  optimizeDeps: {
    include: ['@erp/contracts'],
    // El CJS del workspace cambia sin actualizar el lockfile. No reutilizar exports de una compilación anterior.
    force: true,
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]contracts[\\/]dist/],
    },
  },
});
