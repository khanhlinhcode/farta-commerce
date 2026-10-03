# ADR-003: Cookie and CSRF strategy

Status: Accepted

Route browser API calls through each application origin. Use secure, HttpOnly, host-only credential cookies with no `Domain`, plus Origin/Referer verification and a session-bound or signed pre-auth CSRF token on unsafe methods. SameSite is defense-in-depth, not the sole CSRF control.
