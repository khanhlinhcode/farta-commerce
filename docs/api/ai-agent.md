# FARTA AI Product Advisor API

## Public browser endpoint

`POST /api/v1/ai/chat`

Request:

```json
{
  "message": "Tìm áo màu đen size M dưới 500k",
  "conversationId": null
}
```

- `message`: 1–1000 Unicode text characters; control characters and unknown
  properties are rejected.
- `conversationId`: optional UUID v4 issued by the server.
- The endpoint accepts optional CUSTOMER authentication, applies an IP rate limit
  and requires a trusted Storefront `Origin`/`Referer`.
- Guest ownership uses a signed HttpOnly cookie. Authenticated ownership uses the
  verified customer session. Conversation data is bounded to six turns and expires
  in Redis.

The browser never calls FastAPI or provider APIs directly and never receives internal
service credentials.

## Internal Tool Gateway

FastAPI may call only:

- `POST /api/v1/internal/ai/tools/search-products`
- `POST /api/v1/internal/ai/tools/product-details`
- `POST /api/v1/internal/ai/tools/availability`

Every request binds HMAC-SHA256 to timestamp, nonce, audience, HTTP method, exact path
and raw request body. NestJS validates timestamp tolerance and atomically claims the
nonce in Redis. Unknown endpoints/tools are not registered.

Tool DTOs are allowlisted and globally reject unknown properties. Results expose
semantic availability and integer VND prices but omit SKU, exact stock, ledger,
createdBy and administrative fields.

## Response authority

The FastAPI response contains structured text and product references. Before returning
to the browser, NestJS discards AI-supplied product fields and hydrates every referenced
slug again through `AiToolsService`/`ProductsService`. Invalid or inactive references
are omitted. React renders assistant text as plain text; raw HTML is not supported.

## Disabled and failure behavior

- `AI_ENABLED=false`: returns an explicit unavailable response without invoking
  FastAPI or signing a guest credential with an unconfigured secret.
- No verified provider: every supported Product Advisor request fails closed with
  `AI_PROVIDER_DISABLED`; normal Storefront catalog browsing remains available independently.
- Tool/provider timeout or malformed upstream output: safe unavailable state, no
  commerce fallback or mutation.
- Cart, Checkout, Payment, Orders and Admin operations are not Agent tools.

## Operational runbook

Provider-off is the safe default. When `AI_ENABLED=true` but no approved provider is enabled, every
supported Agent request fails closed. Automatic provider fallback and provider retries are rejected.

Safe structured events are restricted to the `ai.request.*`, `ai.route.selected`,
`ai.provider.*`, `ai.tool.*` and `ai.response.*` allowlist. Do not add raw prompt, conversation,
cookie, authorization, HMAC secret, email, phone, address, unrestricted provider output or tool
payload fields.

Incident sequence:

1. disable the affected provider flag in the deployment secret manager;
2. keep `AI_FALLBACK_ENABLED=false` and verify the ordinary Storefront catalog remains available;
3. inspect safe error codes and request IDs, not raw customer prompts;
4. verify API/AI readiness and signed Tool Gateway behavior;
5. re-enable only after quota, data policy and provider health are independently confirmed.

Horizontal AI scaling is blocked while inbound FastAPI nonce replay claims are process-local.
Operate one AI replica or implement an approved shared replay claim before increasing replicas.

With the current three-request Agent budget, catalog tools are available for at most the first two
tool-bearing iterations. The last request is reserved for the validated `AgentFinalResponse`; this
prevents a third catalog call from consuming the only remaining structured-output iteration. The
separate configured tool ceiling remains three as a defense-in-depth upper bound.

## Configuration

All variable names and bounded defaults are documented in `.env.example`. Secrets stay
outside Git and are never exposed as `NEXT_PUBLIC_*`/`VITE_*`.
