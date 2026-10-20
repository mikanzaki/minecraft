export function inspectSiteSource(origin, referer, allowedOrigins) {
  const originAllowed = matchesAllowedOrigin(origin, allowedOrigins);
  if (originAllowed) return { allowed: true, source: 'origin' };

  const refererAllowed = matchesAllowedOrigin(referer, allowedOrigins);
  if (refererAllowed) return { allowed: true, source: 'referer' };

  if (!origin && !referer) return { allowed: false, reason: 'origin_missing' };
  return { allowed: false, reason: 'origin_mismatch' };
}

function matchesAllowedOrigin(value, allowedOrigins) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}
