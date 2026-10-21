# Phase 5E — OAuth staging validation

Date: 2026-10-21

Google: **BLOCKED**. Apple: **BLOCKED**.

## Provider-neutral foundation

The source has a Redis-backed, single-use OAuth transaction with a 600-second
TTL, server-generated 256-bit `state`, `nonce` and PKCE verifier, S256 challenge,
provider binding and safe relative post-login redirects. It defines typed
provider adapters and an external identity unique on provider plus provider
subject. Environment validation requires each provider configuration to be
complete or disabled, and secret redaction covers Google and Apple material.

This is a foundation only. No concrete Google/Apple adapter or public
authorization/callback controller is present, so no provider login is exposed
as working. Email/password customer authentication remains the validated path.

## Google

Official source accessed 2026-10-21:
[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
It requires a server authorization-code exchange, state protection, exact
redirect handling and ID-token validation including issuer, audience and
expiry; the stable identity key is `sub`, not email.

A value-free staging check found the Google client configuration incomplete.
Because both implementation and development credentials are absent, successful
login, cancelled consent, state/nonce mismatch, invalid audience/expiry,
account-link conflict, logout/session behavior and realm isolation cannot be
externally validated. Google remains `BLOCKED`, not mocked or advertised as
passing.

## Apple

Official sources accessed 2026-10-21:

- [Authenticating users with Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/authenticating-users-with-sign-in-with-apple)
- [Request authorization from the Apple server](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.)
- [Configure private email relay](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/)

Apple documents state/nonce validation and server-side token handling. The
`user` object is only returned on first authorization, while name is not present
on later responses; relay email delivery also requires registered/authenticated
outbound sources. FARTA's eventual adapter must persist first-authorization
data safely, key identity by provider subject and treat relay email as a valid
address rather than an account identifier.

The staging runtime lacks the Apple Services ID/team/key/private-key
configuration, and no concrete adapter exists. Apple Developer approval,
redirect/domain configuration and private-relay mail policy are missing. Apple
therefore remains `BLOCKED`.

## Security boundary

Any future provider callback is customer-realm only. Provider claims must never
assign `STAFF`, `ADMIN` or `OWNER`; frontend email/name input is not identity
proof; authorization codes/tokens/private keys must not enter logs. Exact
redirect URIs and server-side issuer/audience/expiry/nonce verification remain
mandatory before either provider can be enabled.
