# Security Policy

## Reporting a vulnerability

Please report security issues privately to **support@shieldz.cash**, or via the
coordinated-disclosure contact published at
<https://shieldz.cash/.well-known/security.txt> (RFC 9116).

Do not open a public issue for security-sensitive reports. We'll acknowledge
within a reasonable time and keep you updated through to a fix.

## Scope

This repository is the official client SDK. It is non-custodial by design and
never handles private keys or seed phrases — it only ever sees public API keys
you provide. Reports about the SDK's webhook signature verification, request
handling, or dependency posture (the SDK ships with zero runtime dependencies)
are especially welcome.

For issues in the Shieldz service itself, use the security.txt contact above.
