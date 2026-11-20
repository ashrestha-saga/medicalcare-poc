/** Normalise for comparisons: lowercase, strip umlauts/punctuation/legal suffixes. */
export function impNorm(raw: string | null | undefined): string {
  let s = String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  s = s
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
  s = s.replace(/[^a-z0-9]+/g, "");
  // Strip common legal/marketing suffixes for manufacturer compare (repeat)
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/(gmbh|ag|kg|ug|medical|systems|gmbhco|cokg)$/g, "");
  }
  return s;
}

/** Levenshtein ratio in [0,1] — 1 = identical. */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]!;
  }
  const dist = prev[n]!;
  return 1 - dist / Math.max(m, n);
}

export function parseGtinsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* plain comma list */
  }
  return String(raw)
    .split(/[,;|]/)
    .map((g) => g.trim())
    .filter(Boolean);
}
