# FARTA AI Agent V4.1 — Báo cáo Phase 0

Ngày kiểm tra: 2026-10-19

## Verified

### Repository baseline

- Branch: `main`.
- HEAD: `ca8bdc6d0b0f903ff6708f62fbf3127c86ea8ddb`.
- Worktree lúc bắt đầu: sạch.
- Node.js: `v22.23.2`.
- pnpm: `10.34.3`.
- Python local: `3.14.7`.
- uv: `0.12.8`.
- `apps/ai-service` hiện chỉ là FastAPI health scaffold; chưa có Agent, provider adapter,
  Tool Gateway client hoặc RAG runtime.

### Nguồn và contracts đã kiểm tra

Đã đọc source và tài liệu hiện có liên quan đến AI boundary, auth, catalog, cart,
checkout/order, storefront transport, environment validation và shared types. Các điểm có
thể tái sử dụng trực tiếp:

- NestJS Commerce API vẫn là source of truth.
- Public catalog đã có validated filters và public response projection.
- Storefront đã có same-origin API transport và CSRF/session conventions.
- `ADR-010` đã cấm AI truy cập trực tiếp MongoDB và cấm AI trở thành commerce authority.
- Customer cookie/token không được chuyển tiếp sang FastAPI.
- `packages/types` là vị trí phù hợp cho versioned cross-service contracts; hiện chưa có AI
  contracts.

Phạm vi inspection gồm `README.md`, `PRODUCT.md`, `DESIGN.md`, `SECURITY.md`, các tài liệu
architecture/ADR/API/security/release được yêu cầu trong specification; cùng source hiện tại ở
`apps/storefront/src/app/layout.tsx`, `apps/storefront/src/components/providers.tsx`,
`apps/storefront/src/lib/api-client.ts`, `apps/api/src/app.module.ts`,
`apps/api/src/configure-http-app.ts`, các module auth/products/variants/cart/orders,
`apps/ai-service`, `packages/types`, `packages/ui` và `packages/design-tokens`.

### Quyết định kiến trúc áp dụng

V4.1 thay thế duy nhất lệnh cấm Agent framework và yêu cầu manual general-purpose Agent loop
của V4. Các invariant còn lại của V4 vẫn giữ nguyên:

```text
Next.js Storefront
        |
        v
NestJS AI Gateway
        |
        v
FastAPI AI Service
Deterministic Intent Router
        |
        v
Pydantic AI Agent (bounded)
        |
        v
Typed Tool Client
        |
        v
NestJS authenticated read-only Tool Gateway
        |
        v
Existing Product / Variant / Inventory domain services
```

NestJS tiếp tục chịu trách nhiệm authentication, ownership, permissions, CSRF/origin,
business constraints, rate limiting và audit. LLM/Pydantic AI không phải authorization
authority. Phase 1 không được truy cập trực tiếp MongoDB, Redis, Qdrant hoặc commerce provider.

### Official Pydantic AI/provider verification

Kiểm tra ngày 2026-10-19 từ docs chính thức và PyPI metadata:

- `pydantic-ai-slim` bản `2.57.0`, yêu cầu Python `>=3.11`, license MIT.
- `google-genai` bản `2.31.0`, yêu cầu Python `>=3.10`, license Apache-2.0.
- `groq` bản `1.7.0`, yêu cầu Python `>=3.10`, license Apache-2.0.
- Pydantic AI có official Google và Groq provider integrations, typed tools, structured output
  và `UsageLimits` cho request/tool-call/output-token limits.
- Current Pydantic AI Google docs dùng trực tiếp model identifier
  `google:gemini-3.8-flash`.
- Groq official model catalog có `openai/gpt-oss-120b`; adapter identifier dự kiến là
  `groq:openai/gpt-oss-120b` và phải được xác nhận bằng provider-off/unit test trước live test.
- Google pricing page có Free Tier column cho Gemini; Groq rate-limit page có Free Plan limits.
  Điều này không chứng minh tài khoản/project của stakeholder được free-tier hoặc đã bật model.

Nguồn chính thức:

- <https://ai.pydantic.dev/install/>
- <https://ai.pydantic.dev/models/google/>
- <https://ai.pydantic.dev/models/groq/>
- <https://ai.pydantic.dev/agents/>
- <https://ai.pydantic.dev/tools/>
- <https://ai.pydantic.dev/usage/>
- <https://ai.google.dev/gemini-api/docs/models>
- <https://ai.google.dev/gemini-api/docs/pricing>
- <https://console.groq.com/docs/models>
- <https://console.groq.com/docs/rate-limits>
- <https://pypi.org/project/pydantic-ai-slim/>
- <https://pypi.org/project/google-genai/>
- <https://pypi.org/project/groq/>

## Implemented

### CI root-cause remediation

GitHub Actions run `38922505304` tại HEAD baseline có trạng thái:

