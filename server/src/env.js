import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Leitura e validação das variáveis de ambiente.
 * Nada de segredo fica hardcoded: em produção tudo vem do painel do Render.
 */

// Em desenvolvimento lê os .env locais. O Node 22+ faz isso nativo,
// sem precisar do pacote dotenv. Em produção nenhum dos dois existe e
// as variáveis já vêm do ambiente — por isso os erros são ignorados.
//
// Lê o server/.env e também o .env da raiz, nessa ordem, porque é
// comum as chaves acabarem num arquivo só. O que já estiver definido
// tem prioridade, então o server/.env continua mandando.
{
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(serverDir, '..', '.env'),
    path.resolve(serverDir, '..', '..', '.env'),
  ];

  /** Lê um .env sem deixar rastro no process.env. */
  function readEnvFile(file) {
    const before = { ...process.env };
    try {
      process.loadEnvFile(file);
    } catch {
      return null; // arquivo não existe
    }

    const loaded = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (before[key] !== value) loaded[key] = value;
    }

    for (const key of Object.keys(process.env)) {
      if (key in before) process.env[key] = before[key];
      else delete process.env[key];
    }

    return loaded;
  }

  // Vence quem já está definido no ambiente; depois o server/.env;
  // depois o .env da raiz. Chave em branco não conta como definida —
  // senão um campo vazio no server/.env esconderia o valor da raiz.
  for (const file of candidates) {
    const loaded = readEnvFile(file);
    if (!loaded) continue;

    for (const [key, value] of Object.entries(loaded)) {
      const current = process.env[key];
      if ((current === undefined || current === '') && value !== '') {
        process.env[key] = value;
      }
    }
  }
}

function list(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripSlash(value) {
  return (value || '').replace(/\/+$/, '');
}

export const env = {
  port: Number(process.env.PORT) || 3001,

  /** Origens liberadas no CORS (dev + PWA publicado). */
  allowedOrigins: list(process.env.ALLOWED_ORIGINS).length
    ? list(process.env.ALLOWED_ORIGINS)
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],

  /**
   * Segredo compartilhado com o frontend. As rotas de mídia (áudio e
   * IPTV) recebem ele por querystring porque <audio>/<video> não
   * conseguem mandar header. Não é autenticação de verdade — é o que
   * impede o proxy de virar proxy aberto pra internet inteira.
   */
  appToken: process.env.APP_TOKEN || '',

  /** URL pública deste backend (usada no callback do OAuth e no proxy HLS). */
  publicBaseUrl: stripSlash(process.env.PUBLIC_BASE_URL) || `http://localhost:${Number(process.env.PORT) || 3001}`,

  /** Para onde voltar depois do OAuth. */
  frontendUrl: stripSlash(process.env.FRONTEND_URL) || 'http://localhost:5173',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },

  /**
   * A Deezer fechou o cadastro de novos apps de API, então não existe
   * fluxo OAuth pra oferecer. Se você conseguir um token por outro
   * caminho, cole aqui e o export pra Deezer liga sozinho.
   */
  deezer: {
    accessToken: process.env.DEEZER_ACCESS_TOKEN || '',
  },

  /** Muitos provedores de IPTV recusam requisição que não pareça um player. */
  iptvUserAgent: process.env.IPTV_USER_AGENT || 'VLC/3.0.20 LibVLC/3.0.20',

  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
};

export function hasSupabase() {
  return Boolean(env.supabase.url && env.supabase.serviceRoleKey);
}

export function hasSpotify() {
  return Boolean(env.spotify.clientId && env.spotify.clientSecret);
}

export function hasGoogle() {
  return Boolean(env.google.clientId && env.google.clientSecret);
}
