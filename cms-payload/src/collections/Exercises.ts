import type { CollectionConfig } from 'payload'

import { deactivateExercise, newCatalogueId, syncExercise } from '../lib/catalogue-sync'

/**
 * Editorial copy of the exercise catalogue. Publishing syncs to Supabase's
 * catalogue_exercises and refreshes its embedding; drafts never leave here.
 * Unpublishing does not deactivate the Supabase row — delete the entry for that.
 */
export const Exercises: CollectionConfig = {
  slug: 'exercises',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', '_status'] },
  versions: { drafts: true },
  hooks: {
    beforeValidate: [
      ({ data, operation }) =>
        operation === 'create' ? { ...data, catalogueId: data?.catalogueId || newCatalogueId() } : data,
    ],
    afterChange: [
      async ({ doc, context }) => {
        if (context?.skipSync || doc._status !== 'published') return doc
        await syncExercise({
          id: doc.catalogueId,
          name: doc.name,
          category: doc.category,
          equipment: doc.equipment ?? [],
          primaryMuscleGroups: doc.primaryMuscleGroups ?? [],
          secondaryMuscleGroups: doc.secondaryMuscleGroups ?? [],
          gifFilename: doc.gifFilename ?? '',
          isActive: true,
        })
        return doc
      },
    ],
    afterDelete: [async ({ doc }) => deactivateExercise(doc.catalogueId)],
  },
  fields: [
    {
      name: 'catalogueId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          'The id this exercise has in catalogue_exercises. Generated on creation; changing it would orphan the Supabase row.',
      },
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: ['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other'],
    },
    { name: 'equipment', type: 'text', hasMany: true },
    { name: 'primaryMuscleGroups', type: 'text', hasMany: true },
    { name: 'secondaryMuscleGroups', type: 'text', hasMany: true },
    { name: 'instructions', type: 'text', hasMany: true },
    // Required: catalogue_exercises.gif_filename is NOT NULL and UNIQUE, so blanks would collide.
    { name: 'gifFilename', type: 'text', required: true },
  ],
}
