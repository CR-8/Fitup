/**
 * Vercel's serverless entrypoint for Strapi.
 *
 * Strapi is built to run as one long-lived Koa process; Vercel's model is
 * one cold-started function per request. This bridges the two by loading
 * Strapi once per function instance and reusing it across warm invocations,
 * handing every request straight to its own Koa callback — the same thing
 * `strapi start` does, just not owning the process.
 *
 * What this does NOT give you, by the nature of the platform: the admin
 * panel's live-reload/WebSocket features, cron jobs or long-running plugin
 * work that assumes the process stays up between requests, and a cold start
 * fast enough for a good admin-editing experience. Fine for a low-traffic
 * catalogue-editing dashboard; a real reason to move to a persistent host
 * (Railway, Render, a VM) if any of that starts to matter.
 */
// Strapi resolves package.json, dist/ and config/ from process.cwd(). On Vercel
// that is the deployment root, which is the repo root when the project's Root
// Directory isn't `cms` — so pin it to this app before @strapi/core loads.
process.chdir(require('path').join(__dirname, '..'));

const { createStrapi, compileStrapi } = require('@strapi/strapi');

let strapiPromise;

const getStrapi = async () => {
    if (!strapiPromise) {
        strapiPromise = (async () => {
            const appContext = await compileStrapi();
            const app = await createStrapi(appContext).load();
            app.server.mount();
            return app;
        })();
    }
    return strapiPromise;
};

module.exports = async (req, res) => {
    const app = await getStrapi();
    app.server.app.callback()(req, res);
};
