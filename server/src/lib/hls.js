import { env } from '../env.js';

/**
 * Proxy de HLS compartilhado por música (videoclipe) e IPTV.
 *
 * Dois motivos pra existir:
 *  1. as URLs do googlevideo e dos provedores de IPTV são amarradas
 *     ao IP de quem pediu e não mandam CORS — o navegador não alcança;
 *  2. o manifesto aponta os segmentos em caminho relativo ao servidor
 *     de origem, então sem reescrever o player pega o primeiro pedaço
 *     e trava no segundo.
 */

export function proxyUrlFor(absoluteUrl, token) {
  const encoded = encodeURIComponent(Buffer.from(absoluteUrl, 'utf8').toString('base64'));
  const suffix = token ? `&t=${encodeURIComponent(token)}` : '';
  return `${env.publicBaseUrl}/api/stream?u=${encoded}${suffix}`;
}

export function decodeTarget(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

export function rewriteManifest(text, baseUrl, token) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        // #EXT-X-KEY, #EXT-X-MEDIA e #EXT-X-MAP carregam URI em atributo.
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          try {
            return `URI="${proxyUrlFor(new URL(uri, baseUrl).href, token)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        return proxyUrlFor(new URL(trimmed, baseUrl).href, token);
      } catch {
        return line;
      }
    })
    .join('\n');
}

export const MANIFEST_TYPES = /(mpegurl|m3u8|vnd\.apple)/i;

export function looksLikeManifest(url, contentType) {
  if (MANIFEST_TYPES.test(contentType || '')) return true;
  try {
    return /\.m3u8?(\?|$)/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Cache de segmentos                                                  */
/* ------------------------------------------------------------------ */

/**
 * É isto que resolve o limite de telas do provedor de IPTV.
 *
 * Quando os dois estão assistindo o mesmo canal sincronizados, eles
 * pedem o mesmo segmento quase ao mesmo tempo. Sem cache, viram duas
 * conexões no provedor e estoura o limite de telas. Com o cache — e
 * com a deduplicação de requisições em voo — o backend busca UMA vez
 * e serve os dois. Pro provedor, é uma tela só.
 *
 * Só segmento entra aqui: manifesto de canal ao vivo muda a cada
 * poucos segundos e nunca deve ser guardado.
 */
const SEGMENT_TTL_MS = 30_000;
// Num container de 512 MB, cache grande e o que sobra pro resto
// competem pelo mesmo espaco. 24 MB seguram varios segmentos de
// canal ao vivo, que e o caso que importa aqui.
const MAX_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_SEGMENT_BYTES = 8 * 1024 * 1024;

const segments = new Map();
const inFlight = new Map();
let cachedBytes = 0;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of segments) {
    if (entry.expiresAt <= now) {
      segments.delete(key);
      cachedBytes -= entry.body.byteLength;
    }
  }

  // Ainda grande demais: derruba os mais antigos (Map mantém a ordem).
  while (cachedBytes > MAX_CACHE_BYTES && segments.size > 0) {
    const [key, entry] = segments.entries().next().value;
    segments.delete(key);
    cachedBytes -= entry.body.byteLength;
  }
}

export function getCachedSegment(url) {
  const entry = segments.get(url);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    segments.delete(url);
    cachedBytes -= entry.body.byteLength;
    return null;
  }
  return entry;
}

/**
 * Busca o segmento uma única vez, mesmo que os dois peçam junto.
 * Retorna null quando o segmento é grande demais pra caber no cache —
 * nesse caso o chamador faz streaming normal, sem guardar.
 */
export async function fetchSegmentOnce(url, headers) {
  const cached = getCachedSegment(url);
  if (cached) return cached;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = (async () => {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw Object.assign(new Error(`A origem respondeu ${response.status}.`), {
        status: response.status === 404 ? 404 : 502,
      });
    }

    const declaredLength = Number(response.headers.get('content-length')) || 0;
    if (declaredLength > MAX_SEGMENT_BYTES) {
      // Grande demais: devolve a resposta crua pra quem chamou
      // transmitir direto, sem passar pela memória.
      return { tooLarge: true, response };
    }

    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > MAX_SEGMENT_BYTES) {
      return { tooLarge: true, buffered: body, contentType: response.headers.get('content-type') };
    }

    const entry = {
      body,
      contentType: response.headers.get('content-type') || 'video/mp2t',
      expiresAt: Date.now() + SEGMENT_TTL_MS,
    };

    segments.set(url, entry);
    cachedBytes += body.byteLength;
    evictExpired();

    return entry;
  })();

  inFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(url);
  }
}

export function cacheStats() {
  return {
    segments: segments.size,
    megabytes: Number((cachedBytes / 1024 / 1024).toFixed(1)),
    inFlight: inFlight.size,
  };
}
