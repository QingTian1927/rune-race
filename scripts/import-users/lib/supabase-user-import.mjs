import { createClient } from '@supabase/supabase-js'

/** @typedef {import('../types.mjs').UserImportRecord} UserImportRecord */
/** @typedef {import('../types.mjs').ImportRowResult} ImportRowResult */

const PROFILE_COLUMNS = 'id, full_name, display_name, phone, is_anon'

/**
 * @param {{ supabaseUrl: string, supabaseSecretKey: string, defaultPassword: string }} config
 */
export function createSupabaseImporter(config) {
  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  /** @type {Map<string, import('@supabase/supabase-js').User>} */
  let emailIndex = null

  async function buildEmailIndex() {
    if (emailIndex) return emailIndex

    emailIndex = new Map()
    let page = 1

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw new Error(`listUsers failed: ${error.message}`)

      for (const user of data.users) {
        const email = user.email?.trim().toLowerCase()
        if (email) emailIndex.set(email, user)
      }

      if (data.users.length < 1000) break
      page += 1
    }

    return emailIndex
  }

  /**
   * @param {string} userId
   * @param {{ fullName?: string | null, displayName?: string | null, phone?: string | null }} patch
   */
  async function patchProfile(userId, patch) {
    /** @type {Record<string, string | null>} */
    const update = {}
    if (patch.fullName) update.full_name = patch.fullName
    if (patch.displayName) update.display_name = patch.displayName
    if (patch.phone) update.phone = patch.phone

    if (Object.keys(update).length === 0) return

    const { error } = await supabase.from('profiles').update(update).eq('id', userId)
    if (error) throw new Error(`profiles update failed: ${error.message}`)
  }

  async function ensureProfile(userId, record) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(`profiles select failed: ${error.message}`)

    if (!data) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        full_name: record.fullName || null,
        display_name: record.fullName || null,
        phone: record.phone,
        is_anon: false,
      })
      if (insertError && insertError.code !== '23505') {
        throw new Error(`profiles insert failed: ${insertError.message}`)
      }
      return
    }

    await patchProfile(userId, {
      fullName: record.fullName || null,
      displayName: record.fullName || null,
      phone: record.phone,
    })
  }

  /**
   * @param {UserImportRecord} record
   * @param {{ dryRun: boolean }} options
   * @returns {Promise<ImportRowResult>}
   */
  async function importRecord(record, options) {
    const emailFix = record.extras?.emailFix ? JSON.parse(record.extras.emailFix) : null
    const emailError = record.extras?.emailError

    if (emailError) {
      return {
        action: 'skipped_invalid',
        sourceRow: record.sourceRow,
        email: record.emailRaw,
        fullName: record.fullName || null,
        userId: null,
        message: String(emailError),
        emailFix,
      }
    }

    if (!record.email || !record.fullName) {
      return {
        action: 'skipped_invalid',
        sourceRow: record.sourceRow,
        email: record.emailRaw || record.email,
        fullName: record.fullName || null,
        userId: null,
        message: 'missing full name or valid email',
        emailFix,
      }
    }

    const index = await buildEmailIndex()
    const existing = index.get(record.email)

    if (existing) {
      const hasFullName = Boolean(record.fullName)
      const hasPhone = Boolean(record.phone)
      if (!hasFullName && !hasPhone) {
        return {
          action: 'skipped_no_updates',
          sourceRow: record.sourceRow,
          email: record.email,
          fullName: record.fullName || null,
          userId: existing.id,
          message: 'user exists; no full_name or phone to update',
          emailFix,
        }
      }

      if (options.dryRun) {
        return {
          action: 'updated',
          sourceRow: record.sourceRow,
          email: record.email,
          fullName: record.fullName,
          userId: existing.id,
          message: 'dry-run: would update auth metadata + profile',
          emailFix,
        }
      }

      const currentMeta = existing.user_metadata ?? {}
      /** @type {Record<string, unknown>} */
      const nextMeta = {
        ...currentMeta,
        is_anon: false,
      }
      if (hasFullName) {
        nextMeta.full_name = record.fullName
        nextMeta.display_name = record.fullName
      }
      if (hasPhone) nextMeta.phone = record.phone

      const { error: authError } = await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: nextMeta,
      })
      if (authError) {
        return {
          action: 'error',
          sourceRow: record.sourceRow,
          email: record.email,
          fullName: record.fullName,
          userId: existing.id,
          message: authError.message,
          emailFix,
        }
      }

      await ensureProfile(existing.id, record)

      return {
        action: 'updated',
        sourceRow: record.sourceRow,
        email: record.email,
        fullName: record.fullName,
        userId: existing.id,
        message: 'updated existing user',
        emailFix,
      }
    }

    if (options.dryRun) {
      return {
        action: 'created',
        sourceRow: record.sourceRow,
        email: record.email,
        fullName: record.fullName,
        userId: null,
        message: 'dry-run: would create auth user + profile',
        emailFix,
      }
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: record.email,
      password: config.defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: record.fullName,
        display_name: record.fullName,
        phone: record.phone,
        is_anon: false,
      },
    })

    if (error) {
      return {
        action: 'error',
        sourceRow: record.sourceRow,
        email: record.email,
        fullName: record.fullName,
        userId: null,
        message: error.message,
        emailFix,
      }
    }

    const userId = data.user.id
    emailIndex.set(record.email, data.user)
    await ensureProfile(userId, record)

    return {
      action: 'created',
      sourceRow: record.sourceRow,
      email: record.email,
      fullName: record.fullName,
      userId,
      message: 'created user',
      emailFix,
    }
  }

  return { importRecord }
}
