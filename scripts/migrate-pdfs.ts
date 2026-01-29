/**
 * Migration script to copy existing PDFs from microservices table to microservice_pdfs table
 * Run with: npx tsx scripts/migrate-pdfs.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { isNotNull, eq, and } from 'drizzle-orm'
import { microservices, microservicePdfs } from '../server/database/schema'

async function main() {
  const databaseUrl = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  console.log('Fetching microservices with PDFs...')

  const msWithPdfs = await db
    .select()
    .from(microservices)
    .where(isNotNull(microservices.pdfPath))

  console.log(`Found ${msWithPdfs.length} microservices with PDFs`)

  let migrated = 0
  let skipped = 0

  for (const ms of msWithPdfs) {
    if (!ms.pdfPath) continue

    // Check if already migrated
    const existing = await db
      .select()
      .from(microservicePdfs)
      .where(and(
        eq(microservicePdfs.microserviceId, ms.id),
        eq(microservicePdfs.path, ms.pdfPath!)
      ))
      .limit(1)

    if (existing.length > 0) {
      console.log(`Skipping ${ms.name} - already migrated`)
      skipped++
      continue
    }

    await db.insert(microservicePdfs).values({
      microserviceId: ms.id,
      filename: ms.pdfFilename || 'document.pdf',
      path: ms.pdfPath
    })

    console.log(`Migrated PDF for ${ms.name}`)
    migrated++
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped`)

  await pool.end()
}

main().catch(console.error)
