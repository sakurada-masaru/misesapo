import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/misogi/',
  server: {
    port: 3333,
    watch: {
      // リアルタイム更新を確実にする（エディタ・クラウド同期で監視が効かない場合に有効）
      usePolling: true,
      interval: 500,
    },
  },
});
