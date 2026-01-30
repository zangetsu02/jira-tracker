import { pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core'

export const analysisPrompts = pgTable('analysis_prompts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  content: text('content').notNull(),
  isDefault: boolean('is_default').default(false),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})
