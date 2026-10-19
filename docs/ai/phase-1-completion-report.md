# FARTA AI Agent V4.1 — Phase 1 Completion Report

Ngày kiểm tra: 2026-10-19

## Verified

- Branch: `main`.
- Baseline HEAD: `ca8bdc6d0b0f903ff6708f62fbf3127c86ea8ddb`.
- Pydantic AI API được kiểm tra trực tiếp ở version `2.57.0` trước khi sử dụng
  `Agent`, typed tools, `UsageLimits`, Google/Groq providers và `TestModel`.
- Existing Product Service/public projections, global DTO validation, Redis,
  CUSTOMER optional auth, Origin validation và error envelope được tái sử dụng.
- Không sửa Cart, Checkout, Order, Payment hoặc inventory mutation invariants.

## Implemented

### Phase 1A — contracts và public tools

- Versioned AI request/response/product/tool types trong `packages/types`.
- Ba endpoint tool cố định: search, details và semantic availability.
- Tool arguments dùng explicit DTO; unexpected properties bị global validation từ chối.
- HMAC service identity binds raw body/method/path/audience/timestamp/nonce.
- Redis replay claim; no exact stock/SKU/admin fields in output.
- Public keyword search được mở rộng tương thích ngược sang `shortDescription` và
  `tags`, vẫn dùng escaped bounded regex.

### Phase 1B — FastAPI/Pydantic AI

- Typed settings fail closed, fixed model IDs và provider-specific free-tier flags.
- Deterministic Vietnamese Intent Router hoạt động khi không có provider.
- Explicit AgentState, AgentPolicy, ToolRegistry và bounded AgentExecutor.
- Pydantic AI limits: ba model requests, ba tool calls, 768 output tokens, no
  parallel tool calls, 12-second LLM timeout và 25-second total timeout.
- Google SDK retries đặt một total attempt; Groq SDK retries đặt `0`.
- Một fallback tối đa và chỉ khi cả hai provider được bật/phê duyệt.
- Agent output chỉ được tham chiếu product slug đã xuất hiện trong tool observations.

### Phase 1C — NestJS customer gateway

- `POST /api/v1/ai/chat` với bounded DTO, Origin guard và `AI_CHAT` rate policy.
- Guest/customer conversation ownership, Redis TTL và tối đa sáu turns.
- Không forward Cookie/Authorization/customer identity tới FastAPI.
- NestJS hydrate lại Product Cards từ authoritative Commerce service trước khi trả browser.

### Phase 1D — Storefront

- Accessible native-dialog Product Advisor, keyboard close/focus return, loading,
  suggestion, empty/unavailable/error states và authoritative Product Cards.
- Restrained Liquid Glass, mobile bottom sheet và reduced-motion support.
- Widget không render trên Cart, Checkout và Order confirmation routes.
- Không có fake wishlist/cart/order/payment/AI success.

## Validation

- `pnpm format:check`: pass.
- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- API unit/security: 18 files, 82 tests pass.
- Storefront component: 14 files, 40 tests pass.
- Admin regression: 5 files, 14 tests pass.
- `uv run ruff check .`: pass.
- `uv run pytest -q`: 25 tests pass.
- Production build: pass; sitemap ghi nhận local Product API không chạy nhưng build
  hoàn tất.
- `pnpm audit:prod`: không phát hiện known high-level production dependency issue.
- FastAPI runtime smoke tại `127.0.0.1:8000`: live `200`, ready `200`, unsigned
  `/v1/chat` `401`; Uvicorn shutdown sạch.
- Docker-backed API E2E: 7 files, 65 tests pass trên MongoDB replica set và Redis.
- Chromium Browser E2E: 27 tests pass bằng NestJS/Next.js production artifacts,
  FastAPI thật và provider-off deterministic mode. Luồng ký hai chiều
  Storefront → NestJS → FastAPI → NestJS Tool Gateway trả Product Card từ catalog seed.
- Browser security kiểm tra untrusted Origin `403`, unsigned internal tool `401`,
  provider-off không dựng recommendation giả và widget không xuất hiện trong Checkout.
- Visual regression có baseline riêng cho Product Advisor desktop/mobile. Detector
  `impeccable` không trả finding trong các AI components/CSS đã kiểm tra.

Deterministic routing micro-benchmark (local process, 200 evaluations, 10 hand-authored
cases repeated): accuracy `1.0`, p50 `0.0033 ms`, p95 `0.0077 ms`, provider calls `0`.
Đây chỉ là regression micro-benchmark cho chính dataset nhỏ đã khai báo, không phải
production latency hoặc generalization evidence.

## Security checks

- Invalid/replayed HMAC requests rejected.
- Fixed tool registry and strict Pydantic/class-validator arguments.
- Unobserved model product references rejected.
- Tool-call limit produces safe unavailable response.
- Provider-off complex advice fails closed; deterministic catalog remains available.
- UI text uses normal React escaping; arbitrary HTML is not rendered.
- Provider keys and service secrets are environment-only.

## Runtime defect fixed during validation

- Browser trace cho thấy Product Advisor vẫn mở sau khi người dùng chọn Product Card,
  làm dialog che Product Detail Page. Product links hiện đóng dialog trước navigation;
  regression test xác minh PDP còn đúng một heading và focus behavior không bị hỏng.
- Production visual pass ban đầu phát hiện Home dùng fallback thay vì CMS hero vì
  Storefront được build lúc API không khả dụng. Không cập nhật baseline theo fallback.
  Sau khi build lại với `API_INTERNAL_URL` trỏ tới API healthy, production Browser E2E
  pass 27/27. Deployment/build pipeline phải giữ precondition này.

## Remaining

- Live Gemini/Groq tests chưa chạy; actual account free-tier, quota, privacy terms,
  tool calling, structured output, latency và token usage chưa được xác minh.
- FastAPI replay cache cho inbound NestJS requests là bounded in-process memory. Staging
  phải chạy một AI instance hoặc phê duyệt một shared replay store/gateway enforcement
  trước multi-instance deployment.
- GitHub Actions và secret scan cần commit/push để xác nhận thay đổi mới.
- RAG chưa được triển khai; chưa có approved corpus/resource review/dependency approval.
- Một production browser pass ghi nhận một log Next.js `destination stream closed early`
  khi test chuyển route nhanh; không có journey nào fail nhưng cần tái hiện/triage riêng
  trước khi coi đây là production-runtime issue.

## Giới hạn & điều cần kiểm chứng

- Không gọi live provider và không phát sinh chi phí.
- Không có số liệu model quality, token usage, quota error hoặc real provider latency.
- Dataset benchmark hiện nhỏ và hand-authored; cần Vietnamese golden set độc lập.
- Browser evidence hiện chỉ là Chromium local; chưa xác minh Firefox/WebKit, thiết bị thật
  hoặc screen reader thật.
- Cần staging validation cho TLS, secrets, CORS/Origin, proxy, Redis TTL và horizontal scaling.
