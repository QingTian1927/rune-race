export function isAdminUser(userId: string): boolean {
  const allowlist = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return allowlist.includes(userId)
}
