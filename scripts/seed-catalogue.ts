import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
    LOCALES,
    fetchDataset,
    toCatalogueEntry,
    transliterateName,
    validateEntries,
    type CatalogueEntry,
    type DatasetRecord,
    type Locale,
} from './lib/dataset';
import hindiNameTokens from './data/exercise-name-tokens.hi.json';
import {
    configureCloudinary,
    deliveryBaseUrl,
    describeUploadError,
    uploadExerciseGif,
    type UploadedAsset,
} from './lib/cloudinary';
import { loadEnvFiles } from './lib/env';
import { createRateLimiter, runPool } from './lib/limiter';
import {
    connect,
    countExercises,
    upsertExercises,
    upsertInstructions,
    type InstructionsByLocale,
    type LocaleText,
    type SeededExercise,
} from './lib/db';

/**
 * Seeds the exercise catalogue: dataset -> Cloudinary -> Supabase.
 *
 *   bun run seed -- --dry-run      plan only; uploads nothing, writes nothing
 *   bun run seed -- --limit 20     first 20 records, to sanity-check
 *   bun run seed                   full run, ~22 minutes
 *   bun run seed -- --skip-media   rows only; GIFs are already uploaded
 *   bun run seed -- --media-only   GIFs only; leave the database alone
 *
 * The order matters and is not negotiable: every record is validated before a
 * single upload starts. A dataset that fails validation half way through would
 * otherwise leave the catalogue partially applied, and the app has no way to
 * tell a partial catalogue from a complete one.
 *
 * Media licensing is the operator's responsibility. The animations are
 * © Gym visual; see docs/exercise-attribution.md before running this.
 */

/** One upload per second. The upstream allowance is 60/minute. */
const UPLOAD_INTERVAL_MS = 1_000;

/**
 * In-flight uploads. Above one only so a slow response does not leave the
 * limiter's next token unused — this does not raise the rate.
 */
const UPLOAD_CONCURRENCY = 4;

const LEDGER_PATH = '.cache/catalogue-seed.json';

interface Ledger {
    /** gifFilename -> the asset Cloudinary returned. */
    uploaded: Record<string, UploadedAsset>;
}

interface Options {
    dryRun: boolean;
    limit: number | null;
    skipMedia: boolean;
    mediaOnly: boolean;
}

const parseOptions = (argv: string[]): Options => {
    const limitIndex = argv.indexOf('--limit');
    const rawLimit = limitIndex === -1 ? null : argv[limitIndex + 1];
    const limit = rawLimit === undefined || rawLimit === null ? null : Number(rawLimit);

    if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
        throw new Error(`--limit expects a positive integer, got "${rawLimit}"`);
    }

    return {
        dryRun: argv.includes('--dry-run'),
        limit,
        skipMedia: argv.includes('--skip-media'),
        mediaOnly: argv.includes('--media-only'),
    };
};

/**
 * How many uploads may accumulate before the ledger is written back.
 *
 * The ledger only earns its keep if it survives a crash. Writing it once at the
 * end means an interrupted run at #1200 resumes from zero — which is the exact
 * situation it exists to prevent. Writing after every upload would mean 1,324
 * rewrites of a growing file; 25 bounds the loss to well under a minute of work.
 */
const LEDGER_FLUSH_INTERVAL = 25;

const readLedger = async (): Promise<Ledger> => {
    try {
        return JSON.parse(await readFile(LEDGER_PATH, 'utf8')) as Ledger;
    } catch {
        // A missing or unreadable ledger just means nothing is known to be done.
        return { uploaded: {} };
    }
};

const writeLedger = async (ledger: Ledger): Promise<void> => {
    await mkdir(dirname(LEDGER_PATH), { recursive: true });
    await writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 0), 'utf8');
};

/**
 * The dataset ships one English name per exercise and instructions per locale,
 * so a Hindi name has to be composed rather than read. `transliterateName`
 * throws on a word the map does not cover, which fails the seed run instead of
 * writing `डंबल frobnicate` to the catalogue.
 */
const localeName = (locale: Locale, record: DatasetRecord): string | undefined =>
    locale === 'hi' ? transliterateName(record.name, hindiNameTokens) : undefined;

const collectInstructions = (
    records: DatasetRecord[],
    entries: CatalogueEntry[],
): InstructionsByLocale => {
    const byLocale: InstructionsByLocale = new Map();

    for (const locale of LOCALES) {
        const perExercise = new Map<string, LocaleText>();

        for (const [index, record] of records.entries()) {
            // English is the fallback `catalogue_page` relies on, so a locale
            // missing steps contributes an empty list rather than pretending to
            // have translated them.
            const steps = record.instruction_steps[locale as Locale] ?? [];
            const name = localeName(locale, record);

            if (steps.length > 0 || name) {
                perExercise.set(entries[index].id, { steps, name });
            }
        }

        byLocale.set(locale, perExercise);
    }

    return byLocale;
};

const plural = (count: number, noun: string, pluralForm?: string): string =>
    `${count} ${count === 1 ? noun : (pluralForm ?? `${noun}s`)}`;

