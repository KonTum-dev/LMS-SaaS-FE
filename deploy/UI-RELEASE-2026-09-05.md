# UI release — 2026-09-05

> Historical UI review release. The subsequent 30-day-trial release is now
> active; see [current release](CURRENT-RELEASE.md). The paths and checks below
> describe the UI review deployment and its preserved rollback history.

Live URL: https://lms.dolphinxstudio.com

At that deployment, the production frontend was the standalone build in
`/root/lms-fe-ui-release.iSG4qg`, not the retained original checkout.
Build ID: `agFgOITAlCN-pknvlPa57`.

PM2 process name: `LMS-SaaS-FE` (id 2 at deployment), Node entrypoint:
`/root/lms-fe-ui-release.iSG4qg/.next/standalone/server.js`.
Port 3000, hostname 127.0.0.1. PM2 state has been saved.

The original `/root/LMS-SaaS-FE` source/build/public files are untouched and
available for rollback. The backend process and Nginx configuration were not
changed. The new release includes its source, Linux dependencies, build,
production environment file, standalone public assets and static chunks.
Previous static chunks are retained for clients with older cached HTML.

## Verification

- Local final gate: 128 suites / 1,400 tests passed; TypeScript and ESLint clean.
- Linux standalone production build passed.
- Five compiled workspace UI smoke surfaces passed using intercepted local
  fixtures: no real production API requests or mutations.
- Fourteen direct live public-page checks passed, in Vietnamese/mobile and
  English/desktop, including price cycle and article search/reset.
- Home and backend health returned 200. Environment/config/log paths return
  404 over HTTPS. Public bundle scan found no SePay secrets or local fixture
  configuration.
- Full review and curated evidence are in the shared task workspace:
  `/Users/nhatanh/Documents/ChatGPT/LMS Product/ui-review-2026-09-05/REVIEW.md`.

## PM2 caution and rollback

An initial `startOrReload` kept the old npm executable/cwd while replacing its
arguments. This caused a brief 502 and was immediately rolled back. Recreating
only the named frontend process with the explicit standalone entrypoint fixed
the issue. Do not assume that reloading an ecosystem file changes executable
or cwd on this PM2 installation.

To roll back, first verify the retained original standalone build exists.
Then recreate ONLY `LMS-SaaS-FE` with
`/root/lms-fe-ui-release.iSG4qg/rollback.config.cjs`, check HTTP 200 and the
intended cwd/entrypoint, and save PM2 state. Never restart/delete the backend or
use a blanket PM2 delete command. Backup process state is
`/root/lms-fe-ui-release.iSG4qg/pm2-before.dump.json` (mode 600).

Future frontend builds should be staged from current source into a fresh
release with production public environment values. Do not build the retained
old checkout and assume that the active release will update automatically.

## Maintenance cleanup on 2026-09-05

Active frontend/backend paths and process IDs were not changed by cleanup.
The full frontend rollback at `/root/LMS-SaaS-FE` remains available. Older
intermediate builds were removed only after their source/configuration was
archived and checked. Their compiled output is not retained in source-only
archives. See `/root/README-LMS.md` and
`/root/lms-ops-backups/cleanup-2026-09-05/manifest.json` for retained paths,
archive checksums and the recovery limitations. Documentation is now indexed
at `docs/README.md`; legacy systemd instructions are marked separately.
