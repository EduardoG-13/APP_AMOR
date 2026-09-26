import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import net from 'node:net';
import dns from 'node:dns/promises';

/**
 * Bloqueia SSRF: sem isso o proxy de mídia poderia ser usado pra
 * alcançar serviços internos da Render (metadata, banco, localhost).
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast / reservado
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(normalized)) return true; // unique local
    // IPv4 mapeado em IPv6 (::ffff:127.0.0.1)
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  return false;
}

export async function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('URL inválida.'), { status: 400 });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('Só http e https são permitidos.'), { status: 400 });
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw Object.assign(new Error('Destino bloqueado.'), { status: 403 });
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw Object.assign(new Error('Destino bloqueado (rede interna).'), { status: 403 });
    }
    return url;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      throw Object.assign(new Error('Destino bloqueado (rede interna).'), { status: 403 });
    }
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error('Não foi possível resolver o endereço.'), { status: 502 });
  }

  return url;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
]);

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag',
];

/**
 * Repassa uma resposta HTTP upstream pro cliente preservando Range —
 * é o que permite arrastar a barra de progresso do player.
 */
export async function pipeUpstream(req, res, upstreamUrl, { headers = {}, cacheControl } = {}) {
  const requestHeaders = { ...headers };
  if (req.headers.range) requestHeaders.range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: requestHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(502).json({ error: `Falha ao acessar a origem: ${error.message}` });
    }
    return;
  }

  await pipeResponseBody(res, upstream, { cacheControl });
}

/** Repassa uma Response já obtida (útil quando foi preciso inspecionar antes). */
export async function pipeResponseBody(res, upstream, { cacheControl } = {}) {
  res.status(upstream.status);
  for (const header of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(header);
    if (value && !HOP_BY_HOP.has(header)) res.setHeader(header, value);
  }
  if (!upstream.headers.get('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);

  if (!upstream.body) {
    res.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    // O player fecha a conexão a cada seek/troca de faixa. Isso é normal.
    if (error?.code !== 'ERR_STREAM_PREMATURE_CLOSE' && error?.code !== 'ECONNRESET') {
      console.error('[proxy] erro no stream:', error.message);
    }
    res.destroy();
  }
}

export async function fetchText(url, { headers = {}, timeoutMs = 20_000 } = {}) {
  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Origem respondeu ${response.status} ${response.statusText}`), {
      status: response.status === 404 ? 404 : 502,
    });
  }
  return { text: await response.text(), finalUrl: response.url || url };
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  let body = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  return { ok: response.ok, status: response.status, body };
}

export function encodeUrlParam(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeUrlParam(value) {
  return Buffer.from(String(value), 'base64url').toString('utf8');
}
