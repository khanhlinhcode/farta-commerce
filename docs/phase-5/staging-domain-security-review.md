# Phase 5C — Staging domain and web-security review

Date: 2026-10-20

Status: **BLOCKED pending email-forwarding migration and DNS approval**

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

The stakeholder confirmed on 2026-10-20 that at least one Namecheap Email
Forwarding alias is actively used. Namecheap documents that Free Email
Forwarding is available only while the domain uses Namecheap BasicDNS,
PremiumDNS or FreeDNS. Its redirect/host-record controls are unavailable when
the domain uses third-party nameservers. Therefore changing authoritative
nameservers to Cloudflare before migrating and validating the alias would risk
mail interruption. Copying Namecheap's MX/SPF values into Cloudflare is not
treated as proof that the Namecheap forwarding backend will continue.

Official sources checked 2026-10-20:

- <https://www.namecheap.com/support/knowledgebase/article.aspx/308/2214/how-to-set-up-free-email-forwarding/>
- <https://www.namecheap.com/support/knowledgebase/article.aspx/323/2214/why-cant-i-modify-email-domain-redirect-and-host-records-in-my-namecheap-account/>
- <https://developers.cloudflare.com/email-service/get-started/route-emails/>
- <https://developers.cloudflare.com/api/resources/email_routing/subresources/dns/methods/create/>

## Email migration gate

No nameserver change is allowed until an approved mail path passes all of the
following:

1. Inventory every active alias and whether a catch-all is enabled. Destination
   mailbox values must be handled directly in the provider dashboard or secret
   channel, not committed to this repository.
2. Select one of these policies:
   - migrate aliases to Cloudflare Email Routing, verify every destination,
     create equivalent routing rules, and use Cloudflare-managed mail DNS;
   - migrate to another approved mail provider and validate its MX/SPF/DKIM/DMARC
     requirements;
   - retain Namecheap BasicDNS and Email Forwarding, and defer Cloudflare Worker
     custom domains while continuing to use the `workers.dev` staging URLs.
3. Before nameserver cutover, send an external test message to every alias and
   catch-all path using the current Namecheap configuration and record receipt.
4. Configure and verify the replacement destination/rules before moving
   nameservers. Cloudflare requires destination addresses to be verified before
   they can be used by Email Routing rules.
5. After cutover, repeat external delivery tests. If any alias fails, restore
   Namecheap BasicDNS immediately and verify delivery before retrying.

The alias list, catch-all status and chosen migration policy are not yet
available. Email migration and DNS cutover therefore remain **BLOCKED**.

## Required change for Cloudflare Worker custom domains

Cloudflare's current Workers custom-domain documentation requires the hostname
to belong to an active Cloudflare zone:
<https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>

The exact proposed change is:

1. Add `fartacommerce.me` as a Cloudflare zone in the same account that owns
   the two Workers.
2. After completing the Email Forwarding migration gate, recreate and verify all
   approved existing records before delegation:
   - four apex GitHub Pages A records;
   - `www` CNAME;
   - the approved replacement mail provider's exact MX/SPF and authentication
     records; do not copy obsolete Namecheap forwarding records after migration;
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