- `node-quality`: failed.
- `api-e2e`: success.
- `python-quality`: success.
- `secret-scan`: success.

Root cause được tái hiện từ log: `development-seed.spec.ts` import
`development-seed.ts`; file này import `AppModule` ở module scope; `AppModule` chạy environment
validation ngay khi import. Clean CI không có ignored `apps/api/.env`, gây unhandled rejection dù
77 API assertions đã pass.

Sửa tại `apps/api/src/scripts/development-seed.ts`:

- bỏ static `AppModule` import;
- lazy import `AppModule` bên trong `main()` sau khi development-only environment guard đã pass.

Pure seed helpers không còn bootstrap toàn bộ NestJS application khi unit test import module.
Runtime seed behavior không thay đổi.

## Dependency proposal — chờ phê duyệt

Đề xuất production dependencies tối thiểu cho Phase 1B:

```toml
"pydantic-ai-slim[google,groq]==2.57.0"
"google-genai==2.31.0"
"groq==1.7.0"
```

Lý do:

- `pydantic-ai-slim`: Agent execution, typed tools, structured output, provider abstraction và
  usage limits mà không kéo toàn bộ CLI/evals/MCP/web extras của meta package `pydantic-ai`.
- `google-genai`: official Google provider client required by the Pydantic AI Google extra.
- `groq`: official Groq provider client required by the Pydantic AI Groq extra.

Dry-run `uv pip compile` với Python 3.14 đã resolve 46 packages, bao gồm các package hiện có,
không sửa `pyproject.toml` hoặc `uv.lock`. Resolver chọn `pydantic==2.14.1` và giữ được
`fastapi==0.142.2`, `pydantic-settings==2.15.0`, `uvicorn==0.54.0`, `httpx==0.28.1`.

Không đề xuất cài LangGraph, LlamaIndex, LangChain, OpenAI Agents SDK, Qdrant hoặc embedding
dependencies trong checkpoint này.

## Validation

### Passed

- `pnpm install --frozen-lockfile` — pass.
- `pnpm format:check` — pass.
- `pnpm lint` — pass.
- `pnpm typecheck` — pass.
- `pnpm test` — pass:
  - API: 16 files, 77 tests.
  - Storefront: 13 files, 38 tests.
  - Admin: 5 files, 14 tests.
- Focused seed test: 1 file, 4 tests — pass.
- API focused typecheck — pass.
- `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm build` — pass. Storefront sitemap ghi nhận
  Product API local không chạy; build vẫn hoàn tất.
- `pnpm audit:prod` — không phát hiện known vulnerability ở mức gate hiện tại.
- `uv sync --frozen` — pass.
- `uv run ruff check .` — pass.
- `uv run ruff format --check .` — pass.
- `uv run pytest -q` — 8 tests pass.

### Failed hoặc chưa chạy đủ

- `pnpm test:e2e` — fail do local MongoDB/Redis không có sẵn; 3 tests pass, 62 tests skipped,
  6 suite hooks timeout.
- `pnpm infra:up` — fail vì Docker Desktop daemon socket không tồn tại. Không tăng timeout và
  không xem skipped tests là pass.
- Local Gitleaks scan — chưa chạy vì binary `gitleaks` không được cài. Baseline remote
  `secret-scan` job tại run `38922505304` pass, nhưng thay đổi local hiện tại chưa được remote scan.
- Browser E2E — chưa chạy vì Phase 0 không có running infrastructure và không có Agent UI.
- Live Gemini/Groq inference — chưa chạy; chưa kiểm tra API keys, project quota hoặc actual
  free-tier eligibility.

## Remaining

1. Cần stakeholder phê duyệt ba production dependency pins ở trên trước khi sửa
   `apps/ai-service/pyproject.toml` và `uv.lock`.
2. Sau phê duyệt, thực hiện Phase 1A–1E theo thứ tự: shared contracts, read-only NestJS tools,
   Pydantic AI core, customer gateway, Storefront chat và end-to-end validation.
3. Live inference phải mặc định off cho tới khi provider credentials và free-tier account status
   được kiểm tra ngoài source control.
4. Cần bật Docker Desktop và chạy lại API E2E để xác nhận local infrastructure gate.
5. RAG chưa được phép bắt đầu cho tới khi có approved corpus, resource measurement và dependency
   approval riêng. Không dùng commerce records làm knowledge corpus.

## Giới hạn & điều cần kiểm chứng

- Exact Google/Groq account quota và zero-cost eligibility chưa thể suy ra từ public docs.
- Tool-calling và structured-output behavior của hai model phải được benchmark bằng account test
  mode sau khi credentials được cấu hình an toàn.
- CI fix cần được push và chạy lại GitHub Actions mới có remote confirmation.
- API E2E và browser tests cần Docker-backed MongoDB replica set/Redis hoạt động.
- Chưa có latency, quality hoặc token-usage benchmark vì Agent runtime chưa được phê duyệt để cài.
