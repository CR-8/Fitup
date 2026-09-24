/**
 * One-off: copies the existing catalogue_exercises rows into Payload so they
 * can be edited here. Skips Supabase sync (skipSync) since the rows already
 * live there, and skips any catalogueId already imported, so it is re-runnable.
 *
 *   npx payload run scripts/import-catalogue.ts
 */
import pg from 'pg'
import { getPayload } from 'payload'

import config from '../src/payload.config'

const payload = await getPayload({ config })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(
  `select id, name, category, equipment, primary_muscle_groups, secondary_muscle_groups, gif_filename, is_active
   from catalogue_exercises order by name`,
)

let created = 0
let skipped = 0

for (const row of rows) {
  const existing = await payload.find({
    collection: 'exercises',
    where: { catalogueId: { equals: row.id } },
    limit: 1,
    depth: 0,
    draft: true,
  })
  if (existing.totalDocs > 0) {
    skipped++
    continue
  }

  await payload.create({
    collection: 'exercises',
    context: { skipSync: true },
    draft: !row.is_active,
    data: {
      catalogueId: row.id,
      name: row.name,
      category: row.category,
      equipment: row.equipment,
      primaryMuscleGroups: row.primary_muscle_groups,
      secondaryMuscleGroups: row.secondary_muscle_groups,
      gifFilename: row.gif_filename,
      _status: row.is_active ? 'published' : 'draft',
    },
  })
  created++
  if (created % 100 === 0) console.log(`imported ${created}/${rows.length}`)
}

console.log(`done: ${created} created, ${skipped} already present`)
await pool.end()
process.exit(0)
