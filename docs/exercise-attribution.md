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

It used to be generated into `assets/exercises/` and shipped inside the app.
It is now seeded to Cloudflare D1 and served by the Worker in
`workers/exercise-media/`:

```bash
bun run db:push   # create the tables
bun run seed      # dataset -> Cloudinary -> Cloudflare D1
```

The 180x180 cap the licence imposes is preserved: the upload stores the source
unchanged, and `EXERCISE_GIF_THUMBNAIL_RESOLUTION` / `EXERCISE_GIF_PREVIEW_RESOLUTION`
both remain 180.
