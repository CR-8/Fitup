import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Exercises } from './collections/Exercises'
import { Foods } from './collections/Foods'
import { Users } from './collections/Users'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Exercises, Foods],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    // Schema comes from src/migrations only. Dev-mode push would introspect and
    // alter the shared Supabase database, which also holds the app's own tables.
    push: false,
    // Small pool: every serverless instance opens its own.
    pool: { connectionString: process.env.DATABASE_URL, max: 3 },
  }),
})
