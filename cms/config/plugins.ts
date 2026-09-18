/**
 * Media uploads go to Cloudinary, not local disk — Vercel's filesystem is
 * ephemeral, so anything written to `public/uploads` is gone on the next
 * cold start. Reuses the same `CLOUDINARY_URL` the app's own seeder already
 * authenticates with (`scripts/lib/cloudinary.ts`), rather than a second set
 * of `cloud_name` / `api_key` / `api_secret` vars for the same account.
 *
 * Not wired to `CLOUDINARY_FOLDER` (`fitup/exercises`) on purpose: that
 * folder is the seeder's, holding the 1,324 exercise GIFs the catalogue
 * already references by filename. Anything uploaded here is unrelated media
 * (a food photo, a one-off asset) and defaults to Cloudinary's root instead.
 */
const parseCloudinaryUrl = (raw: string | undefined) => {
    if (!raw) return null;

    try {
        const url = new URL(raw);
        if (url.protocol !== 'cloudinary:') return null;

        return {
            cloud_name: url.hostname,
            api_key: url.username,
            api_secret: url.password,
        };
    } catch {
        return null;
    }
};

export default ({ env }: { env: (key: string, fallback?: unknown) => any }) => {
    const cloudinary = parseCloudinaryUrl(env('CLOUDINARY_URL'));

    if (!cloudinary) {
        strapi.log.warn(
            'CLOUDINARY_URL is not set — falling back to local disk uploads, which does not ' +
                'survive a redeploy on Vercel. Fine for local dev; set it before deploying.',
        );
        return {};
    }

    return {
        upload: {
            config: {
                provider: 'cloudinary',
                providerOptions: cloudinary,
                actionOptions: { upload: {}, delete: {} },
            },
        },
    };
};
