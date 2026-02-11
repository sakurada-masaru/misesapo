import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dns from 'node:dns';

// macOS/社内DNS/IPv6環境で `ENOTFOUND` が出るケースがあるため、IPv4優先に固定する。
// (API Gateway への proxy が text/plain 500 で落ちる症状の切り分けにも有効)
dns.setDefaultResultOrder('ipv4first');

function withProxyDebug(name, cfg) {
  return {
    ...cfg,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        // proxy が実際にどこへ転送しているかを把握する
        const host = proxyReq?.getHeader?.('host');
        const path = req?.url || '';
        console.log(`[proxy:${name}:req]`, req?.method || 'GET', host || '', path);
      });
      proxy.on('proxyRes', (proxyRes, req) => {
        const code = proxyRes?.statusCode;
        if (code && code >= 400) {
          console.error(`[proxy:${name}:res]`, code, req?.method || 'GET', req?.url || '');
        }
      });
      proxy.on('error', (err, req) => {
        // Vite proxy failure shows up as HTTP 500 in the browser.
        console.error(`[proxy:${name}:err]`, err?.code || err?.message || err, req?.url || '');
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // vite.config.js では process.env に .env が載らないケースがあるため loadEnv で読み込む。
  const env = loadEnv(mode, process.cwd(), '');

  // 業務報告専用ゲート（1x0f73dj2l = misesapo-work-report）。/api より先に定義すること。
  const WORK_REPORT_GATEWAY = env.VITE_WORK_REPORT_API_BASE || 'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod';
  // 予定系API（旧 51bhoxkbxd は使用禁止）
  const YOTEI_GATEWAY = env.VITE_API_BASE || 'https://v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com/prod';
  // マスタ系API（torihikisaki-data）
  const MASTER_GATEWAY = env.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod';
  // 人材API（jinzai-data）
  const JINZAI_GATEWAY = env.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod';

  const proxy = {
    '/api-wr': withProxyDebug('api-wr', {
      target: WORK_REPORT_GATEWAY,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api-wr/, ''),
    }),
    '/api': withProxyDebug('api', {
      target: YOTEI_GATEWAY,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    }),
    // `/api-master` is handled by a custom middleware below.
    // `/api-jinzai` is handled by a custom middleware below (proxy can be unstable in some envs).
    '/api2': withProxyDebug('api2', {
      target: 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api2/, ''),
    }),
  };

  // 起動時に proxy target を明示（トラブル時の切り分け用）
  console.log('[misogi:vite]', {
    mode,
    WORK_REPORT_GATEWAY,
    YOTEI_GATEWAY,
    MASTER_GATEWAY,
    JINZAI_GATEWAY,
  });

  return {
  plugins: [
    react(),
    // /misogi のみ（末尾スラッシュなし）で開いたときに 404 にならないよう /misogi/ へリダイレクト
    {
      name: 'redirect-misogi-to-misogi-slash',
      configureServer(server) {
        // Viteのproxyが環境依存で不安定なケースがあるため、/api-master は middleware で確実に中継する。
        // (ブラウザ直叩きは CORS でブロックされるため、ここが落ちると開発が進まない)
        server.middlewares.use('/api-master', async (req, res, next) => {
          try {
            // IMPORTANT: MASTER_GATEWAY includes stage path (e.g. .../prod).
            // `new URL('/master/..', MASTER_GATEWAY)` would drop `/prod`, so we must join paths manually.
            // In some dev setups, req.url may still include the mount prefix.
            // Guard against accidentally proxying to `/prod/api-master/...` (which becomes 403 Missing Authentication Token).
            let rawUrl = req.url || '/';
            if (rawUrl === '/api-master') rawUrl = '/';
            if (rawUrl.startsWith('/api-master/')) rawUrl = rawUrl.slice('/api-master'.length);

            const incoming = new URL(rawUrl, 'http://local');
            const base = new URL(MASTER_GATEWAY);
            base.pathname = base.pathname.replace(/\/$/, '') + incoming.pathname; // keep `/prod` + `/master/...`
            base.search = incoming.search;
            const targetUrl = base.toString();

            const headers = new Headers();
            for (const [k, v] of Object.entries(req.headers || {})) {
              if (v === undefined) continue;
              // hop-by-hop headers
              if (k.toLowerCase() === 'connection') continue;
              if (k.toLowerCase() === 'content-length') continue;
              if (Array.isArray(v)) headers.set(k, v.join(','));
              else headers.set(k, String(v));
            }

            // API Gateway へは Host を target に合わせる（changeOrigin相当）
            headers.set('host', new URL(MASTER_GATEWAY).host);

            const method = (req.method || 'GET').toUpperCase();
            const hasBody = !['GET', 'HEAD'].includes(method);
            const body = hasBody ? await new Promise((resolve, reject) => {
              const chunks = [];
              req.on('data', (c) => chunks.push(c));
              req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
              req.on('error', reject);
            }) : undefined;

            console.log('[api-master:mw:req]', method, req.url || '', '->', targetUrl);

            const r = await fetch(targetUrl, {
              method,
              headers,
              body: body ?? undefined,
              redirect: 'manual',
            });

            res.statusCode = r.status;
            r.headers.forEach((v, k) => {
              // ブラウザ向けのCORSは不要（同一オリジン）だが、API側のヘッダはそのまま返す
              if (k.toLowerCase() === 'transfer-encoding') return;
              res.setHeader(k, v);
            });
            const buf = Buffer.from(await r.arrayBuffer());
            res.end(buf);
          } catch (e) {
            console.error('[api-master:mw:err]', e?.code || e?.message || e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('api-master proxy failed');
          }
        });

        // /api-jinzai も同様に middleware で確実に中継する（devで 500 text/plain になるケースがある）
        server.middlewares.use('/api-jinzai', async (req, res, next) => {
          try {
            // Same guard as /api-master: avoid proxying `/prod/api-jinzai/...` accidentally.
            let rawUrl = req.url || '/';
            if (rawUrl === '/api-jinzai') rawUrl = '/';
            if (rawUrl.startsWith('/api-jinzai/')) rawUrl = rawUrl.slice('/api-jinzai'.length);

            const incoming = new URL(rawUrl, 'http://local');
            const base = new URL(JINZAI_GATEWAY);
            base.pathname = base.pathname.replace(/\/$/, '') + incoming.pathname; // keep `/prod` + `/jinzai/...`
            base.search = incoming.search;
            const targetUrl = base.toString();

            const headers = new Headers();
            for (const [k, v] of Object.entries(req.headers || {})) {
              if (v === undefined) continue;
              if (k.toLowerCase() === 'connection') continue;
              if (k.toLowerCase() === 'content-length') continue;
              if (Array.isArray(v)) headers.set(k, v.join(','));
              else headers.set(k, String(v));
            }

            headers.set('host', new URL(JINZAI_GATEWAY).host);

            const method = (req.method || 'GET').toUpperCase();
            const hasBody = !['GET', 'HEAD'].includes(method);
            const body = hasBody
              ? await new Promise((resolve, reject) => {
                  const chunks = [];
                  req.on('data', (c) => chunks.push(c));
                  req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
                  req.on('error', reject);
                })
              : undefined;

            console.log('[api-jinzai:mw:req]', method, req.url || '', '->', targetUrl);

            const r = await fetch(targetUrl, {
              method,
              headers,
              body: body ?? undefined,
              redirect: 'manual',
            });

            res.statusCode = r.status;
            r.headers.forEach((v, k) => {
              if (k.toLowerCase() === 'transfer-encoding') return;
              res.setHeader(k, v);
            });
            const buf = Buffer.from(await r.arrayBuffer());
            res.end(buf);
          } catch (e) {
            console.error('[api-jinzai:mw:err]', e?.code || e?.message || e);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('api-jinzai proxy failed');
          }
        });

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
    host: '127.0.0.1',
    proxy,
    watch: {
      // リアルタイム更新を確実にする（エディタ・クラウド同期で監視が効かない場合に有効）
      usePolling: true,
      interval: 500,
    },
  },
  };
});
