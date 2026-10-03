# ADR-001: Authentication realms

Status: Accepted

Customer and staff/admin use distinct routes, JWT audiences, session realms, cookie namespaces and guards. Public registration can create only `CUSTOMER`. This prevents a valid customer identity from being confused with administrative authority and preserves future staff MFA/SSO policy independence.
