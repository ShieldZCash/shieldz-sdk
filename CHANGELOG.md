# Changelog

All notable changes to `@shieldz/sdk` are documented here. This project follows
[Semantic Versioning](https://semver.org).

## [0.2.2] — 2026-06-26

### Changed
- Released through a hardened CI pipeline: npm provenance, CycloneDX SBOM,
  SHA-256 checksums, and a Sigstore (cosign) signature attached to each release.
- Expanded package keywords.

## [0.2.1] — 2026-06-26

### Added
- Export `./package.json` for tooling that reads it.
- npm version badge in the README.

## [0.2.0] — 2026-06-26

### Added
- Automatic retries with exponential backoff + jitter on network errors,
  timeouts, `429`, and `5xx` (honouring `Retry-After`).
- Auto-attached idempotency key on retryable POSTs so a retried invoice create
  can't duplicate.
- `invoices.listAll()` — async-iterator auto-pagination across cursors.
- `ShieldzError.requestId` correlation id (from `cf-ray`).
- Dual **ESM + CommonJS** builds.

## [0.1.0] — 2026-06-26

### Added
- Initial release: `invoices.create` / `retrieve` / `list`, webhook signature
  verification on the Web Crypto API (`verifySignature`, `constructEvent`),
  typed errors, zero runtime dependencies.
