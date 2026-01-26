import pg from 'pg'
import { Resend } from 'resend'
import { runtimeConfig } from './runtimeConfig'

const createPgPool = () => new pg.Pool({
  connectionString: runtimeConfig.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000
})

let pgPool: pg.Pool

// PG Pool - always reuse the same pool
export const getPgPool = () => {
  if (!pgPool) {
    pgPool = createPgPool()
  }
  return pgPool
}

export const resendInstance = new Resend(runtimeConfig.resendApiKey)
