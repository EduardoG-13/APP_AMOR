import { env } from '../env.js';

/**
 * Gate simples nas rotas de proxy. Não é login: o token vai no bundle
 * do frontend e qualquer um que abra o app consegue ler. O que ele
 * resolve é impedir que o endereço do backend, se vazar, vire um
 * proxy aberto pra internet inteira raspar o YouTube.
 *
 * <audio> e <video> não mandam header, então aceita por querystring.
 */
export function requireMediaToken(req, res, next) {
  if (!env.appToken) return next();

  const provided = req.query.t || req.headers['x-app-token'];
  if (provided === env.appToken) return next();

  return res.status(401).json({ error: 'Token do app ausente ou inválido.' });
}

/** Mesma checagem, mas só por header — pras rotas JSON. */
export function requireAppToken(req, res, next) {
  if (!env.appToken) return next();

  const provided = req.headers['x-app-token'] || req.query.t;
  if (provided === env.appToken) return next();

  return res.status(401).json({ error: 'Token do app ausente ou inválido.' });
}
