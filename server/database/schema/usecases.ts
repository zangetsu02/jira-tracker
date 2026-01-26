import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core'
import { microservices } from './microservices'

export const usecases = pgTable('usecases', {
  id: serial('id').primaryKey(),
  microserviceId: integer('microservice_id').references(() => microservices.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 255 }),
  title: varchar('title', { length: 500 }),
  description: text('description'),
  actors: text('actors'),
  preconditions: text('preconditions'),
  mainFlow: text('main_flow'),
  alternativeFlows: text('alternative_flows'),
  createdAt: timestamp('created_at').defaultNow()
})
