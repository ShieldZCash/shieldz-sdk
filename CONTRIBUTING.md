# Contributing

Thanks for your interest in improving `@shieldz/sdk`.

## Development

```bash
npm install
npm run build      # dual ESM + CJS via tsc
npm test           # build + node:test suite
npm run typecheck
```

The SDK has **zero runtime dependencies** and targets web standards (`fetch` +
Web Crypto) so it runs on Node 18+, Deno, Bun, and edge runtimes. Please keep it
that way — new runtime dependencies will not be merged without a strong reason.

## Pull requests

- Add or update tests for any behavior change (`test/*.test.mjs`).
- Run `npm test` and `npm run typecheck` before opening the PR.
- Keep comments sparse and the public API typed.

## Reporting bugs

Open an issue with a minimal reproduction. For security issues, see
[SECURITY.md](./SECURITY.md) instead.
