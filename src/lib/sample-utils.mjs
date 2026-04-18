export function seededSample(pool, count, seed) {
  const copy = [...pool];
  let t = seed;
  function rng() {
    t = (t * 9301 + 49297) % 233280;
    return t / 233280;
  }
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
