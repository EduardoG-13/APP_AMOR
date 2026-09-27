import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { env, hasGoogle, hasSpotify, hasSupabase } from './env.js';
import { musicRouter } from './routes/music.js';
import { iptvRouter } from './routes/iptv.js';
import { streamRouter } from './routes/stream.js';
import { oauthRouter } from './routes/oauth.js';
import { exportRouter } from './routes/export.js';
import { requireAppToken } from './middleware/auth.js';
import { createImportRouter } from './routes/import.js';

export function createApp({ native = false, staticDir, remoteRouter } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', native ? false : 1);

  if (native) {
    if (!env.appToken) throw new Error('O servidor nativo exige um token local.');
    app.use((req, res, next) => {
      // Evita DNS rebinding e acesso por páginas de outros sites.
      if (req.headers.host !== new URL(env.publicBaseUrl).host ||
          (req.headers.origin && req.headers.origin !== env.publicBaseUrl)) {
        return res.status(403).json({ error: 'Origem local inválida.' });
      }
      next();
    });
    app.use('/api', requireAppToken);
  }

  app.use(
    cors({
      origin(origin, callback) {
        // Sem origin = curl, app nativo ou o próprio <audio> em alguns
        // navegadores. Liberado: quem protege as rotas de mídia é o token.
        if (!origin) return callback(null, true);
        if (native) return callback(null, origin === env.publicBaseUrl);
        if (env.allowedOrigins.includes(origin)) return callback(null, true);

        // Em desenvolvimento, libera a rede local: é assim que dá pra
        // abrir o app no celular pelo IP do PC antes de publicar.
        if (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`Origem não permitida: ${origin}`));
      },
      credentials: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      services: {
        supabase: hasSupabase(),
        spotify: hasSpotify(),
        youtube: hasGoogle(),
        // A Deezer não depende de app registrado, só do arl da conta.
        deezer: true,
      },
    });
  });

  app.use('/api/music', musicRouter);
  app.use('/api/import', requireAppToken, createImportRouter({ native }));
  app.use('/api/iptv', iptvRouter);
  // Proxy de mídia compartilhado por videoclipe e IPTV.
  app.use('/api/stream', streamRouter);
  // O OAuth precisa abrir no navegador (redirect), então não passa pelo
  // token de app — a proteção dele é o state assinado.
  if (native) {
    if (remoteRouter) app.use('/api', remoteRouter);
  } else {
    app.use('/api/oauth', oauthRouter);
    app.use('/api/export', requireAppToken, exportRouter);
  }

  if (staticDir) {
    app.use((_req, res, next) => {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; media-src 'self' blob: http: https:; connect-src 'self' http: https: wss:; worker-src 'self' blob:; frame-src https://www.youtube.com https://open.spotify.com https://widget.deezer.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      next();
    });
    app.use(express.static(staticDir));
    app.get('/', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use((req, res) => {
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars -- o Express exige os 4 argumentos
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error('[erro]', error);
    res.status(status).json({
      error: error.message || 'Erro interno no servidor.',
      ...(error.code ? { code: error.code } : {}),
    });
  });

  return app;
}

/** Importar este módulo não abre sockets. Porta 0 pede uma porta livre. */
export async function start({ port = env.port, host, ...options } = {}) {
  host ??= options.native ? '127.0.0.1' : undefined;
  const app = createApp(options);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, host, () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  const url = `http://${host || 'localhost'}:${address.port}`;
  if (options.native) env.publicBaseUrl = url;
  return { app, server, url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  start().then(({ url }) => {
    console.log(`🍿 Nossa Sessão — backend em ${url}`);
    console.log(`   URL pública ..... ${env.publicBaseUrl}`);
    console.log(`   Origens no CORS . ${env.allowedOrigins.join(', ')}`);
    console.log(`   Supabase ........ ${hasSupabase() ? 'ok' : 'NÃO configurado'}`);
    console.log(`   Spotify ......... ${hasSpotify() ? 'ok' : 'NÃO configurado'}`);
    console.log(`   YouTube ......... ${hasGoogle() ? 'ok' : 'NÃO configurado'}`);
    console.log(`   Token do app .... ${env.appToken ? 'ativo' : 'DESLIGADO (só use em dev)'}`);
  }).catch((error) => {
    console.error('Não foi possível iniciar o backend:', error.message);
    process.exitCode = 1;
  });
}
