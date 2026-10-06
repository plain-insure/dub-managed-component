# Dub Managed Component

> A managed component for Dub.co link tracking and ecommerce events

![Dub.co](https://dub.co/logo.png)

Common use is currently for [Cloudflare Zaraz](https://www.cloudflare.com/application-services/products/zaraz/).

## Features

- 🔗 **Link Click Tracking**: Records clicks server-side and sets the `dub_id` cookie itself — no client-side Dub script required
- 📊 **Lead Tracking**: Track signups, form submissions, and other conversion events
- 💰 **Ecommerce Tracking**: Track sales, purchases, and revenue events
- 🎯 **Customer Attribution**: Associate events with customers for accurate attribution
- 🔐 **Secure**: Uses server-side tracking with API keys
- ⚡ **Fast**: Minimal overhead with the official Dub TypeScript SDK

## How to use

### Zaraz / Cloudflare Worker

Until this component is an "official" Managed Component, we need to manually host the MC in a Cloudflare Worker. [worker/](worker/) adapts the built component (`dist/index.js`) into a real Worker that speaks Zaraz's Custom Managed Component protocol, and [wrangler.toml](wrangler.toml) is already configured to deploy it — no interactive setup needed.

1. Clone this repository
2. Install dependencies with `pnpm install`
3. Authenticate wrangler once: `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for non-interactive/CI use)
4. Build and deploy:
   ```bash
   pnpm run deploy
   ```
   This lints, typechecks, tests and bundles the component, then runs `wrangler deploy`. (Plain `npx wrangler deploy` also works once `pnpm run build` has produced `dist/index.js`.)
5. Login to the Cloudflare dashboard and go to the [Zaraz Dashboard](https://dash.cloudflare.com/?to=/:account/:zone/zaraz/tools-config/tools/catalog)
6. Choose **Custom Managed Component**
7. Select `custom-mc-zaraz-dub` from the list
8. Grant **Server network requests** permission (required for API calls, including click tracking)
9. Grant **Access client key-value store** permission (required to read/set the `dub_id` cookie)
10. Under **Settings**, choose **Add custom setting** and add the following values:
  - `DUB_API_KEY`: a Dub API key from the workspace that should receive lead and sale events.
  - `DUB_SHORT_DOMAIN`: the Dub short-link domain from that same workspace, such as `go.example.com` (without `https://`).
  - `DUB_DEBUG`: set to `true` temporarily to show Dub tracking decisions in Worker logs.
  - `DUB_DEBUG_SHOW_CLICK_ID`: set to `true` with `DUB_DEBUG` only for a temporary cross-subdomain click-ID handoff test.

11. Configure a pageview action with **Action Type** `pageview` and the **Pageview** firing trigger.
12. Configure the conversion action with **Action Type** `event` and the **All Tracks** firing trigger. In the API configuration, this is `tools.<toolId>.actions.AllTracks.actionType = "event"`, not `"custom-mc-event"`. The latter can fire in Zaraz's debugger without dispatching to this Worker's registered listener.
13. Publish the configuration when Zaraz uses the preview workflow.

Grant **Execute unsafe scripts** for browser-console diagnostics and conversion confirmations. When a caller supplies `plainDubConversionId`, the deployed component returns a `plain:dub-conversion-confirmed` browser event with the matching ID and a `sent` boolean. A successful Zaraz HTTP response alone does not confirm delivery to Dub.

Custom Managed Components expose only custom name/value settings. Cloudflare does not read this repository's [manifest.json](manifest.json) from the deployed Worker, so its predefined field definitions are not shown in the Zaraz dashboard. Predefined settings require publishing the component to Cloudflare's Managed Components catalog.

## Configuration

### Tool Settings

#### Dub API Key `string` (required)

Your Dub API key. Lead and sale events are sent to the workspace associated with this key. Create the key in the same workspace that owns your configured short domain so conversion events can be attributed to its clicks. You can find it in your [Dub workspace settings](https://dub.co/settings).

For the least-privilege key shown in Dub's API key creation screen, select:

- **Type:** `Machine`
- **Permissions:** `Restricted`
- **Links, Tags, Folders, Domains, and Analytics:** `None`

The component only calls Dub's lead and sale tracking APIs. It does not create, update, or read links, tags, folders, domains, or analytics, so no resource-level permission is required. A `You` key also works, but a `Machine` key is preferred for this server-side integration.

#### Dub API Host `string` (optional)

Override the host used for the click-tracking API call. Defaults to `https://api.dub.co`.

#### Dub Short Domain `string` (optional)

Your Dub short link domain. Clicks are recorded in the workspace that owns this domain. Only needed to record clicks for visits that land directly on your site with a short link key in the URL (e.g. `yoursite.com/?via=abc123`) instead of via an actual short-domain redirect — see [Click Tracking](#click-tracking) below.

When your Dub workspace has **Allowed hostnames** configured in its Tracking settings, add the hostname of the site using this component, such as `yoursite.com`. The component forwards the current page URL as the click request's `Referer` so Dub can validate it. Use `*.yoursite.com` as well when tracking from staging subdomains.

#### Dub Attribution Model `string` (optional)

`last-click` (default) or `first-click` — whether a later click on the same visitor can override an already-attributed one.

#### Dub Query Parameters `string` (optional)

Additional query parameters to check for a short link key, as a JSON array or comma-separated list (e.g. `via,ref`). `via` is always included by default.

#### Dub Debug Logging `true` (optional)

Set `DUB_DEBUG` to `true` while troubleshooting. Worker logs will show whether a pageview was skipped because the short domain or link key was missing, whether Zaraz accepted the click-ID storage write, and the endpoint path and HTTP status for conversion requests. Failed click requests report their HTTP status; a successful response without a click ID is reported separately. For each lead, sale, or ecommerce event, the logs report the page hostname and whether the click ID is available there. With the optional **Execute unsafe scripts** permission, the same click-tracking messages appear in the browser DevTools console. Logs never include the API key, click ID, customer data, or request body. Remove the setting or set it to `false` after diagnosis.

Client key-value storage uses the Components Manager's own first-party storage. The Managed Components API supports storage lifetime but does not provide a cookie-domain option, so cross-subdomain availability is controlled by Zaraz. To verify it, first load `https://p-staging.net/?via=<key>` and confirm `Click recorded and click ID stored`, then complete an ecommerce action on `app.p-staging.net`. The ecommerce debug message must report `click ID is available`; otherwise, the Zaraz client storage is not shared between those hostnames.

For a temporary end-to-end handoff test, set both `DUB_DEBUG=true` and `DUB_DEBUG_SHOW_CLICK_ID=true`. Every pageview will log either `Pageview on <hostname>: click ID <value>` or `Pageview on <hostname>: no click ID`. Confirm the same value first appears on `p-staging.net` and then on `app.p-staging.net`. This setting exposes an attribution identifier in Worker and, with **Execute unsafe scripts**, browser logs; remove it or set it to `false` immediately after testing.

The debug logs also show Custom Managed Component protocol delivery, for example `Received /init` and `Received /event for pageview`. They report only whether the API-key and short-domain settings are present, never their values. If these messages do not appear in the deployed Worker's logs after a page load, Zaraz is not invoking that Worker; verify that the dashboard tool points to the Worker deployed by `pnpm run release` and that the `DUB_DEBUG` custom setting is exactly `true`.

## Events

### Click Tracking

On every `pageview` event (including client-side/SPA navigations), this component checks the current URL and:

- If a `?dub_id=` query param is present (the case when a visitor arrives via an actual Dub short-link redirect), it's stored directly as the `dub_id` cookie — Dub already recorded the click.
- Otherwise, if a configured query param (default `via`) is present **and** a **Dub Short Domain** is configured, the component calls Dub's `/track/click` API directly to record the click, then stores the returned click ID as the `dub_id` cookie.

No client-side Dub script is loaded — the click is recorded and the cookie is set entirely server-side:

```javascript
// Automatic - no code needed
```

### Pageview Tracking

Pageviews record or persist Dub click IDs only. They do not create lead events. Use a `track` or `event` call to record a lead after a conversion action:

```javascript
zaraz.track('track', {
  eventName: 'Sign Up',
  customerExternalId: 'user_123',
})
```

### Lead Tracking

Track signups, registrations, and other lead events:

```javascript
zaraz.track('track', {
  eventName: 'Sign Up',
  customerExternalId: 'user_123',
  customerEmail: 'user@example.com',
  customerName: 'John Doe',
})
```

After configuring the `event` action with the **All Tracks** trigger above, call `zaraz.track('track', ...)` directly from the confirmed client-side conversion path. Zaraz dispatches it to the component's `event` listener, which sends it to Dub as a lead when a `dub_id` click ID is available. For example, company registration uses:

```javascript
zaraz.track('track', {
  eventName: 'Company registered',
  customerExternalId: companyRegistrationId,
})
```

The `customerExternalId` must be a stable identifier in your system. `amount` and `revenue` must be omitted for lead events; either field causes the component to send a sale instead.

### Ecommerce/Sale Tracking

Track purchases and revenue:

```javascript
zaraz.track('ecommerce', {
  eventName: 'Purchase',
  customerExternalId: 'user_123',
  amount: 9999, // Amount in cents (e.g., $99.99)
  currency: 'USD',
  invoiceId: 'inv_abc123',
  paymentProcessor: 'stripe',
  metadata: {
    productId: 'prod_123',
    plan: 'premium',
  },
})
```

### Identify User

Associate a customer ID with the current session:

```javascript
zaraz.track('identify', {
  customerId: 'user_123',
  customerEmail: 'user@example.com',
  customerName: 'John Doe',
})
```

## Event Fields

### Lead Event Fields

| Field                  | Type   | Required | Description                                      |
| ---------------------- | ------ | -------- | ------------------------------------------------ |
| `eventName`            | string | Yes      | Name of the lead event                           |
| `customerExternalId`   | string | Yes      | Unique customer ID in your system                |
| `customerEmail`        | string | No       | Customer's email address                         |
| `customerName`         | string | No       | Customer's name                                  |
| `customerAvatar`       | string | No       | URL to customer's avatar image                   |
| `eventQuantity`        | number | No       | Number of times to track this event              |
| `metadata`             | object | No       | Additional metadata (max 10,000 characters)      |

### Sale Event Fields

| Field                  | Type   | Required | Description                                      |
| ---------------------- | ------ | -------- | ------------------------------------------------ |
| `customerExternalId`   | string | Yes      | Unique customer ID in your system                |
| `amount`               | number | Yes      | Sale amount in cents (or full value for zero-decimal currencies) |
| `currency`             | string | No       | ISO 4217 currency code (default: USD)            |
| `eventName`            | string | No       | Name of the sale event                           |
| `paymentProcessor`     | string | No       | Payment processor used (e.g., 'stripe')          |
| `invoiceId`            | string | No       | Invoice/transaction ID (used for deduplication)  |
| `leadEventName`        | string | No       | Name of the lead event to attribute this sale to |
| `customerEmail`        | string | No       | Customer's email address                         |
| `customerName`         | string | No       | Customer's name                                  |
| `customerAvatar`       | string | No       | URL to customer's avatar image                   |
| `metadata`             | object | No       | Additional metadata (max 10,000 characters)      |

## Component Development

[![Released under the Apache license](https://img.shields.io/badge/license-apache-blue.svg)](./LICENSE)
[![PRs welcome!](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/plain-insure/dub-managed-component/pulls)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

### Prerequisites

1. Make sure you're running [Node.js](https://nodejs.org/) (>=18.0.0) and [pnpm](https://pnpm.io/) (>=8.0.0)
2. Install dependencies with `pnpm install`

### Development Scripts

- `pnpm run dev` - Build with watch mode
- `pnpm run test` - Run tests once
- `pnpm run test:dev` - Run tests in watch mode
- `pnpm run lint` - Lint code
- `pnpm run lint:fix` - Lint and auto-fix issues
- `pnpm run typecheck` - Type check the component (`src/`)
- `pnpm run typecheck:worker` - Type check the Worker adapter (`worker/`)
- `pnpm run build` - Full build (lint, typecheck, test, bundle)
- `pnpm run deploy` / `pnpm run release` - Build and deploy to Cloudflare Workers

## Testing

Run tests with:

```bash
pnpm run test
```

Or in watch mode:

```bash
pnpm run test:dev
```

## Deployment

Deploy to Cloudflare Workers:

```bash
pnpm run deploy
```

This runs the full build then `wrangler deploy` using the [wrangler.toml](wrangler.toml)/[worker/](worker/) setup already in this repo — no interactive prompts. Then configure it in the Cloudflare Zaraz Dashboard.

## Resources

- [Dub.co Documentation](https://dub.co/docs)
- [Dub TypeScript SDK](https://dub.co/docs/sdks/typescript)
- [Managed Components docs](https://managedcomponents.dev/)
- [Cloudflare Zaraz](https://developers.cloudflare.com/zaraz/)
- [WebCM](https://webcm.dev/getting-started/install)

## Support

- [Cloudflare Workers Discord](https://discord.gg/cloudflaredev)
- <zaraz@cloudflare.com>

## License

Licensed under the [Apache License](./LICENSE).