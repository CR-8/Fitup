import { parseList } from './exercises.ts';
import { macroTotals, type MealWithItems, type Profile } from './supabase.ts';
import { EXERCISE_CATEGORIES, MEAL_SLOTS, type ExerciseRow } from './types.ts';
import { esc } from './ui.ts';

const option = (value: string, label: string, selected: string): string =>
    `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;

const listField = (name: string, label: string, values: string[]): string => `
<label>
    <span class="name">${esc(label)}</span>
    <input name="${esc(name)}" value="${esc(values.join(', '))}" placeholder="comma separated">
</label>`;

// ---------------------------------------------------------------- exercises

export interface ExerciseListView {
    items: ExerciseRow[];
    categories: string[];
    counts: { active: number; inactive: number };
    search: string;
    category: string;
    status: string;
    nextCursor: string | null;
    error: string | null;
}

const queryString = (params: Record<string, string>): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    const rendered = search.toString();
    return rendered ? `?${rendered}` : '';
};

export const exerciseListPage = (view: ExerciseListView): string => {
    const rows = view.items
        .map(
            (item) => `
<tr>
    <td>
        <div>${esc(item.name)}</div>
        <div class="mono">${esc(item.id)}</div>
    </td>
    <td>${esc(item.category)}</td>
    <td>${esc(parseList(item.primary_muscle_groups).join(', ')) || '<span class="mono">—</span>'}</td>
    <td>
        <span class="pill ${item.is_active ? 'on' : 'off'}">${item.is_active ? 'Active' : 'Inactive'}</span>
    </td>
    <td class="right">
        <div class="actions">
            <form method="post" action="/exercises/${encodeURIComponent(item.id)}/toggle" class="inline">
                <button class="ghost" type="submit">${item.is_active ? 'Deactivate' : 'Activate'}</button>
            </form>
            <a class="btn ghost" href="/exercises/${encodeURIComponent(item.id)}">Edit</a>
            <form method="post" action="/exercises/${encodeURIComponent(item.id)}/delete" class="inline"
                  onsubmit="return confirm('Delete this exercise and its translations? This cannot be undone.')">
                <button class="danger" type="submit">Delete</button>
            </form>
        </div>
    </td>
</tr>`,
        )
        .join('');

    const next = view.nextCursor
        ? `<p><a class="btn ghost" href="/exercises${queryString({
              search: view.search,
              category: view.category,
              status: view.status,
              cursor: view.nextCursor,
          })}">Next page</a></p>`
        : '';

    return `
<h1>Exercises</h1>
<p class="sub">The catalogue on Cloudflare D1, shared with the exercise-media Worker.</p>

<div class="stat">
    <div><div class="n">${view.counts.active}</div><div class="l">Active</div></div>
    <div><div class="n">${view.counts.inactive}</div><div class="l">Inactive</div></div>
</div>

<form class="toolbar" method="get" action="/exercises">
    <label style="flex:2 1 240px">
        <span class="name">Search</span>
        <input name="search" value="${esc(view.search)}" placeholder="Name contains…">
    </label>
    <label>
        <span class="name">Category</span>
        <select name="category">
            ${option('', 'All', view.category)}
            ${view.categories.map((c) => option(c, c, view.category)).join('')}
        </select>
    </label>
    <label>
        <span class="name">Status</span>
        <select name="status">
            ${option('all', 'All', view.status)}
            ${option('active', 'Active', view.status)}
            ${option('inactive', 'Inactive', view.status)}
        </select>
    </label>
    <button type="submit">Filter</button>
    <a class="btn ghost" href="/exercises/new">New exercise</a>
</form>

<div class="card">
    ${
        view.items.length
            ? `<table>
                <thead><tr>
                    <th>Name</th><th>Category</th><th>Primary muscles</th><th>Status</th><th class="right">Actions</th>
                </tr></thead>
                <tbody>${rows}</tbody>
               </table>`
            : '<div class="empty">No exercises match those filters.</div>'
    }
</div>
${next}`;
};

