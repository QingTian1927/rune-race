export function isRegisteredAccount(isAnon: boolean): boolean {
  return !isAnon
}

/** Registered accounts have `is_anon !== true` in Supabase user metadata. */
export function isRegisteredFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): boolean {
  if (!metadata) return false
  return metadata.is_anon !== true
}

export function displayNameFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): string | null {
  if (!metadata) return null
  const direct = metadata.display_name
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const full = metadata.full_name ?? metadata.name
  if (typeof full === 'string' && full.trim()) return full.trim()
  return null
}

export function fullNameFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): string | null {
  if (!metadata) return null
  const direct = metadata.full_name
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const name = metadata.name
  if (typeof name === 'string' && name.trim()) return name.trim()
  return displayNameFromMetadata(metadata)
}
