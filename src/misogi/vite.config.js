import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 業務報告専用ゲート（1x0f73dj2l = misesapo-work-report）。/api より先に定義すること。
const WORK_REPORT_GATEWAY = 'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod';
const proxy = {
  '/api-wr': {
    target: WORK_REPORT_GATEWAY,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api-wr/, '')
  },
  '/api': {
    target: 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  },
  '/api2': {
    target: 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api2/, '')
  }
};

export default defineConfig({
  plugins: [
    react(),
    // /misogi のみ（末尾スラッシュなし）で開いたときに 404 にならないよう /misogi/ へリダイレクト
    {
      name: 'redirect-misogi-to-misogi-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/misogi' && req.method === 'GET') {
            res.statusCode = 302;
            res.setHeader('Location', '/misogi/');
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  base: '/misogi/',
  define: {
    // amazon-cognito-identity-js の依存 (buffer) が Node の global を参照するため、ブラウザ用に差し替え
    global: 'globalThis',
  },
  server: {
    port: 3334,
    host: '0.0.0.0', // Allow binding to all interfaces
    proxy,
    watch: {
      // リアルタイム更新を確実にする（エディタ・クラウド同期で監視が効かない場合に有効）
      usePolling: true,
      interval: 500,
    },
  },
});
