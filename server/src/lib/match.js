/**
 * Casamento de faixas entre plataformas.
 *
 * A faixa nasce no YouTube Music, então no YouTube o match é exato
 * (mesmo videoId). No Spotify e na Deezer é preciso procurar por
 * título + artista, e o título do YT Music vem cheio de sujeira
 * ("(Official Video)", "feat.", "Remastered 2011"...). Estas funções
 * limpam isso e dão uma nota de confiança pro melhor candidato.
 */

const NOISE_PATTERNS = [
  /\(.*?(official|lyric|video|audio|visualizer|clipe|oficial|ao vivo|live|hd|4k).*?\)/gi,
  /\[.*?(official|lyric|video|audio|visualizer|clipe|oficial|ao vivo|live|hd|4k).*?\]/gi,
  /\b(official\s+(music\s+)?video|lyric\s+video|audio\s+oficial|video\s+oficial|clipe\s+oficial)\b/gi,
  /\b(remaster(ed)?(\s+\d{4})?|digital\s+remaster)\b/gi,
  /\b\d{3,4}p\b/gi,
];

const FEAT_PATTERN = /\s*(\(|\[)?\s*(feat\.?|ft\.?|com|featuring)\s+[^)\]]*(\)|\])?/gi;

export function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(NOISE_PATTERNS[0], ' ')
    .replace(NOISE_PATTERNS[1], ' ')
    .replace(NOISE_PATTERNS[2], ' ')
    .replace(NOISE_PATTERNS[3], ' ')
    .replace(NOISE_PATTERNS[4], ' ')
    .replace(FEAT_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normalizeArtist(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*-\s*topic$/, '')
    .replace(/\b(vevo|official)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Distância de Levenshtein normalizada em similaridade 0..1. */
function similarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = new Array(cols);
  let current = new Array(cols);

  for (let j = 0; j < cols; j += 1) previous[j] = j;

  for (let i = 1; i < rows; i += 1) {
    current[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }

  const distance = previous[cols - 1];
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Nota final de um candidato: título pesa mais que artista, e a
 * duração serve de desempate (pega versão ao vivo/remix errada).
 */
export function scoreCandidate(target, candidate) {
  const titleScore = similarity(normalizeTitle(target.title), normalizeTitle(candidate.title));
  const artistScore = similarity(normalizeArtist(target.artist), normalizeArtist(candidate.artist));

  let durationScore = 0.5;
  if (target.durationSec && candidate.durationSec) {
    const diff = Math.abs(target.durationSec - candidate.durationSec);
    if (diff <= 3) durationScore = 1;
    else if (diff <= 10) durationScore = 0.8;
    else if (diff <= 25) durationScore = 0.45;
    else durationScore = 0;
  }

  return Number((titleScore * 0.55 + artistScore * 0.3 + durationScore * 0.15).toFixed(3));
}

export function pickBestMatch(target, candidates, { threshold = 0.62 } = {}) {
  let best = null;

  for (const candidate of candidates) {
    const score = scoreCandidate(target, candidate);
    if (!best || score > best.score) best = { candidate, score };
  }

  if (!best || best.score < threshold) return null;
  return best;
}

export function chunk(items, size) {
  const output = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}
