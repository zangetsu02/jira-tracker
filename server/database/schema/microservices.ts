import { pgTable, serial, text, timestamp, varchar, boolean, integer } from 'drizzle-orm/pg-core'

export const microservices = pgTable('microservices', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  path: text('path').notNull(),
  pdfFilename: varchar('pdf_filename', { length: 255 }), // Deprecated: use microservice_pdfs table
  pdfPath: text('pdf_path'), // Deprecated: use microservice_pdfs table
  legacyPath: text('legacy_path'), // Path to legacy ASPX code (e.g., docs/aspx)
  lastAnalysis: timestamp('last_analysis'),
  lastReport: text('last_report'), // Full markdown report from analysis
  excluded: boolean('excluded').default(false), // Exclude from analysis and stats
  createdAt: timestamp('created_at').defaultNow()
})

export const microservicePdfs = pgTable('microservice_pdfs', {
  id: serial('id').primaryKey(),
  microserviceId: integer('microservice_id').notNull().references(() => microservices.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 255 }).notNull(),
  path: text('path').notNull(),
  createdAt: timestamp('created_at').defaultNow()
})
