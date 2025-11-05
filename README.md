# Dub Managed Component

> A managed component for Dub.co link tracking and ecommerce events

![Dub.co](https://dub.co/logo.png)

Common use is currently for [Cloudflare Zaraz](https://www.cloudflare.com/application-services/products/zaraz/).

## Features

- 🔗 **Link Click Tracking**: Automatically tracks clicks via Dub's click ID cookie
- 📊 **Lead Tracking**: Track signups, form submissions, and other conversion events
- 💰 **Ecommerce Tracking**: Track sales, purchases, and revenue events
- 🎯 **Customer Attribution**: Associate events with customers for accurate attribution
- 🔐 **Secure**: Uses server-side tracking with API keys
- ⚡ **Fast**: Minimal overhead with the official Dub TypeScript SDK

## How to use

### Zaraz / Cloudflare Worker

Until this component is an "official" Managed Component, we need to manually host the MC in a Cloudflare Worker.

1. Clone this repository
2. Install dependencies with `pnpm install`
3. Build the component with `pnpm run build`
4. Deploy to Cloudflare Workers:
   ```bash
   CLOUDFLARE_ACCOUNT_ID=<YOUR_ACCOUNT_ID> \
   CLOUDFLARE_API_TOKEN=<YOUR_API_TOKEN> \
   CLOUDFLARE_EMAIL=<YOUR_EMAIL> \
   pnpm run release
   ```
5. Follow the prompts to setup the Worker
6. Login to the Cloudflare dashboard and go to the [Zaraz Dashboard](https://dash.cloudflare.com/?to=/:account/:zone/zaraz/tools-config/tools/catalog)
7. Choose **Custom Managed Component**
8. Select `custom-mc-zaraz-dub` from the list
9. Grant **Server network requests** permission (required for API calls)
10. Grant **Access client key-value store** permission (recommended for click tracking)
11. Configure your Dub API Key in the tool settings

## Configuration

### Tool Settings

#### Dub API Key `string` (required)

Your Dub API key. You can find this in your [Dub workspace settings](https://dub.co/settings).

#### Dub Workspace ID `string` (optional)

The ID of the Dub workspace you want to send events to.

## Events

### Pageview Tracking

Pageviews are automatically tracked as lead events:

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
- `pnpm run typecheck` - Type check TypeScript
- `pnpm run build` - Full build (lint, typecheck, test, bundle)
- `pnpm run release` - Deploy to Cloudflare Workers

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
pnpm run release
```

Then configure it in the Cloudflare Zaraz Dashboard.

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