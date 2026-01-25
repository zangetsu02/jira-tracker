import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core'
import { microservices } from './microservices'
import { usecases } from './usecases'

export const analysisResults = pgTable('analysis_results', {
  id: serial('id').primaryKey(),
  microserviceId: integer('microservice_id').references(() => microservices.id, { onDelete: 'cascade' }),
  usecaseId: integer('usecase_id').references(() => usecases.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull(), // 'implemented' | 'partial' | 'missing' | 'unclear'
  confidence: varchar('confidence', { length: 50 }), // 'high' | 'medium' | 'low'
  evidence: text('evidence'),
  notes: text('notes'),
  jiraIssueKey: varchar('jira_issue_key', { length: 50 }),
  jiraIssueSummary: varchar('jira_issue_summary', { length: 500 }),
  analyzedAt: timestamp('analyzed_at').defaultNow()
})
