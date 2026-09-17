import { deactivateExercise, newCatalogueId, syncExercise } from '../../../../lib/catalogue-sync';

/**
 * Strapi is the editorial copy; `catalogue_exercises` is what the app and the
 * AI planner actually read. Publishing is the only moment that boundary is
 * crossed — a draft can be edited freely without touching Supabase or
 * spending an embedding call.
 */
export default {
    async beforeCreate(event: { params: { data: Record<string, any> } }) {
        event.params.data.catalogueId ??= newCatalogueId();
    },

    async afterPublish(event: { result: Record<string, any> }) {
        const entry = event.result;

        await syncExercise({
            id: entry.catalogueId,
            name: entry.name,
            category: entry.category,
            equipment: entry.equipment ?? [],
            primaryMuscleGroups: entry.primaryMuscleGroups ?? [],
            secondaryMuscleGroups: entry.secondaryMuscleGroups ?? [],
            gifFilename: entry.gifFilename ?? '',
            isActive: true,
        });
    },

    async afterUnpublish(event: { result: Record<string, any> }) {
        await deactivateExercise(event.result.catalogueId);
    },
};
