import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

import { datasetGifUrl, type DatasetRecord } from './dataset';
import { withRetry } from './limiter';

/**
 * Cloudinary uploads for the exercise animations.
 *
 * The official SDK is used rather than a hand-rolled signature: getting the
 * signed-parameter set subtly wrong fails as a 401 on every request, which is a
 * miserable thing to debug against a remote service. It is a devDependency, so
 * none of it reaches the app binary.
 *
 * Media licensing is the caller's problem to have settled. See
 * `docs/exercise-attribution.md` — the animations are © Gym visual and the
 * dataset's NOTICE grants no redistribution rights by itself.
 */

/** Everything below this prefix belongs to the seeder and may be re-uploaded. */
export const CLOUDINARY_FOLDER = 'fitup/exercises';

export interface UploadedAsset {
    publicId: string;
    version: number;
    secureUrl: string;
    width: number;
    height: number;
    bytes: number;
}

export class CloudinaryNotConfiguredError extends Error {
    constructor() {
        super(
            'CLOUDINARY_URL is not set. Copy .env.example to .env.local and fill it in.\n' +
                'Format: cloudinary://<api_key>:<api_secret>@<cloud_name>',
        );
        this.name = 'CloudinaryNotConfiguredError';
    }
}

/**
 * Configures the SDK from CLOUDINARY_URL and returns the cloud name.
 *
 * The credentials are applied explicitly rather than left to the SDK's own
 * environment lookup, which happens when the module is first imported — before
 * .env.local has been read. Relying on it meant the SDK captured an empty
 * config and then reported the URL as missing while it sat in the file.
 *
 * Fails loudly when absent, because the alternative is 1,324 identical
 * authentication errors.
 */
export const configureCloudinary = (): string => {
    const raw = process.env.CLOUDINARY_URL?.trim();
    if (!raw) throw new CloudinaryNotConfiguredError();

    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new CloudinaryNotConfiguredError();
    }

    const cloudName = parsed.hostname;
    const apiKey = decodeURIComponent(parsed.username);
    const apiSecret = decodeURIComponent(parsed.password);

    if (parsed.protocol !== 'cloudinary:' || !cloudName || !apiKey || !apiSecret) {
        throw new CloudinaryNotConfiguredError();
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    return cloudName;
};

/** The delivery prefix EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL should be set to. */
export const deliveryBaseUrl = (cloudName: string): string =>
    `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${CLOUDINARY_FOLDER}`;

const statusOf = (error: unknown): number | undefined => {
    if (typeof error !== 'object' || error === null) return undefined;

    const candidate = (error as { http_code?: unknown; error?: { http_code?: unknown } }).http_code;
    const nested = (error as { error?: { http_code?: unknown } }).error?.http_code;
    const code = typeof candidate === 'number' ? candidate : nested;

    return typeof code === 'number' ? code : undefined;
};

/**
 * Statuses worth another attempt.
 *
 *   408, 499  timeouts. Cloudinary fetches the source URL itself, so a slow
 *             upstream shows up here rather than as a network error on our side.
 *             499 is Cloudinary's own "Request Timeout" — observed once in a
 *             1,324-asset run, and it succeeded immediately on retry.
 *   429       rate limited.
 *   5xx       the service is unwell.
 *
 * Any other 4xx — a bad signature, a missing source, a rejected format — will
 * fail identically on every retry, so it is recorded and the run moves on
 * rather than spending three backoffs per asset to learn nothing.
 */
const RETRYABLE_STATUSES = new Set([408, 429, 499]);

const isRetryableUploadError = (error: unknown): boolean => {
    const status = statusOf(error);
    if (status === undefined) return true; // network-level failure
    return RETRYABLE_STATUSES.has(status) || status >= 500;
};

const toAsset = (response: UploadApiResponse): UploadedAsset => ({
    publicId: response.public_id,
    version: response.version,
    secureUrl: response.secure_url,
    width: response.width,
    height: response.height,
    bytes: response.bytes,
});

/**
 * Uploads one animation, addressed by its upstream URL.
 *
 * Cloudinary fetches the source itself, so nothing is downloaded here — the
 * 1,324 GIFs never touch this machine's disk or bandwidth.
 *
 * `overwrite: false` makes a re-run idempotent on the server as well as in the
 * local ledger: an asset that already exists is returned rather than replaced,
 * so its version and URL stay stable and no CDN cache is invalidated.
 */
export const uploadExerciseGif = async (
    record: DatasetRecord,
    gifFilename: string,
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void,
): Promise<UploadedAsset> => {
    const response = await withRetry(
        () =>
            cloudinary.uploader.upload(datasetGifUrl(record), {
                public_id: `${CLOUDINARY_FOLDER}/${gifFilename}`,
                // An animated GIF is an image as far as Cloudinary is concerned;
                // 'video' would transcode it and drop the animation.
                resource_type: 'image',
                overwrite: false,
                unique_filename: false,
                use_filename: false,
            }),
        {
            attempts: 3,
            baseDelayMs: 1_000,
            isRetryable: isRetryableUploadError,
            onRetry,
        },
    );

    return toAsset(response);
};

export const describeUploadError = (error: unknown): string => {
    if (typeof error === 'object' && error !== null) {
        const message = (error as { message?: unknown }).message;
        const nested = (error as { error?: { message?: unknown } }).error?.message;
        const status = statusOf(error);
        const text = typeof message === 'string' ? message : String(nested ?? error);

        return status ? `${status} ${text}` : text;
    }

    return String(error);
};
