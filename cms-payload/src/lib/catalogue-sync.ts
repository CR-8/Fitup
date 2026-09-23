/**
 * Mirrors a published Payload entry into the Supabase tables the app and the
 * AI planner read (`catalogue_exercises`, `catalogue_foods`), then asks
 * `syn-backfill` to (re-)embed exactly that row. One direction only.
 */

const readSupabaseEnv = () => {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the catalogue to sync.')
  }

  return { url, serviceKey }
}

const postgrest = async (
  path: string,
  init: RequestInit & { onConflict?: string } = {},
): Promise<void> => {
  const { url, serviceKey } = readSupabaseEnv()
  const { onConflict, ...rest } = init

  const response = await fetch(`${url}/rest/v1/${onConflict ? `${path}?on_conflict=${onConflict}` : path}`, {
    ...rest,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase ${response.status} on ${path}: ${(await response.text()).slice(0, 400)}`)
  }
}

const requestEmbedding = async (route: 'run' | 'run-foods', ids: string[]): Promise<void> => {
  const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL
  const adminUser = process.env.SYN_BACKFILL_ADMIN_USER
  const adminPassword = process.env.SYN_BACKFILL_ADMIN_PASSWORD

  if (!functionsUrl || !adminUser || !adminPassword) {
    console.warn(
      `Skipping embedding refresh for ${ids.join(', ')}: SUPABASE_FUNCTIONS_URL / SYN_BACKFILL_ADMIN_USER / ` +
        'SYN_BACKFILL_ADMIN_PASSWORD not set. The row is synced but not searchable by AI retrieval until a backfill runs.',
    )
    return
  }

  const auth = Buffer.from(`${adminUser}:${adminPassword}`).toString('base64')
  const response = await fetch(
    `${functionsUrl}/syn-backfill/${route}?ids=${ids.map(encodeURIComponent).join(',')}`,
    { method: 'POST', headers: { authorization: `Basic ${auth}` } },
  )

  if (!response.ok) {
    console.error(`syn-backfill/${route} failed for ${ids.join(', ')}: ${await response.text()}`)
  }
}

/** Same 21-character nanoid shape the app uses, so ids look identical everywhere. */
const ID_ALPHABET = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

export const newCatalogueId = (): string => {
  let id = ''
  for (let i = 0; i < 21; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
  return id
}

export interface CatalogueExerciseFields {
  id: string
  name: string
  category: string
  equipment: string[]
  primaryMuscleGroups: string[]
  secondaryMuscleGroups: string[]
  gifFilename: string
  isActive: boolean
}

export const syncExercise = async (entry: CatalogueExerciseFields): Promise<void> => {
  await postgrest('catalogue_exercises', {
    method: 'POST',
    onConflict: 'id',
    body: JSON.stringify({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      equipment: entry.equipment,
      primary_muscle_groups: entry.primaryMuscleGroups,
      secondary_muscle_groups: entry.secondaryMuscleGroups,
      gif_filename: entry.gifFilename,
      is_active: entry.isActive,
      updated_at: Date.now(),
    }),
  })

  if (entry.isActive) await requestEmbedding('run', [entry.id])
}

export const deactivateExercise = (id: string): Promise<void> =>
  postgrest(`catalogue_exercises?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: false, updated_at: Date.now() }),
  })

export interface CatalogueFoodFields {
  id: string
  name: string
  category: string
  servingSize: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  isActive: boolean
}

export const syncFood = async (entry: CatalogueFoodFields): Promise<void> => {
  await postgrest('catalogue_foods', {
    method: 'POST',
    onConflict: 'id',
    body: JSON.stringify({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      serving_size: entry.servingSize,
      calories: entry.calories,
      protein_g: entry.proteinG,
      carbs_g: entry.carbsG,
      fat_g: entry.fatG,
      is_active: entry.isActive,
      updated_at: Date.now(),
    }),
  })

  if (entry.isActive) await requestEmbedding('run-foods', [entry.id])
}

export const deactivateFood = (id: string): Promise<void> =>
  postgrest(`catalogue_foods?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: false, updated_at: Date.now() }),
  })
