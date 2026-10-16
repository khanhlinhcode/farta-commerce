# Admin operations remediation report

Date: 2026-10-16

## Implemented operations

- Route-level lazy loading now splits Dashboard, Categories, Products, Product detail/Variants, Media, Banners and Orders from the Admin entry chunk.
- Category UI supports bounded pagination, search/status filters, create/edit, parent/image/sort-order fields and an accessible archive confirmation.
- Product UI supports bounded pagination, category/status filters, multi-category create/edit, descriptions, tags, SEO, cover selection, lifecycle state, archive and ACTIVE-only public preview.
- Variant UI supports create/update/archive, integer VND price, compare price, color/color code, size, image, low-stock threshold and the existing separate audited inventory adjustment.
- Media UI supports bounded server pagination, image/video filters, preview, upload and protected archive. `MEDIA_IN_USE` remains a safe API conflict rather than provider deletion.
- Banner UI supports create/edit/archive, poster/video selection, CTA, schedule, priority, state, desktop/mobile preview and permission-aware publish controls.
- All new mutations continue through the authenticated Admin API transport, which attaches the staff CSRF token. Backend permission guards and audit recording remain authoritative.

## Accessibility

- Destructive Category/Product/Banner actions use a shared `alertdialog` that labels itself, moves focus inside, closes on Escape and restores focus.
- Media and Banner fields now use stable IDs and programmatic labels; Banner primary validation errors use `aria-invalid` and `aria-describedby`.
- Reusable media-picker and pagination controls have keyboard-operable 44px targets. Browser `alert()`/`confirm()` were not introduced.

## Build evidence

The current production Admin build emits feature chunks, including 4.71 kB Media, 5.21 kB Products, 6.27 kB Categories, 9.92 kB Banners and 10.45 kB Product detail before gzip. The shared entry was 461.15 kB (144.57 kB gzip). No before-change chunk capture was retained, so this report does not claim a measured percentage improvement.

## Tests and limitations

- Admin unit/component suite passed after the final paginated picker extraction: 5 files, 14 tests.
- API E2E verifies media bounds/type filters, Banner schedule validation and server permission rejection for publish without `banner.publish`.
- Permission-aware UI improves affordances only; backend guards remain the security boundary.
- The quiet-host production-mode Chromium run passed all 22 release tests, including Admin responsive containment and reviewed catalog/order visual baselines; see `browser-test-isolation-report.md`.
