import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TtlCache } from './cache.js';

/**
 * Resolução do stream de áudio/vídeo.
 *
 * O InnerTube dá conta de busca e metadados, mas o endpoint /player
 * do YouTube hoje exige PoToken e devolve 400 ("automated queries")
 * pra todos os clientes. O yt-dlp resolve isso — ele acompanha essas
 * mudanças semana a semana — então a busca continua no InnerTube
 * (rápido) e a URL do stream sai daqui (confiável).
 *
 * A URL que volta é assinada e amarrada ao IP de quem pediu, por isso
 * quem a consome é o proxy do backend, nunca o navegador.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '../..');

/** URLs do googlevideo expiram em ~6h. */
const mediaCache = new TtlCache({ ttlMs: 2 * 60 * 60 * 1000, maxEntries: 300 });
const infoCache = new TtlCache({ ttlMs: 6 * 60 * 60 * 1000, maxEntries: 400 });

let resolvedCommand = null;

/**
 * Ordem de procura: variável de ambiente, binário baixado no build
 * do Render, PATH do sistema e, por último, o módulo do Python
 * (que é o caminho típico no Windows em desenvolvimento).
 */
function resolveCommand() {
  if (resolvedCommand) return resolvedCommand;

  if (process.env.YTDLP_PATH) {
    resolvedCommand = { bin: process.env.YTDLP_PATH, prefix: [] };
    return resolvedCommand;
  }

  for (const candidate of ['bin/yt-dlp', 'bin/yt-dlp.exe']) {
    const full = path.join(serverRoot, candidate);
    if (existsSync(full)) {
      resolvedCommand = { bin: full, prefix: [] };
      return resolvedCommand;
    }
  }

  resolvedCommand = { bin: process.env.PYTHON_PATH || 'python', prefix: ['-m', 'yt_dlp'] };
  return resolvedCommand;
}

function runYtdlp(args, { timeoutMs = 60_000 } = {}) {
  const { bin, prefix } = resolveCommand();

  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...prefix, ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error('yt-dlp demorou demais para responder.'), { status: 504 }));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        return reject(
          Object.assign(
            new Error(
              'yt-dlp não encontrado. Instale com "pip install -U yt-dlp" ou aponte YTDLP_PATH para o binário.'
            ),
            { status: 503 }
          )
        );
      }
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const message = stderr.split('\n').filter(Boolean).pop() || `yt-dlp saiu com código ${code}`;
        return reject(Object.assign(new Error(message.replace(/^ERROR:\s*/, '')), { status: 502 }));
      }
      resolve(stdout);
    });
  });
}

/**
 * Do IP de um datacenter (Render, Fly, Railway...) o YouTube recusa o
 * player e responde "Failed to extract any player response". Duas
 * saidas, nesta ordem:
 *
 *  1. Rotacao de cliente: cada "player_client" conversa com uma API
 *     diferente do YouTube, e nem todas sao barradas do mesmo jeito.
 *     Custa nada tentar e resolve boa parte dos casos.
 *
 *  2. Cookies de uma conta logada: o pedido passa a parecer um
 *     usuario de verdade. E o unico caminho que funciona quando o IP
 *     esta mesmo marcado. Use uma conta descartavel, nao a principal:
 *     o Google pode marcar a conta junto com o IP.
 *
 * Exporte os cookies com a extensao "Get cookies.txt LOCALLY" no
 * youtube.com e cole o conteudo inteiro em YTDLP_COOKIES.
 */
const CLIENT_FALLBACKS = [
  null, // o padrao do yt-dlp, que ja e o melhor palpite
  'youtube:player_client=tv',
  'youtube:player_client=web_safari',
  'youtube:player_client=mweb',
  'youtube:player_client=android_vr',
  'youtube:player_client=tv_embedded',
  'youtube:player_client=web_embedded',
];

/** O cliente que funcionou da ultima vez vai primeiro na proxima. */
let preferredClient = null;

