/** Comma-separated env values → unique origin list (no trailing slash). */
function parseOriginList(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return [
    ...new Set(
      raw
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),
  ]
}

/**
 * Allowed browser origins for Fastify CORS and Socket.IO.
 * Merges CLIENT_ORIGIN (game) and ADMIN_ORIGIN (admin console).
 */
export function resolveCorsOrigins(): string[] | true {
  const origins = [
    ...parseOriginList(process.env.CLIENT_ORIGIN),
    ...parseOriginList(process.env.ADMIN_ORIGIN),
  ]
  const unique = [...new Set(origins)]
  return unique.length > 0 ? unique : true
}
