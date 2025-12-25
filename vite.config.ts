
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Vercelに設定した環境変数をクライアントサイドの process.env として動作させる
    'process.env': process.env
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
