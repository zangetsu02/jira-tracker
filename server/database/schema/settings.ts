import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  microservicesDirectory: text('microservices_directory').notNull(),
  microservicesPattern: varchar('microservices_pattern', { length: 100 }).default('sil-ms-*'),
  userId: text('user_id').notNull().unique(),
  updatedAt: timestamp('updated_at').defaultNow()
})
