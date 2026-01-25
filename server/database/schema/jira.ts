import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const jiraConfig = pgTable('jira_config', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  password: text('password').notNull(),
  defaultProject: varchar('default_project', { length: 50 }),
  baseLabel: varchar('base_label', { length: 100 }),
  titlePrefix: varchar('title_prefix', { length: 100 }),
  updatedAt: timestamp('updated_at').defaultNow(),
  userId: text('user_id').notNull().unique()
})
