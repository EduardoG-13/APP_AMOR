import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import readline from 'node:readline';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { classifyEntry, isAdultContent, normalizeStreamUrl, parseEpisode, splitYear, parseExtinf, resolveMediaUrl } from './m3u.js';

/**
 * Guarda da lista do provedor.
 *
 * Uma lista de IPTV de verdade passa de 200 mil entradas. Ler o
 * arquivo inteiro como string, quebrar num array de linhas e manter
 * 200 mil objetos na memória estoura fácil os 512 MB do plano free —
 * foi exatamente o que derrubou o servidor (oomKilled) e levou junto
 * IPTV, export e tudo o mais.
 *
 * Aqui a lista é lida em fluxo, linha a linha, e gravada em disco
 * como NDJSON. Na memória fica só o que é pequeno: contagem por
 * categoria e a ficha das séries. As buscas varrem o arquivo.
 */

const ROOT = process.env.IPTV_CACHE_DIR || path.join(os.tmpdir(), 'nossa-sessao-iptv');
if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true });

/** Índices leves por fonte: nada de canal aqui dentro. */
const indexes = new Map();
const TTL_MS = 6 * 60 * 60 * 1000;

function fileFor(sourceKey) {
  return path.join(ROOT, `${sourceKey}.ndjson`);
}

function normalizeSeriesKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function dropStale() {
  const now = Date.now();
  for (const [key, index] of indexes) {
    if (index.expiresAt > now) continue;
    indexes.delete(key);
    try {
      rmSync(fileFor(key), { force: true });
    } catch {
      // arquivo já sumiu: tudo bem
    }
  }
}

/**
 * Baixa e processa a lista sem nunca ter o arquivo inteiro na memória.
 */
export async function ingest(sourceUrl, headers) {
  dropStale();

  const sourceKey = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 16);
  const target = fileFor(sourceKey);

  const response = await fetch(sourceUrl, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    throw Object.assign(new Error(`O provedor respondeu ${response.status}.`), { status: 502 });
  }
  if (!response.body) {
    throw Object.assign(new Error('O provedor não devolveu conteúdo.'), { status: 502 });
  }

  const out = createWriteStream(target, { encoding: 'utf8' });
  const lines = readline.createInterface({
    input: Readable.fromWeb(response.body),
    crlfDelay: Infinity,
  });

  const counts = { live: 0, movie: 0, series: 0, adult: 0 };
  const groups = { live: new Map(), movie: new Map(), series: new Map() };
  const series = new Map();

  let pending = null;
  let total = 0;
  let sawHeader = false;

  const bump = (kind, group, adult) => {
    const bucket = groups[kind];
    const current = bucket.get(group) || { count: 0, adult: false };
    current.count += 1;
    current.adult = current.adult || adult;
    bucket.set(group, current);
  };

  const write = (text) => {
    // Respeita a contrapressão do disco: sem isso o buffer de escrita
    // cresce na memória e devolve o problema que viemos resolver.
    if (!out.write(text)) return new Promise((resolve) => out.once('drain', resolve));
    return null;
  };

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!sawHeader && line.startsWith('#EXTM3U')) {
      sawHeader = true;
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      pending = parseExtinf(line);
      pending.logo = resolveMediaUrl(pending.logo, response.url || sourceUrl);
      continue;
    }

    if (line.startsWith('#EXTGRP:') && pending) {
      pending.group = line.slice('#EXTGRP:'.length).trim() || pending.group;
      continue;
    }

    if (line.startsWith('#') || !pending) continue;

    const streamUrl = resolveMediaUrl(line, response.url || sourceUrl);
    if (!streamUrl) { pending = null; continue; }

    total += 1;
    const group = pending.group || 'Sem categoria';
    const kind = classifyEntry({ name: pending.name, group, url: streamUrl });
    const adult = isAdultContent(pending.name, group);
    const episode = kind === 'series' ? parseEpisode(pending.name) : null;
    const seriesKey = episode ? normalizeSeriesKey(episode.seriesName) : null;

    counts[kind] += 1;
    if (adult) counts.adult += 1;
    bump(kind, group, adult);

    if (seriesKey) {
      let record = series.get(seriesKey);
      if (!record) {
        record = {
          key: seriesKey,
          name: episode.seriesName,
          group,
          logo: pending.logo,
          adult,
          seasons: new Set(),
          episodeCount: 0,
        };
        series.set(seriesKey, record);
      }
      if (!record.logo && pending.logo) record.logo = pending.logo;
      if (episode.season != null) record.seasons.add(episode.season);
      record.episodeCount += 1;
    }

    const entry = {
      i: total,
      n: pending.name,
      u: normalizeStreamUrl(streamUrl),
      l: pending.logo,
      g: group,
      k: kind,
      a: adult ? 1 : 0,
      sk: seriesKey,
      sn: episode?.seriesName || null,
      s: episode?.season ?? null,
      e: episode?.episode ?? null,
      et: episode?.episodeTitle || null,
    };

    pending = null;
    const wait = write(`${JSON.stringify(entry)}\n`);
    if (wait) await wait;
  }

  await new Promise((resolve, reject) => {
    out.end((error) => (error ? reject(error) : resolve()));
  });

  if (total === 0) {
    throw Object.assign(
      new Error('A lista veio vazia ou não está no formato M3U.'),
      { status: 422 }
    );
  }

  const summarize = (bucket) =>
    [...bucket.entries()]
      .map(([title, data]) => ({ title, count: data.count, adult: data.adult }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, 'pt-BR'));

  const index = {
    sourceKey,
    total,
    counts,
    groups: {
      live: summarize(groups.live),
      movie: summarize(groups.movie),
      series: summarize(groups.series),
    },
    series: [...series.values()].map((record) => {
      const { title, year } = splitYear(record.name);
      return {
        key: record.key,
        name: record.name,
        searchTitle: title,
        year,
        group: record.group,
        logo: record.logo,
        adult: record.adult,
        seasonCount: record.seasons.size,
        episodeCount: record.episodeCount,
      };
    }),
    expiresAt: Date.now() + TTL_MS,
  };

  indexes.set(sourceKey, index);
  return index;
}

