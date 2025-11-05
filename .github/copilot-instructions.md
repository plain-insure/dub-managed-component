# GitHub Copilot Instructions for Dub Managed Component

## Project Overview

This is a managed component for Dub.co link tracking and ecommerce events. It's designed to work with Cloudflare Zaraz and other managed component platforms to enable server-side tracking of clicks, leads, and sales through the Dub.co API.

## Tech Stack

- **Runtime**: Bun (>=1.1.30)
- **Language**: TypeScript (v5.6.2)
- **Framework**: Managed Components (@managed-components/types)
- **SDK**: Dub TypeScript SDK (v0.68.0)
- **Testing**: Vitest (v2.1.1) with globals enabled
- **Linting**: ESLint (v9.11.1) with TypeScript ESLint and Prettier
- **Code Style**: Prettier
- **Deployment**: Cloudflare Workers via managed-component-to-cloudflare-worker

## Repository Structure

```
.
├── src/
│   ├── index.ts        # Main component logic with event listeners
│   ├── utils.ts        # Utility functions (URL validation, cookie parsing)
│   └── index.test.ts   # Test suite
├── .github/            # GitHub configuration (workflows, Copilot instructions)
├── dist/               # Build output (auto-generated, gitignored)
├── bundle.ts           # Build script for bundling
├── manifest.json       # Managed component manifest
├── package.json        # Project dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── eslint.config.mjs   # ESLint configuration (flat config)
├── vitest.config.ts    # Vitest test configuration
└── README.md           # Documentation
```

## Development Setup

### Prerequisites

1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Clone the repository
3. Install dependencies: `bun install`

### Environment

- This project uses Bun as the primary runtime and package manager
- TypeScript is configured with strict mode enabled
- ESLint uses the modern flat config format (eslint.config.mjs)

## Available Scripts

All scripts should be run with `bun run`:

- `bun run dev` - Build with watch mode (incremental development)
- `bun run lint` - Lint code with ESLint
- `bun run lint:fix` - Lint and automatically fix issues
- `bun run typecheck` - Type check TypeScript without emitting files
- `bun run test` - Run tests once with Vitest
- `bun run test:dev` - Run tests in watch mode
- `bun run bundle` - Bundle the component for distribution
- `bun run build` - Full build: lint, typecheck, test, and bundle
- `bun run release` - Build and deploy to Cloudflare Workers

## Build Process

The build process follows this order:
1. Lint with ESLint (must pass)
2. Type check with TypeScript (must pass)
3. Run tests with Vitest (must pass)
4. Bundle with custom bundle script

Build output goes to `dist/index.js` and should not be committed to version control.

## Testing Guidelines

- Tests use Vitest with globals enabled (no need to import `describe`, `it`, `expect`)
- Test files are named `*.test.ts` and located alongside source files
- Tests are excluded from TypeScript compilation (see tsconfig.json)
- Console usage in tests triggers linting errors (intentional constraint)
- Run tests before committing: `bun run test`
- Use watch mode during development: `bun run test:dev`

## Code Style & Conventions

### TypeScript

- Use strict mode (enabled in tsconfig.json)
- Prefer explicit types for function parameters and return values
- Use modern ES features (ESNext target)
- Avoid `any` types; use proper typing
- Optional chaining and nullish coalescing are preferred

### Code Organization

- Keep functions focused and single-purpose
- Export functions that may be tested independently
- Use async/await for asynchronous operations
- Handle errors gracefully with try-catch blocks

### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for types and interfaces
- Use SCREAMING_SNAKE_CASE for constants
- Prefix internal/private functions with underscore if needed

### Formatting

- Prettier is enforced via ESLint (prettier/prettier: error)
- 2-space indentation (Prettier default, not explicitly configured)
- Semicolons disabled (semi: false)
- Single quotes for strings (singleQuote: true)
- Trailing commas for ES5-compatible syntax (trailingComma: es5)