const seed = async () => {
    loadEnvFiles();

    const options = parseOptions(process.argv.slice(2));

    if (options.skipMedia && options.mediaOnly) {
        throw new Error('--skip-media and --media-only cannot be combined.');
    }

    // 1. Fetch --------------------------------------------------------------
    console.log('Fetching exercises-dataset…');
    const allRecords = await fetchDataset();
    const records = options.limit ? allRecords.slice(0, options.limit) : allRecords;
    console.log(`  ${plural(allRecords.length, 'record')}${
        options.limit ? `, taking the first ${options.limit}` : ''
    }`);

    // 2. Validate everything before anything is written ---------------------
    const entries = records.map(toCatalogueEntry);
    const problems = validateEntries(entries);

    // A full run that comes back short means a truncated or half-published
    // dataset, which must not be allowed to overwrite a good catalogue. A run
    // the operator deliberately limited is a different thing entirely.
    if (!options.limit && entries.length < 1000) {
        problems.push(`Expected at least 1000 entries, got ${entries.length}`);
    }

    if (problems.length > 0) {
        console.error(`\nDataset failed validation with ${plural(problems.length, 'problem')}:`);
        for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
        if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
        throw new Error('Refusing to seed from a dataset that failed validation.');
    }

    console.log(`  ${plural(entries.length, 'entry', 'entries')} validated`);

    if (options.dryRun) {
        const cloudName = configureCloudinary();
        console.log('\n--dry-run: nothing will be uploaded or written.\n');
        console.log(`Would upload ${plural(entries.length, 'GIF')} to ${cloudName}`);
        console.log(`Would write  ${plural(entries.length, 'row')} to exercise`);
        console.log(`Delivery prefix: ${deliveryBaseUrl(cloudName)}`);
        console.log('\nFirst 3:');
        for (const entry of entries.slice(0, 3)) {
            console.log(`  ${entry.id}  ${entry.gifFilename}  ${entry.name}`);
        }
        return;
    }

    // 3. Upload -------------------------------------------------------------
    const ledger = await readLedger();
    const assets = new Map<string, UploadedAsset>();
    const failures: { gifFilename: string; reason: string }[] = [];
    let uploaded = 0;
    let skipped = 0;

    if (!options.skipMedia) {
        const cloudName = configureCloudinary();
        console.log(`\nUploading to Cloudinary (${cloudName}) at 1/sec…`);

        const takeToken = createRateLimiter(UPLOAD_INTERVAL_MS);
        let lastFlushedAt = 0;
        let flushing = false;

        await runPool(records, UPLOAD_CONCURRENCY, async (record, index) => {
            const entry = entries[index];
            const known = ledger.uploaded[entry.gifFilename];

            if (known) {
                assets.set(entry.gifFilename, known);
                skipped++;
                return;
            }

            await takeToken();

            try {
                const asset = await uploadExerciseGif(record, entry.gifFilename, (_e, attempt) => {
                    console.warn(`  retry ${attempt}: ${entry.gifFilename}`);
                });

                assets.set(entry.gifFilename, asset);
                ledger.uploaded[entry.gifFilename] = asset;
                uploaded++;

                const done = uploaded + skipped;
                if (done % 50 === 0) console.log(`  ${done}/${records.length}`);

                // Checkpoint. `flushing` keeps concurrent workers from racing
                // each other into the same file; a skipped flush is picked up
                // by the next one, and the final write below catches the rest.
                if (uploaded - lastFlushedAt >= LEDGER_FLUSH_INTERVAL && !flushing) {
                    flushing = true;
                    lastFlushedAt = uploaded;

                    try {
                        await writeLedger(ledger);
                    } finally {
                        flushing = false;
                    }
                }
            } catch (error) {
                failures.push({
                    gifFilename: entry.gifFilename,
                    reason: describeUploadError(error),
                });
            }
        });

        await writeLedger(ledger);
        console.log(`  uploaded ${uploaded}, skipped ${skipped}, failed ${failures.length}`);
    } else {
        for (const entry of entries) {
            const known = ledger.uploaded[entry.gifFilename];
            if (known) assets.set(entry.gifFilename, known);
        }
        console.log(`\n--skip-media: reusing ${plural(assets.size, 'ledger entry', 'ledger entries')}`);
    }

    // 4 & 5. Write ----------------------------------------------------------
    if (!options.mediaOnly) {
        const rows: SeededExercise[] = [];
        const missing: string[] = [];

        for (const entry of entries) {
            const asset = assets.get(entry.gifFilename);
            // A row without an asset would carry an empty secure_url, and the
            // app has no way to distinguish that from a broken upload later.
            if (asset) rows.push({ entry, asset });
            else missing.push(entry.gifFilename);
        }

        if (missing.length > 0) {
            console.warn(`\n${plural(missing.length, 'entry', 'entries')} skipped — no uploaded asset:`);
            for (const name of missing.slice(0, 10)) console.warn(`  ${name}`);
            if (missing.length > 10) console.warn(`  … and ${missing.length - 10} more`);
        }

        console.log(`\nWriting ${plural(rows.length, 'row')} to Supabase…`);
        // No connection to open or close: PostgREST is HTTP, so each upsert is
        // an independent request.
        const client = await connect();

        const written = await upsertExercises(client, rows);
        console.log(`  catalogue_exercises: ${written}`);

        const instructionCount = await upsertInstructions(
            client,
            collectInstructions(records, entries),
        );
        console.log(`  catalogue_instructions: ${instructionCount}`);

        console.log(`\ncatalogue_exercises now holds ${await countExercises(client)} rows.`);
    }

    // 6. Report -------------------------------------------------------------
    if (failures.length > 0) {
        console.error(`\n${plural(failures.length, 'upload')} failed:`);
        for (const failure of failures) {
            console.error(`  ${failure.gifFilename}: ${failure.reason}`);
        }
        console.error('\nRe-run to retry them; everything already uploaded will be skipped.');
        process.exitCode = 1;
        return;
    }

    console.log('\nDone.');

    if (!options.skipMedia) {
        console.log(
            `\nSet in .env.local:\n  EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL=${deliveryBaseUrl(
                configureCloudinary(),
            )}`,
        );
    }
};

seed().catch((error) => {
    console.error('\nSeed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
