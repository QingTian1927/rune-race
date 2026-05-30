/** Supabase Auth user ids are UUIDs; guest local ids use `anon-` prefix. */
const SUPABASE_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isLikelySupabaseUserId(id: string): boolean {
  return SUPABASE_USER_ID.test(id) && !id.startsWith('anon-')
}
