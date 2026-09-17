import { deactivateFood, newCatalogueId, syncFood } from '../../../../lib/catalogue-sync';

export default {
    async beforeCreate(event: { params: { data: Record<string, any> } }) {
        event.params.data.catalogueId ??= newCatalogueId();
    },

    async afterPublish(event: { result: Record<string, any> }) {
        const entry = event.result;

        await syncFood({
            id: entry.catalogueId,
            name: entry.name,
            category: entry.category ?? 'other',
            servingSize: entry.servingSize,
            calories: entry.calories ?? 0,
            proteinG: entry.proteinG ?? 0,
            carbsG: entry.carbsG ?? 0,
            fatG: entry.fatG ?? 0,
            isActive: true,
        });
    },

    async afterUnpublish(event: { result: Record<string, any> }) {
        await deactivateFood(event.result.catalogueId);
    },
};
