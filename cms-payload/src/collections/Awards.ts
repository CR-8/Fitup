import type { CollectionConfig } from 'payload'

import { deactivateAward, syncAward } from '../lib/catalogue-sync'

/**
 * The awards the app hands out. Publishing mirrors the award into Supabase's
 * catalogue_awards, which every install reads and lays over the awards it ships
 * with (src/services/award-catalogue.ts in the app): an Award ID matching a
 * built-in one (workouts10, calorieGoal, ...) edits that award, a new one adds
 * an award. The app does the earning; this only says what there is to earn.
 */

const METRICS = [
  { label: 'Calories eaten today', value: 'calories_today' },
  { label: 'Days the calorie goal was met (past year)', value: 'calorie_goal_days' },
  { label: 'Water drunk today (ml)', value: 'water_today' },
  { label: 'Days the water goal was met (past year)', value: 'water_goal_days' },
  { label: 'Sessions finished, all time', value: 'workouts_total' },
  { label: 'Sessions finished this week', value: 'workouts_week' },
  { label: 'Days trained in a row', value: 'streak_days' },
]

const SYMBOLS = ['flame', 'target', 'drop', 'dumbbell', 'trophy', 'calendar', 'bolt']

export const Awards: CollectionConfig = {
  slug: 'awards',
  labels: { singular: 'Award', plural: 'Awards' },
  admin: {
    useAsTitle: 'nameEn',
    defaultColumns: ['nameEn', 'metric', 'target', 'repeat', 'active', '_status'],
    description: 'What the app awards, and for what. The app measures and records the earning itself.',
  },
  defaultSort: 'sortOrder',
  versions: { drafts: true },
  hooks: {
    afterChange: [
      async ({ doc, context }) => {
        if (context?.skipSync || doc._status !== 'published') return doc
        await syncAward({
          id: doc.awardId,
          metric: doc.metric,
          target: doc.target ?? null,
          repeat: doc.repeat,
          group: doc.group,
          shape: doc.shape,
          symbol: doc.symbol,
          color: doc.color,
          name: { en: doc.nameEn, ...(doc.nameHi ? { hi: doc.nameHi } : {}) },
          description: {
            ...(doc.descriptionEn ? { en: doc.descriptionEn } : {}),
            ...(doc.descriptionHi ? { hi: doc.descriptionHi } : {}),
          },
          sortOrder: doc.sortOrder ?? 0,
          isActive: doc.active !== false,
        })
        return doc
      },
    ],
    afterDelete: [async ({ doc }) => deactivateAward(doc.awardId)],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'awardId',
          label: 'Award ID',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          validate: (value: string | null | undefined) =>
            /^[A-Za-z0-9_-]{2,40}$/.test(value ?? '') || 'Letters, digits, - and _ only (2–40).',
          admin: {
            width: '50%',
            description: 'What earnings are recorded under. Never change it once published.',
          },
        },
        { name: 'active', type: 'checkbox', defaultValue: true, admin: { width: '50%', description: 'Untick and publish to hide it in the app.' } },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Words',
          fields: [
            { name: 'nameEn', label: 'Name (English)', type: 'text', required: true },
            {
              name: 'descriptionEn',
              label: 'Description (English)',
              type: 'textarea',
              admin: { description: 'May use {{value}} (where they stand) and {{target}}.' },
            },
            { name: 'nameHi', label: 'Name (Hindi)', type: 'text' },
            { name: 'descriptionHi', label: 'Description (Hindi)', type: 'textarea' },
          ],
        },
        {
          label: 'Rule',
          fields: [
            { name: 'metric', type: 'select', required: true, options: METRICS, defaultValue: 'workouts_total' },
            {
              name: 'target',
              type: 'number',
              min: 1,
              admin: { description: "Leave empty to use the person's own goal (calories, water, weekly sessions)." },
            },
            {
              name: 'repeat',
              type: 'select',
              required: true,
              defaultValue: 'once',
              options: [
                { label: 'Once', value: 'once' },
                { label: 'Every day', value: 'daily' },
                { label: 'Every week', value: 'weekly' },
              ],
            },
          ],
        },
        {
          label: 'Look',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'group',
                  type: 'select',
                  required: true,
                  defaultValue: 'workouts',
                  options: [
                    { label: 'Daily Goals', value: 'daily' },
                    { label: 'Workouts', value: 'workouts' },
                  ],
                  admin: { width: '33%' },
                },
                {
                  name: 'shape',
                  type: 'select',
                  required: true,
                  defaultValue: 'circle',
                  options: ['circle', 'square', 'diamond'],
                  admin: { width: '33%' },
                },
                { name: 'symbol', type: 'select', required: true, defaultValue: 'trophy', options: SYMBOLS, admin: { width: '33%' } },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'color',
                  type: 'text',
                  required: true,
                  defaultValue: '#D6F25A',
                  validate: (value: string | null | undefined) =>
                    /^#[0-9a-fA-F]{6}$/.test(value ?? '') || 'A hex colour like #D6F25A.',
                  admin: { width: '50%', description: 'The colour once earned. Lime #D6F25A, blue #5AB0FF, pink #FF6F91, orange #FF9F0A.' },
                },
                { name: 'sortOrder', type: 'number', defaultValue: 0, admin: { width: '50%', description: 'Lower comes first.' } },
              ],
            },
          ],
        },
      ],
    },
  ],
}