export function getIndex(sourceKey) {
  const index = indexes.get(sourceKey);
  if (!index) return null;
  if (index.expiresAt <= Date.now()) {
    indexes.delete(sourceKey);
    return null;
  }
  if (!existsSync(fileFor(sourceKey))) {
    // O disco do Render é efêmero: se o arquivo sumiu, o índice mente.
    indexes.delete(sourceKey);
    return null;
  }
  return index;
}

function expand(entry) {
  return {
    id: `ch-${entry.i}`,
    name: entry.n,
    url: entry.u,
    logo: entry.l,
    group: entry.g,
    kind: entry.k,
    adult: Boolean(entry.a),
    seriesName: entry.sn,
    seriesKey: entry.sk,
    season: entry.s,
    episode: entry.e,
    episodeTitle: entry.et,
  };
}

/**
 * Varre o arquivo aplicando o filtro e devolve só a página pedida.
 * Nunca acumula mais que uma página na memória.
 */
export async function queryChannels(sourceKey, options) {
  const index = getIndex(sourceKey);
  if (!index) return null;

  const { kind, group, q, includeAdult, page = 1, pageSize = 60, seriesKey } = options;
  const needle = (q || '').trim().toLowerCase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  const lines = readline.createInterface({
    input: createReadStream(fileFor(sourceKey), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const picked = [];
  let matched = 0;

  for await (const line of lines) {
    if (!line) continue;

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (kind && entry.k !== kind) continue;
    if (seriesKey && entry.sk !== seriesKey) continue;
    if (!includeAdult && entry.a) continue;
    if (group && entry.g !== group) continue;
    if (needle && !entry.n.toLowerCase().includes(needle)) continue;

    if (matched >= from && matched < to) picked.push(expand(entry));
    matched += 1;
  }

  lines.close();
  return { channels: picked, total: matched, page, pageSize };
}

export async function seriesEpisodes(sourceKey, seriesKey) {
  const index = getIndex(sourceKey);
  if (!index) return null;

  const meta = index.series.find((item) => item.key === seriesKey);
  if (!meta) return null;

  // Uma série tem dezenas de episódios, não milhares: cabe na memória.
  const result = await queryChannels(sourceKey, {
    seriesKey,
    includeAdult: true,
    page: 1,
    pageSize: 5000,
  });

  const episodes = (result?.channels || []).sort(
    (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0)
  );

  return {
    name: meta.name,
    searchTitle: meta.searchTitle,
    year: meta.year,
    logo: meta.logo,
    group: meta.group,
    seasons: [...new Set(episodes.map((item) => item.season).filter((s) => s != null))].sort(
      (a, b) => a - b
    ),
    episodes,
  };
}

export function listSeries(sourceKey, { group, q, includeAdult, page = 1, pageSize = 48 }) {
  const index = getIndex(sourceKey);
  if (!index) return null;

  const needle = (q || '').trim().toLowerCase();
  let list = index.series;

  if (!includeAdult) list = list.filter((item) => !item.adult);
  if (group) list = list.filter((item) => item.group === group);
  if (needle) list = list.filter((item) => item.name.toLowerCase().includes(needle));

  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const from = (page - 1) * pageSize;

  return {
    series: sorted.slice(from, from + pageSize),
    total: sorted.length,
    page,
    pageSize,
  };
}

export function forget(sourceKey) {
  indexes.delete(sourceKey);
  try {
    rmSync(fileFor(sourceKey), { force: true });
  } catch {
    // já não existe
  }
}