export const exerciseFormPage = (
    exercise: ExerciseRow | null,
    categories: string[],
    error: string | null,
): string => {
    const isNew = exercise === null;
    const action = isNew ? '/exercises/new' : `/exercises/${encodeURIComponent(exercise.id)}`;
    const known = new Set([...EXERCISE_CATEGORIES, ...categories]);

    return `
<h1>${isNew ? 'New exercise' : 'Edit exercise'}</h1>
<p class="sub">${
        isNew
            ? 'Media is left empty and filled in by the next <span class="mono">bun run seed</span>.'
            : `<span class="mono">${esc(exercise.id)}</span>`
    }</p>

${error ? `<div class="error">${esc(error)}</div>` : ''}

<form method="post" action="${action}">
    <div class="card">
        ${
            isNew
                ? `<label>
                        <span class="name">Id</span>
                        <input name="id" required placeholder="e.g. 1401-custom-press">
                   </label>`
                : ''
        }
        <label>
            <span class="name">Name</span>
            <input name="name" required value="${esc(exercise?.name ?? '')}">
        </label>
        <div class="row">
            <label>
                <span class="name">Category</span>
                <select name="category">
                    ${[...known].map((c) => option(c, c, exercise?.category ?? 'strength')).join('')}
                </select>
            </label>
            <label>
                <span class="name">Gif filename</span>
                <input name="gifFilename" required value="${esc(exercise?.gif_filename ?? '')}">
            </label>
        </div>
        ${listField('equipment', 'Equipment', parseList(exercise?.equipment))}
        ${listField('primaryMuscleGroups', 'Primary muscle groups', parseList(exercise?.primary_muscle_groups))}
        ${listField('secondaryMuscleGroups', 'Secondary muscle groups', parseList(exercise?.secondary_muscle_groups))}
        <label>
            <span class="name">Status</span>
            <select name="isActive">
                ${option('1', 'Active', exercise && !exercise.is_active ? '0' : '1')}
                ${option('0', 'Inactive', exercise && !exercise.is_active ? '0' : '1')}
            </select>
        </label>
    </div>
    <div class="actions" style="justify-content:flex-start">
        <button type="submit">${isNew ? 'Create' : 'Save'}</button>
        <a class="btn ghost" href="/exercises">Cancel</a>
    </div>
</form>`;
};

// --------------------------------------------------------------------- diet

export interface DietView {
    profiles: Profile[];
    accountId: string;
    meals: MealWithItems[];
    error: string | null;
}

