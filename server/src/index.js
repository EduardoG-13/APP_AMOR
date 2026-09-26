import express from 'express';
import cors from 'cors';
import { env, hasGoogle, hasSpotify, hasSupabase } from './env.js';
import { musicRouter } from './routes/music.js';
import { iptvRouter } from './routes/iptv.js';
import { streamRouter } from './routes/stream.js';
import { oauthRouter } from './routes/oauth.js';
import { exportRouter } from './routes/export.js';
import { requireAppToken } from './middleware/auth.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // Render fica atrás de proxy

app.use(
  cors({
    origin(origin, callback) {
      // Sem origin = curl, app nativo ou o próprio <audio> em alguns
      // navegadores. Liberado: quem protege as rotas de mídia é o token.
      if (!origin) return callback(null, true);
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
app.use('/api/iptv', iptvRouter);
// Proxy de mídia compartilhado por videoclipe e IPTV.
app.use('/api/stream', streamRouter);
// O OAuth precisa abrir no navegador (redirect), então não passa pelo
// token de app — a proteção dele é o state assinado.
app.use('/api/oauth', oauthRouter);
app.use('/api/export', requireAppToken, exportRouter);

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

app.listen(env.port, () => {
  console.log(`🍿 Nossa Sessão — backend em http://localhost:${env.port}`);
  console.log(`   URL pública ..... ${env.publicBaseUrl}`);
  console.log(`   Origens no CORS . ${env.allowedOrigins.join(', ')}`);
  console.log(`   Supabase ........ ${hasSupabase() ? 'ok' : 'NÃO configurado'}`);
  console.log(`   Spotify ......... ${hasSpotify() ? 'ok' : 'NÃO configurado'}`);
  console.log(`   YouTube ......... ${hasGoogle() ? 'ok' : 'NÃO configurado'}`);
  console.log(`   Token do app .... ${env.appToken ? 'ativo' : 'DESLIGADO (só use em dev)'}`);
});
