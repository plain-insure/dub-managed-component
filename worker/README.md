# Worker adapter

This directory adapts our plain Managed Component (`../dist/index.js`, built
from `../src/index.ts`) into an actual Cloudflare Worker that speaks the same
protocol Zaraz uses to talk to Custom Managed Components (`POST /init` and
`POST /event`, plus a `/route` passthrough).

Everything except `index.ts` (`client.ts`, `context.ts`, `handler.ts`,
`manager.ts`, `models.ts`, `storage.ts`, `useCache.ts`, `utils.ts`) is vendored,
with only import-path changes, from
[`managed-component-to-cloudflare-worker`](https://www.npmjs.com/package/managed-component-to-cloudflare-worker)
(MIT, © Cloudflare — see [LICENSE](./LICENSE)), which is normally applied via
its interactive CLI at deploy time rather than committed to the target repo.
Vendoring it here means `npx wrangler deploy` (or `pnpm run deploy`) works
directly, non-interactively, without depending on that CLI being installed.

`handler.ts` deliberately replaces the global `fetch` with one that always
errors, to force outbound requests through `manager.fetch` instead — see the
comment on `createManagerFetcher` in `../src/index.ts` for why our own code
is written to respect that.

If you need to bump this to a newer upstream release, diff against a fresh
`npm pack managed-component-to-cloudflare-worker@latest` and reapply just the
import-path changes in `index.ts`.
