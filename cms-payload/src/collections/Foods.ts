import type { CollectionConfig } from 'payload'

import { deactivateFood, newCatalogueId, syncFood } from '../lib/catalogue-sync'

/**
 * The food catalogue. Publishing syncs to Supabase's catalogue_foods and
 * refreshes its embedding. Unpublishing does not deactivate the Supabase row —
 * delete the entry for that.
 */
export const Foods: CollectionConfig = {
  slug: 'foods',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', '_status'] },
  versions: { drafts: true },
  hooks: {
    beforeValidate: [
      ({ data, operation }) =>
        operation === 'create' ? { ...data, catalogueId: data?.catalogueId || newCatalogueId() } : data,
    ],
    afterChange: [
      async ({ doc }) => {
        if (doc._status !== 'published') return doc
        await syncFood({
          id: doc.catalogueId,
          name: doc.name,
          category: doc.category ?? 'other',
          servingSize: doc.servingSize,
          calories: doc.calories ?? 0,
          proteinG: doc.proteinG ?? 0,
          carbsG: doc.carbsG ?? 0,
          fatG: doc.fatG ?? 0,
          isActive: true,
        })
        return doc
      },
    ],
    afterDelete: [async ({ doc }) => deactivateFood(doc.catalogueId)],
  },
  fields: [
    {
      name: 'catalogueId',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'The id this food has in catalogue_foods. Generated on creation.' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'category', type: 'text', defaultValue: 'other' },
    { name: 'servingSize', type: 'text', required: true, admin: { description: 'e.g. "100 g" or "1 cup"' } },
    { name: 'calories', type: 'number', defaultValue: 0 },
    { name: 'proteinG', type: 'number', defaultValue: 0 },
    { name: 'carbsG', type: 'number', defaultValue: 0 },
    { name: 'fatG', type: 'number', defaultValue: 0 },
  ],
}
