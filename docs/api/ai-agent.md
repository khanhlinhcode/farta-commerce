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
- No verified provider: deterministic searches continue; complex advice returns
  `AI_PROVIDER_DISABLED`.
- Tool/provider timeout or malformed upstream output: safe unavailable state, no
  commerce fallback or mutation.
- Cart, Checkout, Payment, Orders and Admin operations are not Agent tools.

## Configuration

All variable names and bounded defaults are documented in `.env.example`. Secrets stay
outside Git and are never exposed as `NEXT_PUBLIC_*`/`VITE_*`.
