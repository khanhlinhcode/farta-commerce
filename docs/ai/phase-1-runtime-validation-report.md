# FARTA AI Agent V4.1 — Runtime Validation

Ngày kiểm tra: 2026-10-19

## Scope

Kiểm chứng Product Advisor ở provider-off mode bằng MongoDB replica set, Redis,
NestJS API, FastAPI/Pydantic AI, Next.js Storefront và Chromium. Không gọi Gemini,
Groq hoặc dịch vụ trả phí.

## Evidence

| Gate                                | Kết quả                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `pnpm infra:up`                     | MongoDB và Redis healthy; replica-set init hoàn tất     |
| `pnpm --filter @farta/api test:e2e` | 7 files, 65 tests pass                                  |
| AI-targeted Playwright              | 4/4 pass                                                |
| Full development-mode Playwright    | 26/26 pass trước khi thêm AI visual baseline            |
| Full production-artifact Playwright | 27/27 pass sau API-backed Storefront build              |
| API unit/security                   | 18 files, 82 tests pass                                 |
| Storefront component                | 14 files, 40 tests pass                                 |
| Admin regression                    | 5 files, 14 tests pass                                  |
| FastAPI                             | Ruff pass; Pytest 25/25 pass                            |
| Build                               | API, Admin và Storefront pass                           |
| Production dependency audit         | Không phát hiện known vulnerability ở ngưỡng configured |

## Signed end-to-end path

1. Browser gửi `POST /api/v1/ai/chat` cùng trusted same-origin context.
2. NestJS cấp/bắt buộc conversation ownership, giới hạn rate và ký raw request cho FastAPI.
3. FastAPI deterministic router chọn fixed read-only Product tool.
4. Commerce client ký raw request tới NestJS internal Tool Gateway.
5. NestJS xác minh HMAC/timestamp/audience/nonce bằng Redis rồi truy vấn public Product read model.
6. NestJS customer gateway hydrate lại slug trước khi trả Product Card cho browser.

Browser test xác minh thêm provider-off complex advice fail closed, untrusted Origin
bị từ chối, unsigned internal tool bị từ chối và AI không xuất hiện trong Checkout.

## Visual, responsive và accessibility evidence

- Desktop visual baseline: 1440×900.
- Mobile visual baseline: 390×844.
- Functional mobile bound: 320×568, không horizontal overflow.
- Native dialog nhận focus ở input, Escape/close trả focus về trigger.
- Product navigation đóng dialog trước khi hiển thị PDP.
- Product images, semantic availability và VND price đến từ authoritative catalog response.

Đây không phải bằng chứng WCAG conformance đầy đủ. Chưa có manual screen-reader,
real-device, Firefox hoặc WebKit pass.

## Build-time finding

Production visual run đầu tiên lệch baseline vì Storefront đã được build trong lúc API
không hoạt động; static Home chứa fallback campaign cho tới ISR. Build lại khi API healthy:

```bash
API_INTERNAL_URL=http://localhost:4000 pnpm --filter @farta/storefront build
E2E_API_MODE=production E2E_STOREFRONT_MODE=production pnpm test:browser
```

cho kết quả 27/27 pass. Staging pipeline phải bảo đảm `API_INTERNAL_URL` khả dụng trong
build nếu muốn pre-render CMS/catalog content; fallback vẫn phải được xem là degraded state,
không phải release baseline.

## Remaining risks

- Không có live-provider quality, quota, privacy, token hoặc latency evidence.
- Inbound FastAPI replay cache vẫn là in-process; multi-instance cần shared replay control.
- Một run ghi nhận Next.js log `destination stream closed early` trong lúc test chuyển route
  nhanh; không gây test failure nhưng cần triage riêng nếu tái hiện ngoài test harness.
- Chưa có staging TLS/proxy/secrets/managed Redis validation.
- Không có cross-browser hoặc real-device evidence.