const mealCard = (meal: MealWithItems, accountId: string): string => {
    const items = [...(meal.meal_items ?? [])].sort((a, b) => a.position - b.position);
    const totals = macroTotals(items);

    const rows = items
        .map(
            (item) => `
<tr>
    <td>${esc(item.name)}</td>
    <td>${esc(item.quantity ?? '—')}</td>
    <td class="right">${item.calories ?? '—'}</td>
    <td class="right">${item.protein_g ?? '—'}</td>
    <td class="right">${item.carbs_g ?? '—'}</td>
    <td class="right">${item.fat_g ?? '—'}</td>
    <td class="right">
        <form method="post" action="/diet/items/${encodeURIComponent(item.id)}/delete" class="inline">
            <input type="hidden" name="accountId" value="${esc(accountId)}">
            <button class="danger" type="submit">Remove</button>
        </form>
    </td>
</tr>`,
        )
        .join('');

    return `
<div class="card">
    <div class="actions" style="justify-content:space-between">
        <div>
            <strong>${esc(meal.date)} · ${esc(meal.slot)}</strong>
            ${meal.plan_id ? `<span class="mono"> plan ${esc(meal.plan_id)}</span>` : ''}
            ${meal.notes ? `<div class="mono">${esc(meal.notes)}</div>` : ''}
        </div>
        <form method="post" action="/diet/meals/${encodeURIComponent(meal.id)}/delete" class="inline"
              onsubmit="return confirm('Delete this meal and all its items?')">
            <input type="hidden" name="accountId" value="${esc(accountId)}">
            <button class="danger" type="submit">Delete meal</button>
        </form>
    </div>

    ${
        items.length
            ? `<table>
                <thead><tr>
                    <th>Item</th><th>Quantity</th>
                    <th class="right">kcal</th><th class="right">P</th>
                    <th class="right">C</th><th class="right">F</th><th></th>
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr>
                    <th>Total</th><th></th>
                    <th class="right">${Math.round(totals.calories)}</th>
                    <th class="right">${Math.round(totals.proteinG)}</th>
                    <th class="right">${Math.round(totals.carbsG)}</th>
                    <th class="right">${Math.round(totals.fatG)}</th><th></th>
                </tr></tfoot>
               </table>`
            : '<div class="empty">No items yet.</div>'
    }

    <form method="post" action="/diet/meals/${encodeURIComponent(meal.id)}/items" style="margin-top:16px">
        <input type="hidden" name="accountId" value="${esc(accountId)}">
        <div class="row">
            <label style="flex:2 1 200px"><span class="name">Item</span><input name="name" required></label>
            <label><span class="name">Quantity</span><input name="quantity" placeholder="150 g"></label>
            <label><span class="name">kcal</span><input name="calories" type="number" step="1"></label>
            <label><span class="name">Protein g</span><input name="proteinG" type="number" step="0.1"></label>
            <label><span class="name">Carbs g</span><input name="carbsG" type="number" step="0.1"></label>
            <label><span class="name">Fat g</span><input name="fatG" type="number" step="0.1"></label>
        </div>
        <button type="submit">Add item</button>
    </form>
</div>`;
};

export const dietPage = (view: DietView): string => {
    const accountPicker = `
<form class="toolbar" method="get" action="/diet">
    <label style="flex:2 1 320px">
        <span class="name">Account</span>
        <select name="accountId" onchange="this.form.submit()">
            ${option('', 'Choose an account…', view.accountId)}
            ${view.profiles
                .map((profile) =>
                    option(
                        profile.account_id,
                        `${profile.display_name ?? 'Unnamed'} · ${profile.local_user_id}`,
                        view.accountId,
                    ),
                )
                .join('')}
        </select>
    </label>
    <button type="submit">Load</button>
</form>`;

    if (!view.accountId) {
        return `
<h1>Diet plans</h1>
<p class="sub">Meals and items on Supabase, mirroring the app's local nutrition tables.</p>
${view.error ? `<div class="error">${esc(view.error)}</div>` : ''}
${accountPicker}
<div class="card"><div class="empty">Pick an account to see and author its plan.</div></div>`;
    }

    const profile = view.profiles.find((item) => item.account_id === view.accountId);

    return `
<h1>Diet plans</h1>
<p class="sub">Meals and items on Supabase, mirroring the app's local nutrition tables.</p>
${view.error ? `<div class="error">${esc(view.error)}</div>` : ''}
${accountPicker}

<div class="card">
    <h2 style="margin-top:0">Add a meal</h2>
    <form method="post" action="/diet/meals">
        <input type="hidden" name="accountId" value="${esc(view.accountId)}">
        <input type="hidden" name="userId" value="${esc(profile?.local_user_id ?? '')}">
        <div class="row">
            <label><span class="name">Date</span><input name="date" type="date" required></label>
            <label>
                <span class="name">Slot</span>
                <select name="slot">${MEAL_SLOTS.map((slot) => option(slot, slot, 'breakfast')).join('')}</select>
            </label>
            <label><span class="name">Plan id</span><input name="planId" placeholder="optional"></label>
        </div>
        <label><span class="name">Notes</span><textarea name="notes"></textarea></label>
        <button type="submit">Add meal</button>
    </form>
</div>

<h2>${view.meals.length} meal${view.meals.length === 1 ? '' : 's'}</h2>
${
    view.meals.length
        ? view.meals.map((meal) => mealCard(meal, view.accountId)).join('')
        : '<div class="card"><div class="empty">No meals for this account yet.</div></div>'
}`;
};
