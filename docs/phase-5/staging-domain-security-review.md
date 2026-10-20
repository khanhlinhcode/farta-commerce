# Phase 5C — Staging domain and web-security review

Date: 2026-10-20

Status: **BLOCKED pending explicit DNS migration approval**

No DNS record, nameserver, Cloudflare zone or application origin was mutated
during this review.

## Current authoritative DNS

Read-only `dig` evidence:

- nameservers: `dns1.registrar-servers.com`, `dns2.registrar-servers.com`;
- apex A: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
  `185.199.111.153`;
- `www` CNAME: `fartacommerce.me`;
- `api-staging` CNAME:
  `api-staging.fartacommerce.me.khan-788f.dns.northflank.app`;
- `_acme-challenge.api-staging` CNAME:
  `api-staging.fartacommerce.me._acme-challenge.northflank.app`;
- apex SPF TXT: `v=spf1 include:spf.efwd.registrar-servers.com ~all`;
- MX: Namecheap `eforward1` through `eforward5`;
- the existing `verify-e5l260s1i9sh6rx5dep0an5g` TXT record remains present;
- no `staging` or `admin-staging` CNAME currently exists.

The domain is currently served by Namecheap BasicDNS. A read-only Cloudflare
API query returned no `fartacommerce.me` zone in the authenticated account.

## Continuation preflight

The Phase 5C continuation repeated the read-only checks before any mutation:

- the Cloudflare OAuth session is valid and can read the account and zones;
- the token has `zone:read` and Workers/route write access, but it does not have
  `zone:write` or DNS-record write access;
- the Cloudflare Zones API again returned an empty result for
  `fartacommerce.me`;
- no Namecheap API credential was present in the process environment or in the
  checked `namecheap-api` macOS Keychain service;
- a public IPv4 was available, but its Namecheap allowlist status cannot be
  checked without Namecheap API access;
- the authoritative Namecheap server refused AXFR, so public DNS queries alone
  cannot prove that the known-record list is complete.

The known records still match the inventory above. A complete parity check
requires Namecheap `namecheap.domains.dns.getHosts` or an exported DNS record
list from the Namecheap dashboard. Zone creation, record replication and
nameserver cutover therefore remain fail-closed.

The authoritative zone advertises Namecheap email-forwarding MX/SPF records,
but this does not prove whether an actual forwarding alias is in use. Namecheap
documents that its Email Forwarding service does not operate with custom
nameservers. Stakeholder confirmation of the current mail use is required
before delegation; copying the MX records is not treated as proof that the
service will continue.

## Required change for Cloudflare Worker custom domains

Cloudflare's current Workers custom-domain documentation requires the hostname
to belong to an active Cloudflare zone:
<https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>

The exact proposed change is:

1. Add `fartacommerce.me` as a Cloudflare zone in the same account that owns
   the two Workers.
2. After resolving the Email Forwarding checkpoint, recreate and verify all
   approved existing records before delegation:
   - four apex GitHub Pages A records;
   - `www` CNAME;
   - apex SPF TXT and all five Namecheap email-forwarding MX records;
   - existing verification TXT;
   - `api-staging` Northflank CNAME;
   - `_acme-challenge.api-staging` Northflank CNAME.
3. Change only the domain's authoritative nameservers at Namecheap to the two
   values assigned by Cloudflare.
4. Wait until the Cloudflare zone is `Active`, then attach:
   - `staging.fartacommerce.me` to `farta-storefront-staging`;
   - `admin-staging.fartacommerce.me` to `farta-admin-staging`.
5. Keep both `workers.dev` hostnames enabled as operational fallbacks.
6. Update runtime/build configuration atomically:
   - API `APP_ORIGIN=https://staging.fartacommerce.me`;
   - API `ADMIN_ORIGIN=https://admin-staging.fartacommerce.me`;
   - Storefront `NEXT_PUBLIC_SITE_URL=https://staging.fartacommerce.me`;
   - Storefront `NEXT_PUBLIC_INDEXABLE=false`;
   - Admin Storefront link to `https://staging.fartacommerce.me`.
7. Redeploy API, Storefront and Admin, then validate TLS, CORS, CSRF, cookies,
   canonical metadata and browser flows on the final hostnames.

Records that must remain untouched are the apex GitHub Pages A records,
`www`, email-forwarding SPF/MX, verification TXT, API CNAME and API ACME CNAME.
The production apex is not redirected in this phase.

The API currently models one Storefront origin and one Admin origin. After the
cutover, the Worker URLs can remain direct health fallbacks, but credentialed
browser traffic from them will correctly fail CORS/CSRF. Supporting multiple
credentialed origins would require a reviewed configuration change; it is not
silently added here.

## Current HTTPS and headers

- `https://api-staging.fartacommerce.me/api/v1/health/live`: HTTP 200.
- `https://api-staging.fartacommerce.me/api/v1/health/ready`: HTTP 200.
- Storefront and Admin Worker roots: HTTP 200 over HTTPS.
- API certificate hostname is `api-staging.fartacommerce.me` and was valid at
  inspection time.
- API, Storefront and Admin returned HSTS, CSP, `X-Content-Type-Options` and
  `Referrer-Policy`; frame protection is present.
- Existing Worker origins received their exact allowed CORS origin; an
  untrusted origin and the not-yet-configured custom origins did not receive
  `Access-Control-Allow-Origin`.
- Storefront staging `robots.txt` disallows crawling.

The Storefront CSP currently needs `unsafe-inline` for scripts/styles under the
deployed Next.js/OpenNext build. It does not include `unsafe-eval`, wildcard
`connect-src` or unrestricted remote image/media hosts. Cloudinary is scoped to
the configured delivery hostname. This exception must be reassessed before a
production review.

## Final-domain validation gate

Because the Storefront/Admin custom domains do not yet resolve, final-domain
TLS, cookie acceptance, CORS, CSRF, canonical metadata and end-to-end flows are
**not validated**. They must remain BLOCKED until the DNS plan above is
explicitly approved and executed.
