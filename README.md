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
10. Configure your Dub API Key in the tool settings

## Configuration

### Tool Settings

#### Dub API Key `string` (required)

Your Dub API key. You can find this in your [Dub workspace settings](https://dub.co/settings).

#### Dub Workspace ID `string` (optional)

The ID of the Dub workspace you want to send events to.

#### Dub API Host `string` (optional)

Override the host used for the click-tracking API call. Defaults to `https://api.dub.co`.

#### Dub Short Domain `string` (optional)

Your Dub short link domain. Only needed to record clicks for visits that land directly on your site with a short link key in the URL (e.g. `yoursite.com/?via=abc123`) instead of via an actual short-domain redirect — see [Click Tracking](#click-tracking) below.

#### Dub Attribution Model `string` (optional)

`last-click` (default) or `first-click` — whether a later click on the same visitor can override an already-attributed one.

#### Dub Query Parameters `string` (optional)

Additional query parameters to check for a short link key, as a JSON array or comma-separated list (e.g. `via,ref`). `via` is always included by default.

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

Pageviews are also automatically tracked as lead events (attributed to the click ID above, if one is set):

```javascript
// Automatic - no code needed
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