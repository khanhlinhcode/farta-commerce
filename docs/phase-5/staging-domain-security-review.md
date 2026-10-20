# Phase 5C — Staging domain and web-security review

Date: 2026-10-20

Status: **BLOCKED pending complete DNS inventory and Cloudflare write access**

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

The stakeholder initially described Email Forwarding as used, but the
authoritative Namecheap Domain screen subsequently showed `You haven't defined
any Email Redirect yet` and offered only `Add Forwarder` / `Add Catch-All`.
Therefore there is no configured alias or catch-all to migrate. The MX/SPF
records exist because the Mail Settings mode is set to Email Forwarding, not
because a forwarding rule exists.

Namecheap documents that Free Email Forwarding is available only while the
domain uses Namecheap BasicDNS, PremiumDNS or FreeDNS, and its redirect controls
are unavailable with third-party nameservers. Because no redirect exists, the
Cloudflare cutover does not need an email migration. The obsolete Namecheap
forwarding MX/SPF records must not be represented as an operational mail
service after delegation. Cloudflare Email Routing may be configured later if
the stakeholder intentionally creates an alias and verifies a destination.

Official sources checked 2026-10-20:

- <https://www.namecheap.com/support/knowledgebase/article.aspx/308/2214/how-to-set-up-free-email-forwarding/>
- <https://www.namecheap.com/support/knowledgebase/article.aspx/323/2214/why-cant-i-modify-email-domain-redirect-and-host-records-in-my-namecheap-account/>
- <https://developers.cloudflare.com/email-service/get-started/route-emails/>
- <https://developers.cloudflare.com/api/resources/email_routing/subresources/dns/methods/create/>

## Email decision

No current forwarding rule needs migration. Do not click `Add Forwarder` or
`Add Catch-All` merely to satisfy the deployment process. If a branded inbound
address is required later, create it deliberately through Cloudflare Email
Routing, enter the destination only in Cloudflare, verify that destination, and
test external delivery before treating it as operational.

## Required change for Cloudflare Worker custom domains

Cloudflare's current Workers custom-domain documentation requires the hostname
to belong to an active Cloudflare zone:
<https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>

The exact proposed change is:

1. Add `fartacommerce.me` as a Cloudflare zone in the same account that owns
   the two Workers.
2. Recreate and verify all approved operational records before delegation:
   - four apex GitHub Pages A records;
   - `www` CNAME;
   - no mail records unless an approved mail service is configured; do not copy
     the unused Namecheap forwarding MX/SPF records as if they were operational;
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
