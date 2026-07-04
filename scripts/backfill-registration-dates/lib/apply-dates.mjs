import pg from 'pg'

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string, createdAt: string }} row
 */
async function updateUserRegistrationDate(client, row) {
  const { userId, createdAt } = row

  await client.query(
    `update auth.users
     set created_at = $1::timestamptz,
         updated_at = greatest(updated_at, $1::timestamptz)
     where id = $2::uuid`,
    [createdAt, userId],
  )

  await client.query(
    `update public.profiles
     set created_at = $1::timestamptz
     where id = $2::uuid`,
    [createdAt, userId],
  )
}

/**
 * @param {import('pg').PoolConfig} config
 * @param {{ userId: string, createdAt: string }[]} updates
 */
export async function applyRegistrationDates(config, updates) {
  const pool = new pg.Pool(config)
  const client = await pool.connect()

  try {
    await client.query('begin')
    for (const row of updates) {
      await updateUserRegistrationDate(client, row)
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
