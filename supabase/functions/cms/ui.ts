/**
 * The dashboard's HTML.
 *
 * Server-rendered strings with plain forms: no client framework, no bundler, no
 * build step — `supabase functions deploy cms` ships it and that is the whole
 * pipeline. Every mutation is a normal POST followed by a redirect, so the back
 * button and a double-submit both behave the way the browser already knows how
 * to make them behave.
 *
 * The palette is the app's: coral `#ff453a` on the neutral ramp from
 * `unistyles.ts`, so the CMS reads as part of the same product.
 */

/**
 * Where this function is mounted — which is two different strings, and
 * conflating them is a 404 on every route.
 *
 * Supabase publishes a function at `/functions/v1/<name>`, but strips
 * `/functions/v1` before the request reaches it. So the path Hono routes
 * against starts at the function's own name, while the path a browser has to
 * follow is the full public one.
 *
 * As a Cloudflare Worker this had a domain to itself and the two were the same,
 * which is why `withBase` below exists rather than every `href` in `views.ts`
 * being rewritten by hand.
 */

/** What the router matches: the function name, with `/functions/v1` gone. */
export const ROUTE_BASE = '/cms';

/** What the browser follows: links, form actions, and redirect targets. */
export const LINK_BASE = '/functions/v1/cms';

/**
 * Prefixes the app's own links, and only those.
 *
 * The match requires exactly one slash after the quote, so `href="/exercises"`
 * is rewritten and `href="https://…"` and `href="//cdn…"` are both left alone.
 * Applied once, to the finished page, so a link added to `views.ts` later is
 * covered without anyone having to remember this exists.
 */
const withBase = (markup: string): string =>
    markup.replace(/(href|action)="\/(?!\/)/g, `$1="${LINK_BASE}/`);

/**
 * Escapes text for HTML.
 *
 * Every interpolation below goes through this. Exercise names and meal notes are
 * operator-supplied and end up in a page an operator loads, so unescaped output
 * would be stored XSS against the dashboard itself.
 */
export const esc = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const STYLES = `
:root {
    --bg: #0b0b0c; --surface: #1e1e22; --raised: #292930; --border: #2c2c33;
    --text: #f4f4f6; --muted: #8e8ea0; --coral: #ff453a; --coral-dim: #c02a21;
    --ok: #35c47f; --radius: 16px;
    color-scheme: dark;
}
* { box-sizing: border-box; }
body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
a { color: var(--coral); text-decoration: none; }
a:hover { text-decoration: underline; }
header {
    display: flex; align-items: center; gap: 24px;
    padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--surface);
    position: sticky; top: 0; z-index: 10;
}
header .brand { font-weight: 700; letter-spacing: -0.02em; font-size: 17px; }
header .brand span { color: var(--coral); }
nav { display: flex; gap: 4px; }
nav a {
    padding: 6px 14px; border-radius: 999px; color: var(--muted); font-weight: 500;
}
nav a.on { background: var(--coral); color: #fff; }
nav a:hover { text-decoration: none; color: var(--text); }
main { max-width: 1100px; margin: 0 auto; padding: 28px 24px 96px; }
h1 { font-size: 24px; letter-spacing: -0.02em; margin: 0 0 4px; }
h2 { font-size: 17px; letter-spacing: -0.01em; margin: 32px 0 12px; }
.sub { color: var(--muted); margin: 0 0 24px; }
.card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; margin-bottom: 20px;
}
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
tr:last-child td { border-bottom: none; }
td.right, th.right { text-align: right; }
.pill {
    display: inline-block; padding: 2px 10px; border-radius: 999px;
    font-size: 12px; font-weight: 600;
}
.pill.on { background: rgba(53,196,127,0.16); color: var(--ok); }
.pill.off { background: rgba(142,142,160,0.16); color: var(--muted); }
input, select, textarea {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    border: 1px solid var(--border); background: var(--raised); color: var(--text);
    font: inherit;
}
textarea { min-height: 72px; resize: vertical; }
label { display: block; margin-bottom: 14px; }
label .name {
    display: block; margin-bottom: 6px; color: var(--muted);
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;
}
.row { display: flex; gap: 14px; flex-wrap: wrap; }
.row > * { flex: 1 1 180px; }
button, .btn {
    padding: 10px 18px; border-radius: 999px; border: 0; cursor: pointer;
    font: inherit; font-weight: 600; background: var(--coral); color: #fff;
    display: inline-block;
}
button:hover, .btn:hover { background: var(--coral-dim); text-decoration: none; }
button.ghost, .btn.ghost { background: var(--raised); color: var(--text); }
button.ghost:hover, .btn.ghost:hover { background: var(--border); }
button.danger { background: transparent; color: var(--coral); padding: 6px 10px; }
button.danger:hover { background: rgba(255,69,58,0.12); }
.inline { display: inline; }
.actions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
.toolbar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 20px; }
.toolbar label { margin-bottom: 0; }
.stat { display: flex; gap: 28px; margin-bottom: 24px; }
.stat div .n { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.stat div .l { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
.empty { color: var(--muted); text-align: center; padding: 40px 0; }
.error {
    background: rgba(255,69,58,0.12); border: 1px solid var(--coral);
    color: #ffcdc7; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px;
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: var(--muted); }
`;

export type Tab = 'exercises' | 'diet';

export const layout = (title: string, tab: Tab, body: string): string =>
    withBase(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · FitSync CMS</title>
<style>${STYLES}</style>
</head>
<body>
<header>
    <div class="brand">Fit<span>Sync</span> CMS</div>
    <nav>
        <a href="/exercises" class="${tab === 'exercises' ? 'on' : ''}">Exercises</a>
        <a href="/diet" class="${tab === 'diet' ? 'on' : ''}">Diet plans</a>
    </nav>
</header>
<main>${body}</main>
</body>
</html>`);

export const errorBanner = (message: string | null): string =>
    message ? `<div class="error">${esc(message)}</div>` : '';

export const html = (body: string, status = 200): Response =>
    new Response(body, {
        status,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            // The dashboard reads and writes production data; nothing about it
            // should sit in a shared cache or a browser's back-forward store.
            'cache-control': 'no-store',
            'referrer-policy': 'same-origin',
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
        },
    });
