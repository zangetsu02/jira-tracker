import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const microservices = pgTable('microservices', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  path: text('path').notNull(),
  pdfFilename: varchar('pdf_filename', { length: 255 }),
  pdfPath: text('pdf_path'),
  legacyPath: text('legacy_path'), // Path to legacy ASPX code (e.g., docs/aspx)
  lastAnalysis: timestamp('last_analysis'),
  lastReport: text('last_report'), // Full markdown report from analysis
  createdAt: timestamp('created_at').defaultNow()
})