let cookiesPath = null;
function getCookiesFile() {
  if (cookiesPath !== null) return cookiesPath || null;

  const raw = process.env.YTDLP_COOKIES;
  if (!raw || raw.trim().length < 20) {
    cookiesPath = '';
    return null;
  }

  try {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ns-cookies-'));
    cookiesPath = path.join(dir, 'cookies.txt');
    // O arquivo precisa terminar em quebra de linha, senao o yt-dlp
    // descarta a ultima entrada.
    writeFileSync(cookiesPath, raw.endsWith('\n') ? raw : `${raw}\n`, 'utf8');
    console.log('[yt-dlp] usando cookies de conta logada');
    return cookiesPath;
  } catch (error) {
    console.warn('[yt-dlp] nao consegui gravar os cookies:', error.message);
    cookiesPath = '';
    return null;
  }
}

function argsForClient(client) {
  const extra = [];

  const cookies = getCookiesFile();
  if (cookies) extra.push('--cookies', cookies);

  const fromEnv = process.env.YTDLP_EXTRACTOR_ARGS;
  if (fromEnv) extra.push('--extractor-args', fromEnv);
  else if (client) extra.push('--extractor-args', client);

  return extra;
}

const BASE_ARGS = [
  '--no-warnings',
  '--no-playlist',
  '--no-progress',
  '--socket-timeout',
  '15',
  '--retries',
  '2',
];

const FORMAT = {
  // itag 140 (m4a 128k) é progressivo e toca direto no <audio>.
  audio: 'bestaudio[protocol=https][ext=m4a]/bestaudio[protocol=https]/bestaudio',
  // O YouTube não serve mais nenhum formato com áudio e vídeo juntos
  // (o velho itag 18 sumiu), então não existe URL única pra tocar no
  // <video>. O jeito é pegar o manifesto HLS, que traz as faixas
  // separadas, e deixar o hls.js remontar no navegador.
  video: 'bestvideo[protocol=m3u8_native][height<=720]/best[protocol=m3u8_native]',
};

function mimeFor(info, type) {
  if (type === 'video') return 'video/mp4';
  const ext = info?.ext || info?.audio_ext;
  if (ext === 'webm' || info?.acodec?.startsWith('opus')) return 'audio/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  return 'audio/mp4';
}

async function dumpJson(sourceId, type) {
  // Comeca pelo cliente que funcionou por ultimo e so entao percorre
  // o resto, pra nao pagar a fila inteira em toda faixa.
  const order = preferredClient
    ? [preferredClient, ...CLIENT_FALLBACKS.filter((c) => c !== preferredClient)]
    : CLIENT_FALLBACKS;

  let raw = null;
  let lastError = null;

  for (const client of order) {
    try {
      raw = await runYtdlp([
        ...BASE_ARGS,
        ...argsForClient(client),
        '-f',
        FORMAT[type],
        '--dump-single-json',
        `https://www.youtube.com/watch?v=${sourceId}`,
      ]);
      preferredClient = client;
      break;
    } catch (error) {
      lastError = error;
      // Erro que nao e bloqueio (video privado, removido) nao melhora
      // trocando de cliente.
      if (!/player response|bot|sign in|unable to extract|403|429/i.test(error.message)) {
        throw error;
      }
    }
  }

  if (raw === null) {
    throw Object.assign(
      new Error(
        `O YouTube recusou este servidor. ${lastError?.message || ''} ` +
          'Defina YTDLP_COOKIES com os cookies de uma conta logada pra liberar.'
      ),
      { status: 502 }
    );
  }

  const info = JSON.parse(raw);
  const chosen = info.requested_downloads?.[0] || info;

  // No vídeo o que interessa é o manifesto mestre (tem todas as
  // qualidades e o áudio); `url` seria só a faixa de vídeo isolada,
  // que tocaria mudo.
  const url = type === 'video' ? chosen?.manifest_url || chosen?.url : chosen?.url;

  if (!url) {
    throw Object.assign(new Error('yt-dlp não devolveu URL de stream para esta faixa.'), {
      status: 502,
    });
  }

  return { info, chosen, url, isManifest: type === 'video' && Boolean(chosen?.manifest_url) };
}

