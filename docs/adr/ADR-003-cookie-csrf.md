# ADR-003: Cookie and CSRF strategy

Status: Accepted

Route browser API calls through each application origin. Use secure, HttpOnly, host-only credential cookies with no `Domain`, plus Origin/Referer verification and a session-bound or signed pre-auth CSRF token on unsafe methods. SameSite is defense-in-depth, not the sole CSRF control.

## Environment policy

`development` and `test` are local environments. `staging` and `production` are deployed environments and use the same transport-security policy:

- credential and guest-cart cookies are `Secure` and host-only;
- access and guest-cart cookies use `__Host-` names with `Path=/` and no `Domain`;
- refresh cookies retain their restricted refresh path and therefore use `__Secure-`, not `__Host-`;
- CSRF cookies remain client-readable for the synchronizer pattern, use `__Secure-`, and are never treated as the sole CSRF control;
- HTTPS origins, CSP and HSTS are required for deployed environments.

Cookie clearing must repeat the issuing name, path and security attributes. Local environments keep unprefixed non-Secure cookie names so HTTP integration and browser tests remain deterministic. The deployed policy is covered locally but still requires verification behind the selected staging TLS/proxy topology.
