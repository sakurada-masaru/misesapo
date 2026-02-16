/**
 * Simple "integrated search" helpers.
 * - Normalizes full/half width (NFKC)
 * - Lowercases
 * - Token match: all tokens must be included
 *
 * This is intentionally lightweight (no external deps).
 */

export function normalizeForSearch(v) {
  const s = String(v == null ? '' : v);
  // NFKC: full-width/half-width and common kana normalization.
  const nfkc = s.normalize ? s.normalize('NFKC') : s;
  return nfkc
    .toLowerCase()
    // remove whitespace (including Japanese full-width space)
    .replace(/[\s\u3000]+/g, '')
    // remove common punctuation so "TENPO 0107" matches "TENPO#0107"
    .replace(/[‐‑‒–—―\-_/|\\,，．。.・:：;；'’"“”()（）［］\[\]{}｛｝]+/g, '');
}

export function tokenizeQuery(q) {
  const raw = String(q == null ? '' : q).trim();
  if (!raw) return [];
  const nfkc = raw.normalize ? raw.normalize('NFKC') : raw;
  // Split first (keep meaningful groups), then normalize each token.
  const rough = nfkc
    .toLowerCase()
    .split(/[\s\u3000,/|\\・]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
  const tokens = rough.map(normalizeForSearch).filter(Boolean);
  // Also include "compact" query as a single token to allow no-space matching.
  const compact = normalizeForSearch(nfkc);
  if (compact && !tokens.includes(compact)) tokens.push(compact);
  return Array.from(new Set(tokens));
}

export function matchAllTokens(haystackRaw, qRaw) {
  const hay = normalizeForSearch(haystackRaw);
  const tokens = tokenizeQuery(qRaw);
  if (!tokens.length) return true;
  return tokens.every((t) => hay.includes(t));
}