export async function resolveMedia(sourceId, { type = 'audio' } = {}) {
  return mediaCache.remember(`${type}:${sourceId}`, async () => {
    const { info, chosen, url, isManifest } = await dumpJson(sourceId, type);

    // A ficha da faixa vem de graça nesta mesma chamada.
    infoCache.set(sourceId, {
      sourceId,
      source: 'ytmusic',
      title: info.track || info.title || 'Faixa sem título',
      artist: (info.artist || info.uploader || info.channel || 'Artista desconhecido').replace(
        /\s*-\s*Topic$/i,
        ''
      ),
      album: info.album || null,
      coverUrl: info.thumbnail || null,
      durationSec: info.duration ? Math.round(info.duration) : null,
      hasVideo: true,
    });

    return {
      url,
      isManifest: Boolean(isManifest),
      mimeType: isManifest ? 'application/vnd.apple.mpegurl' : mimeFor(chosen, type),
      contentLength: isManifest ? null : chosen.filesize || chosen.filesize_approx || null,
      bitrate: chosen.abr || chosen.tbr || null,
    };
  });
}

export async function getTrackInfo(sourceId) {
  const cached = infoCache.get(sourceId);
  if (cached) return cached;

  const raw = await runYtdlp([
    ...BASE_ARGS,
    '--skip-download',
    '--dump-single-json',
    `https://www.youtube.com/watch?v=${sourceId}`,
  ]);
  const info = JSON.parse(raw);

  return infoCache.set(sourceId, {
    sourceId,
    source: 'ytmusic',
    title: info.track || info.title || 'Faixa sem título',
    artist: (info.artist || info.uploader || info.channel || 'Artista desconhecido').replace(
      /\s*-\s*Topic$/i,
      ''
    ),
    album: info.album || null,
    coverUrl: info.thumbnail || null,
    durationSec: info.duration ? Math.round(info.duration) : null,
    hasVideo: true,
  });
}

/** Já deixa a próxima faixa resolvida pra troca ser instantânea. */
export function warmUp(sourceId, type = 'audio') {
  resolveMedia(sourceId, { type }).catch(() => {
    // Falha no aquecimento não é problema: resolve de novo no play.
  });
}

export async function checkAvailable() {
  try {
    const version = await runYtdlp(['--version'], { timeoutMs: 15_000 });
    return { available: true, version: version.trim() };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Testa cada player_client e diz qual funciona a partir do IP deste
 * servidor. E o jeito rapido de descobrir se o problema e o IP ou a
 * faixa, sem ficar redeployando no escuro.
 */
export async function diagnoseClients(sourceId) {
  const results = [];

  for (const client of CLIENT_FALLBACKS) {
    const started = Date.now();
    try {
      const raw = await runYtdlp(
        [
          ...BASE_ARGS,
          ...argsForClient(client),
          '-f',
          FORMAT.audio,
          '--dump-single-json',
          `https://www.youtube.com/watch?v=${sourceId}`,
        ],
        { timeoutMs: 45_000 }
      );
      const info = JSON.parse(raw);
      const chosen = info.requested_downloads?.[0] || info;
      results.push({
        client: client || '(padrao)',
        ok: Boolean(chosen?.url),
        formato: chosen?.format_id || null,
        ms: Date.now() - started,
      });
    } catch (error) {
      results.push({
        client: client || '(padrao)',
        ok: false,
        erro: String(error.message).slice(0, 160),
        ms: Date.now() - started,
      });
    }
  }

  return { comCookies: Boolean(getCookiesFile()), resultados: results };
}
