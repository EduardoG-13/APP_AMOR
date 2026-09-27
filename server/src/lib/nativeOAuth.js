import crypto from 'node:crypto';
import { env } from '../env.js';

const sessions = new Map();
const lifetime = 10 * 60_000;
const secret = () => env.appToken || env.supabase.serviceRoleKey;
const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const mac = value => crypto.createHmac('sha256', secret()).update(value).digest('base64url');
function same(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function prune() { for (const [id, value] of sessions) if (value.expires < Date.now()) sessions.delete(id); }

export function startNativeLogin(profile) {
  prune();
  if (!secret()) throw Object.assign(new Error('Servidor de conexão não configurado.'), { status: 503 });
  if (sessions.size >= 128) throw Object.assign(new Error('Tente conectar novamente em alguns minutos.'), { status: 429 });
  const id = crypto.randomBytes(24).toString('hex'), pollSecret = crypto.randomBytes(32).toString('hex');
  const secretHash = digest(pollSecret), expires = Date.now() + lifetime;
  sessions.set(id, { profile, secretHash, expires, status: 'pending' });
  return { id, pollSecret, secretHash, expires };
}

export function completeNativeLogin(login, profile, ok) {
  prune();
  if (!login || login.expires < Date.now()) return;
  // Os dados vêm do state assinado. O callback pode reconstruir a sessão após um restart do Render.
  const payload = Buffer.from(JSON.stringify({ profile, scope: 'playlists', exp: Date.now() + 180 * 86400_000 })).toString('base64url');
  const token = ok ? `native1.${payload}.${mac(payload)}` : undefined;
  sessions.set(login.id, { profile, secretHash: login.secretHash, expires: login.expires, status: ok ? 'connected' : 'error', token });
}

export function pollNativeLogin(id, pollSecret) {
  prune(); const session = sessions.get(id);
  if (!session || !same(session.secretHash, digest(pollSecret))) return { status: 'expired' };
  return { status: session.status, ...(session.token ? { token: session.token } : {}) };
}

export function validNativePlaylistToken(token, profile) {
  if (!secret() || typeof token !== 'string') return false;
  const [prefix, payload, signature, extra] = token.split('.');
  if (prefix !== 'native1' || !payload || !signature || extra || !same(signature, mac(payload))) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url'));
    return value.scope === 'playlists' && ['eduardo', 'laura'].includes(value.profile) && value.profile === profile && value.exp > Date.now();
  } catch { return false; }
}
