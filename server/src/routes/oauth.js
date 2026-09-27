import { Router } from 'express';
import crypto from 'node:crypto';
import { env, hasGoogle, hasSpotify } from '../env.js';
import { deleteOAuthAccount, getOAuthAccount, saveOAuthAccount } from '../lib/supabase.js';
import * as spotify from '../lib/platforms/spotify.js';
import * as youtube from '../lib/platforms/youtube.js';
import * as deezer from '../lib/platforms/deezer.js';
import { startNativeLogin, completeNativeLogin, pollNativeLogin } from '../lib/nativeOAuth.js';

export const oauthRouter = Router();

const PROFILES = new Set(['eduardo', 'laura']);

function stateSecret() {
  return env.appToken || env.supabase.serviceRoleKey || 'nossa-sessao-dev';
}

/**
 * State assinado em vez de guardado em memória: no plano free do
 * Render o serviço hiberna, e um state em memória se perderia entre
 * o clique em "conectar" e a volta do callback.
 */
function signState(profile, nativeLogin) {
  const payload = Buffer.from(
    JSON.stringify({ profile, nativeLogin, exp: Date.now() + 10 * 60 * 1000 })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyState(state) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!PROFILES.has(data.profile) || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function backToApp(res, params, state) {
  if (state?.nativeLogin) {
    completeNativeLogin(state.nativeLogin, state.profile, params.status === 'ok');
    const ok = params.status === 'ok';
    res.set('Cache-Control', 'no-store');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    return res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nossa Sessão — Spotify</title><body style="background:#08090d;color:#fff;font:18px system-ui;padding:32px;line-height:1.6"><h1>${ok ? 'Spotify conectado' : 'Conexão não concluída'}</h1><p>${ok ? 'Volte ao app Nossa Sessão. A conexão será reconhecida e você poderá importar sua playlist.' : 'Volte ao app e tente conectar novamente.'}</p></body></html>`);
  }
  const url = new URL(env.frontendUrl);
  url.searchParams.set('view', 'music');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  res.redirect(url.href);
}

oauthRouter.get('/status', async (req, res, next) => {
  try {
    const profile = String(req.query.profile || 'eduardo');
    if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });

    const [spotifyAccount, googleAccount, deezerAccount] = await Promise.all([
      getOAuthAccount('spotify', profile),
      getOAuthAccount('google', profile),
      getOAuthAccount('deezer', profile),
    ]);

    res.json({
      spotify: {
        connected: Boolean(spotifyAccount),
        displayName: spotifyAccount?.display_name || null,
        configured: hasSpotify(),
      },
      youtube: {
        connected: Boolean(googleAccount),
        displayName: googleAccount?.display_name || null,
        configured: hasGoogle(),
      },
      deezer: {
        connected: Boolean(deezerAccount),
        displayName: deezerAccount?.display_name || null,
        // A Deezer não tem app pra configurar: liga com o cookie arl.
        configured: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

oauthRouter.post('/native/start', (req, res, next) => {
  try {
    const { profile } = req.body || {};
    if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });
    if (!hasSpotify()) return res.status(503).json({ error: 'Spotify não configurado no servidor.' });
    const login = startNativeLogin(profile);
    res.set('Cache-Control', 'no-store').json({ loginId: login.id, pollSecret: login.pollSecret,
      authorizationUrl: spotify.buildAuthUrl(signState(profile, { id: login.id, secretHash: login.secretHash, expires: login.expires })) });
  } catch (error) { next(error); }
});

oauthRouter.post('/native/poll', (req, res) => {
  const { loginId, pollSecret } = req.body || {};
  res.set('Cache-Control', 'no-store').json(pollNativeLogin(String(loginId || ''), String(pollSecret || '')));
});

oauthRouter.get('/spotify/start', (req, res) => {
  const profile = String(req.query.profile || 'eduardo');
  if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });
  if (!hasSpotify()) {
    return res
      .status(503)
      .json({ error: 'Faltam SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no backend.' });
  }

  res.redirect(spotify.buildAuthUrl(signState(profile)));
});

oauthRouter.get('/spotify/callback', async (req, res) => {
  const state = verifyState(req.query.state);
  try {
    if (!state) return backToApp(res, { connected: 'spotify', status: 'estado-invalido' });
    if (req.query.error) {
      return backToApp(res, { connected: 'spotify', status: 'cancelado' }, state);
    }

    const profile = state.profile;

    const tokens = await spotify.exchangeCode(String(req.query.code));
    const me = await spotify.getProfileInfo(tokens.access_token);

    await saveOAuthAccount({
      provider: 'spotify',
      profile,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      scope: tokens.scope || spotify.SCOPES.join(' '),
      remote_user_id: me?.id || null,
      display_name: me?.display_name || me?.id || null,
    });

    backToApp(res, { connected: 'spotify', status: 'ok' }, state);
  } catch (error) {
    console.error('[oauth/spotify]', error);
    backToApp(res, { connected: 'spotify', status: 'erro' }, state);
  }
});

oauthRouter.get('/google/start', (req, res) => {
  const profile = String(req.query.profile || 'eduardo');
  if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });
  if (!hasGoogle()) {
    return res
      .status(503)
      .json({ error: 'Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend.' });
  }

  res.redirect(youtube.buildAuthUrl(signState(profile)));
});

oauthRouter.get('/google/callback', async (req, res) => {
  try {
    if (req.query.error) {
      return backToApp(res, { connected: 'youtube', status: 'cancelado' });
    }

    const profile = verifyState(req.query.state)?.profile;
    if (!profile) return backToApp(res, { connected: 'youtube', status: 'estado-invalido' });

    const tokens = await youtube.exchangeCode(String(req.query.code));
    const channel = await youtube.getProfileInfo(tokens.access_token);

    await saveOAuthAccount({
      provider: 'google',
      profile,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      scope: tokens.scope || youtube.SCOPES.join(' '),
      remote_user_id: channel?.id || null,
      display_name: channel?.display_name || null,
    });

    backToApp(res, { connected: 'youtube', status: 'ok' });
  } catch (error) {
    console.error('[oauth/google]', error);
    backToApp(res, { connected: 'youtube', status: 'erro' });
  }
});

/**
 * Deezer não tem OAuth aberto pra pedir. A conexão é feita colando o
 * cookie `arl` da própria conta — validamos na hora pra não guardar
 * um valor quebrado.
 */
oauthRouter.post('/deezer/connect', async (req, res, next) => {
  try {
    const { profile, arl } = req.body || {};
    if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });

    const cleaned = String(arl || '').trim();
    if (cleaned.length < 32) {
      return res.status(400).json({ error: 'Esse arl parece incompleto. Copie o valor inteiro.' });
    }

    const session = await deezer.openSession(cleaned);

    await saveOAuthAccount({
      provider: 'deezer',
      profile,
      access_token: cleaned,
      refresh_token: null,
      expires_at: null,
      scope: 'gw-light',
      remote_user_id: String(session.userId),
      display_name: session.displayName,
    });

    res.json({ ok: true, displayName: session.displayName });
  } catch (error) {
    next(error);
  }
});

oauthRouter.post('/disconnect', async (req, res, next) => {
  try {
    const { provider, profile } = req.body || {};
    if (!PROFILES.has(profile)) return res.status(400).json({ error: 'Perfil inválido.' });

    // No frontend a plataforma se chama "youtube"; no banco, "google".
    const stored = provider === 'youtube' ? 'google' : provider;
    if (!['spotify', 'google', 'deezer'].includes(stored)) {
      return res.status(400).json({ error: 'Plataforma inválida.' });
    }

    await deleteOAuthAccount(stored, profile);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
