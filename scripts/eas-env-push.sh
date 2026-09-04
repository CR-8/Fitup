#!/usr/bin/env bash
#
# Uploads the build-time environment to EAS.
#
# `.env.local` is gitignored, so EAS never sees it. Without these the cloud
# build still succeeds and ships an app with no sign-in, an empty exercise
# library and no assistant — a silent failure, which is worse than a loud one.
#
# Values are read straight out of `.env.local` and passed to `eas env:create`,
# so nothing is retyped and no secret is echoed to the terminal.
#
# Usage:   ./scripts/eas-env-push.sh [environment]     (default: production)
# Requires: eas login

set -euo pipefail

cd "$(dirname "$0")/.."

ENVIRONMENT="${1:-production}"
ENV_FILE=".env.local"

[ -f "$ENV_FILE" ] || { echo "no $ENV_FILE here"; exit 1; }
command -v eas >/dev/null || { echo "eas not on PATH — see the build guide"; exit 1; }

# Every EXPO_PUBLIC_* the app reads at build time, plus the one flag that stops
# Sentry's Gradle task failing the build (the project has no Sentry org set).
push() {
    local name="$1" value="$2"

    if [ -z "$value" ]; then
        printf '  %-40s skipped (empty)\n' "$name"
        return
    fi

    # --force overwrites an existing variable, so re-running is safe.
    # </dev/null matters: without it `eas` swallows the rest of the .env.local
    # lines the loop below is still reading, and everything after the first
    # variable is silently skipped.
    if eas env:create \
        --scope project \
        --environment "$ENVIRONMENT" \
        --name "$name" \
        --value "$value" \
        --visibility plaintext \
        --non-interactive \
        --force </dev/null >/dev/null 2>&1; then
        printf '  %-40s ok\n' "$name"
    else
        printf '  %-40s FAILED\n' "$name"
    fi
}

echo "pushing to the '$ENVIRONMENT' environment"
echo

# Build-tooling credentials used by the seed and upload scripts. They are not
# needed to build the app and have no business leaving this machine.
EXCLUDE="CLOUDFLARE_API_TOKEN CLOUDFLARE_D1_DATABASE_ID CLOUDINARY_URL SENTRY_AUTH_TOKEN"

while IFS= read -r line; do
    # APP_* as well as EXPO_PUBLIC_*: the package id, name and version are read
    # from the environment by app.config.js, and the EAS CLI does not load
    # `.env.local` the way the Expo CLI does — without them the build refuses to
    # start, because `android.package` resolves to an empty string.
    case "$line" in
        EXPO_PUBLIC_*=*|APP_*=*) ;;
        *) continue ;;
    esac

    name="${line%%=*}"
    case " $EXCLUDE " in *" $name "*) continue ;; esac

    value="${line#*=}"
    # Strip surrounding quotes and any trailing carriage return.
    value="$(printf '%s' "$value" | tr -d '\r' | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")"

    push "$name" "$value"
done < "$ENV_FILE"

# Not in .env.local: Sentry has no organisation configured, but its Gradle
# integration attaches a source-map upload to every release build and fails
# without one. This is what stops that.
push "SENTRY_DISABLE_AUTO_UPLOAD" "true"

echo
echo "done — check with: eas env:list --environment $ENVIRONMENT"