### Linting

- ESLint configuration uses flat config format
- TypeScript ESLint rules are applied
- Prettier integration is enabled
- `no-console` is enforced in test files
- Unused variables are allowed (for API compatibility)

## Key Architectural Patterns

### Event Handling

The component listens to several event types:
- `pageview` - Automatically tracked as lead events
- `event` - Generic custom events (routes to lead or sale based on payload)
- `track` - Explicit tracking calls (routes to lead or sale based on payload)
- `ecommerce` - Ecommerce/sale events
- `identify` - User identification (stores customer ID in cookie)

### Event Classification

Events are automatically classified as either:
- **Lead events**: Any event without `amount` or `revenue` in payload
- **Sale events**: Any event with `amount` or `revenue` in payload

### Cookie Management

- Component maintains a session cookie (`mc_dub`) for tracking
- Stores `sessionId` and optionally `customerId`
- Uses crypto.randomUUID() with Math.random() fallback for session IDs
- Integrates with Dub's click tracking cookie (`dub_id`)

### Customer Identification

Customer ID resolution follows this priority:
1. `customerId` from event payload
2. `customerExternalId` from event payload
3. `customerId` from cookie
4. `sessionId` from cookie
5. Fallback to 'anonymous'

### Error Handling

- All event handlers wrap operations in try-catch blocks
- Errors are logged to console.error but don't throw
- Failed tracking should not break the page

## Dependencies

### Production Dependencies

- `dub` (^0.68.0) - Official Dub TypeScript SDK

### Dev Dependencies

- TypeScript tooling and type definitions
- ESLint with TypeScript and Prettier plugins
- Vitest for testing
- Managed Components types

## Deployment

The component is deployed to Cloudflare Workers:
1. Build the component: `bun run build`
2. Convert to Cloudflare Worker: Uses `managed-component-to-cloudflare-worker`
3. Deploy to Cloudflare: Requires CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_EMAIL

## Configuration

When deployed, the component accepts these settings:
- `DUB_API_KEY` (required) - Dub API key for authentication
- `DUB_WORKSPACE_ID` (optional) - Specific workspace ID

## Common Tasks

### Adding a New Feature

1. Create/modify code in `src/`
2. Add tests in corresponding `.test.ts` file
3. Run `bun run build` to verify everything passes
4. Test locally if possible
5. Update README.md if the feature affects usage

### Fixing a Bug

1. Write a failing test that reproduces the bug
2. Fix the code
3. Verify test passes and existing tests still pass
4. Run full build to ensure no regressions

### Updating Dependencies

1. Update package.json version
2. Run `bun install` to update bun.lock
3. Run `bun run build` to verify compatibility
4. Test thoroughly, especially SDK changes

## Best Practices

1. **Always run the full build before committing**: `bun run build`
2. **Write tests for new functionality**: Maintain test coverage
3. **Follow existing patterns**: Stay consistent with the codebase
4. **Type everything**: Leverage TypeScript's type system
5. **Handle errors gracefully**: Use try-catch in async operations
6. **Document public APIs**: Add JSDoc comments for exported functions
7. **Keep it minimal**: This is a focused component, avoid scope creep
8. **Respect the platform**: Follow Managed Components best practices

## Resources

- [Dub.co Documentation](https://dub.co/docs)
- [Dub TypeScript SDK](https://dub.co/docs/sdks/typescript)
- [Managed Components Docs](https://managedcomponents.dev/)
- [Cloudflare Zaraz](https://developers.cloudflare.com/zaraz/)
- [Bun Documentation](https://bun.sh/docs)

## Notes

- This is a TypeScript-first codebase targeting modern runtimes
- The component is stateless; state is managed via cookies
- All tracking is server-side for privacy and reliability
- The component is designed to be deployed as a Cloudflare Worker
- Cookie operations use the Managed Components Client API
- Random UUID generation has a fallback for older environments
