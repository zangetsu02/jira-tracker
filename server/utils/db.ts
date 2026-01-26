import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { EventHandlerRequest, H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/node-postgres'

import * as schema from '../database/schema'
import { getPgPool } from './drivers'

let dbInstance: NodePgDatabase<typeof schema>

const getDBInstance = (): NodePgDatabase<typeof schema> => {
  if (!dbInstance) {
    dbInstance = drizzle({ client: getPgPool(), schema })
  }
  return dbInstance
}

export const getDB = () => {
  return getDBInstance()
}

// use db with schema - always reuse the same instance
export const useDB = async (_event?: H3Event<EventHandlerRequest>): Promise<NodePgDatabase<typeof schema>> => {
  return getDBInstance()
}

export type TableNames = keyof typeof schema

export function isValidTable(table: string): table is TableNames {
  return table in schema
}
