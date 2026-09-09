# Exercise catalogue attribution

Exercise data served by this project is derived from
[exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(© Hasan Emir Yıldırım), used under the MIT License. The data covers exercise
names, body parts, equipment, muscle groups, and instructions.

## Media is a separate licence

The animation GIFs and thumbnails that accompany that dataset are **not** MIT
licensed and are **not** vendored into this repository. They are:

> © Gym visual — https://gymvisual.com/

distributed at 180x180 under a written permission granted to the dataset author.
Per that dataset's NOTICE, cloning it grants no rights to the media.

**`bun run seed` uploads those GIFs to a Cloudinary account and serves them from
it. That is redistribution.** Before running it against anything public, obtain
your own rights from Gym visual
(https://gymvisual.com/content/3-terms-and-conditions-of-use).

Any use must keep the attribution "© Gym visual — https://gymvisual.com/"
visible. The app does this automatically wherever an animation is rendered, via
`EXERCISE_MEDIA_ATTRIBUTION` in `src/constants/fitup.ts`.

## Where the catalogue lives now

It used to be generated into `assets/exercises/` and shipped inside the app, and
after that it lived on Cloudflare D1 behind a Worker. It is now in Supabase,
alongside everything else the app persists off-device, and the app reads it
through the `catalogue_page` function:

```bash
# Apply supabase/migrations/0003_exercise_catalogue.sql in the SQL editor first,
# the same way 0001 and 0002 were applied.
bun run seed      # dataset -> Cloudinary -> Supabase
```

Only the catalogue rows moved. The animations are still on Cloudinary, which is
a different vendor from Cloudflare and is unaffected: `secure_url`,
`cloudinary_public_id` and `cloudinary_version` travelled across as ordinary
columns, and `EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL` still points where it did.

The 180x180 cap the licence imposes is preserved: the upload stores the source
unchanged, and `EXERCISE_GIF_THUMBNAIL_RESOLUTION` / `EXERCISE_GIF_PREVIEW_RESOLUTION`
both remain 180.
