/**
 * Runs Syn's real workout-plan request against the AI settings in .env.local and
 * reports what comes back: the model OpenRouter picked, the time, and whether the
 * reply survives the app's own parser and validator.
 *
 *   bunx tsx scripts/probe-syn-plan.ts [runs]
 *
 * The exercise catalogue here is a small hand-written sample, not the user's.
 */
import { readFileSync } from 'node:fs';
import dayjs from 'dayjs';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^(EXPO_PUBLIC_AI_[A-Z_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
}

const main = async () => {
    const { buildPlanMessages } = await import('../src/ai/prompt');
    const { extractJsonObject, parseAssessment } = await import('../src/ai/validate');
    const { buildBrief } = await import('../src/screens/coach/build/plan');
    const { AI_CONFIG } = await import('../src/constants/ai');

    const catalogue: [string, string, string, string, string][] = [
        ['ex_squat', 'Barbell Back Squat', 'strength', 'quadriceps/glutes', 'barbell'],
        ['ex_bench', 'Barbell Bench Press', 'strength', 'chest/triceps', 'barbell'],
        ['ex_row', 'Bent-Over Barbell Row', 'strength', 'lats/upper back', 'barbell'],
        ['ex_ohp', 'Overhead Press', 'strength', 'shoulders/triceps', 'barbell'],
        ['ex_dl', 'Romanian Deadlift', 'strength', 'hamstrings/glutes', 'barbell'],
        ['ex_pullup', 'Pull-Up', 'strength', 'lats/biceps', 'pull-up bar'],
        ['ex_lunge', 'Dumbbell Walking Lunge', 'strength', 'quadriceps/glutes', 'dumbbell'],
        ['ex_plank', 'Plank', 'strength', 'abdominals', 'bodyweight'],
        ['ex_crunch', 'Bicycle Crunch', 'strength', 'abdominals', 'bodyweight'],
        ['ex_burpee', 'Burpee', 'cardio', 'full body', 'bodyweight'],
        ['ex_jump', 'Jumping Jacks', 'cardio', 'full body', 'bodyweight'],
        ['ex_bike', 'Stationary Bike', 'cardio', 'quadriceps', 'stationary bike'],
        ['ex_run', 'Treadmill Run', 'cardio', 'full body', 'treadmill'],
        ['ex_stretch', "World's Greatest Stretch", 'flexibility', 'hips', 'bodyweight'],
        ['ex_yoga', 'Downward Dog', 'yoga', 'hamstrings/shoulders', 'bodyweight'],
    ];

    const context = {
        profile: {
            goal: 'maintain',
            activityLevel: null,
            sessionsPerWeek: 3,
            sessionMinutes: 45,
            dietaryPattern: null,
            allergens: [],
            conditions: [],
            equipment: [],
            trainingEnvironment: 'gym',
            bodyWeightKg: 70,
            heightCm: 175,
            dailyCalorieTarget: null,
            notes: null,
            fitnessLevel: null,
        },
        candidates: catalogue.map(([id, name, category, muscles, equipment]) => ({
            id,
            name,
            category,
            primaryMuscleGroups: muscles.split('/'),
            equipment: equipment === 'bodyweight' ? [] : [equipment],
            tracking: category === 'cardio' ? ['time', 'distance'] : ['weight', 'reps'],
        })),
        history: [],
        guidance: [],
        locale: 'en',
        weightUnit: 'kg',
    } as never;

    const { intent, horizonDays } = buildBrief({
        start: dayjs(),
        weeks: 4,
        schedule: {
            0: [
                { activity: 'fullBody', minutes: 30 },
                { activity: 'core', minutes: 15 },
            ],
            2: [
                { activity: 'hiit', minutes: 20 },
                { activity: 'cycling', minutes: 25 },
            ],
            4: [
                { activity: 'upper', minutes: 30 },
                { activity: 'yoga', minutes: 15 },
            ],
        },
        goal: 'maintain',
        place: 'gym',
        conditions: [],
    });

    const runs = Number(process.argv[2] ?? 3);
    for (let run = 1; run <= runs; run++) {
        const started = Date.now();
        const body = {
            model: AI_CONFIG.model,
            ...(AI_CONFIG.models.length > 1 ? { models: AI_CONFIG.models } : {}),
            messages: buildPlanMessages(context, 'workout', intent, horizonDays, [], true),
            max_tokens: AI_CONFIG.maxTokens,
            temperature: 0.4,
            response_format: { type: 'json_object' },
        };
        try {
            const response = await fetch(`${AI_CONFIG.baseUrl}${AI_CONFIG.completionsPath}`, {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${process.env.EXPO_PUBLIC_AI_API_KEY}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(Math.max(AI_CONFIG.timeoutMs, 150_000)),
            });
            const json = (await response.json()) as any;
            const ms = Date.now() - started;
            if (!response.ok || json.error) {
                console.log(
                    `run ${run}: HTTP ${response.status} in ${ms}ms, error: ${JSON.stringify(json.error ?? json).slice(0, 300)}`,
                );
                continue;
            }
            const content = json.choices?.[0]?.message?.content ?? '';
            const outcome = parseAssessment(
                extractJsonObject(content),
                'workout',
                (context as any).candidates,
            );
            const detail =
                outcome.status === 'ready'
                    ? `${outcome.payload.workouts.length} workouts at dayOffsets ${outcome.payload.workouts.map((w: any) => w.dayOffset).join(',')}, ${outcome.repairs.length} repairs`
                    : JSON.stringify(outcome).slice(0, 200);
            console.log(
                `run ${run}: OK ${json.model} in ${ms}ms, finish ${json.choices?.[0]?.finish_reason}, ${outcome.status}: ${detail}`,
            );
        } catch (error: any) {
            console.log(
                `run ${run}: FAILED after ${Date.now() - started}ms: ${error?.code ?? ''} ${error?.message ?? error}`,
            );
        }
    }
};

main();
