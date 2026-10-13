# Phase 4.1C-B Browser Responsive Review

Date: 2026-10-13

## Viewport matrix

The Storefront route matrix was exercised at:

- 320×568
- 360×800
- 375×812
- 390×844
- 430×932
- 768×1024
- 1024×768
- 1440×900

Routes: Home, Shop, seeded Product detail, Cart, Checkout, Order Lookup and Login. Admin Category, Product, Media and Order routes were checked at 320×568, 768×1024 and 1440×900.

## Assertions and reviewed baselines

- `documentElement.scrollWidth <= clientWidth + 1` on every route/viewport pair;
- mobile menu, Search and filter drawer remain reachable and keyboard operable;
- Product color/size controls remain usable without relying on hover;
- Cart and Checkout preserve readable single-column flow on mobile;
- Admin navigation, tables and forms stay inside the page viewport;
- reviewed fixed-viewport baselines cover Home, Shop, Product detail, Cart, Checkout, Login, Admin catalog and Admin order detail.

## Defects found and fixed

1. At 320 px the Admin sidebar/navigation could widen the page. The mobile sidebar now allows grid shrinkage and clips its own horizontal overflow while its navigation is width-bounded.
2. At narrow widths Search disappeared because a positional selector hid the first header tool. The header now uses an explicit compact grid and keeps every required action visible.
3. Checkout/order fill images lacked a positioned media wrapper, allowing the absolute image layer to overlap controls. The wrapper now establishes the correct containing block.
4. Visual capture could retain a form-focused scroll position. The baseline helper now waits for fonts/images/network stability and explicitly captures from the top.

## Result and limitations

No horizontal page overflow was observed in the automated matrix. The reviewed snapshots use Vietnamese locale, Asia/Ho_Chi_Minh timezone, reduced nondeterminism and real development Cloudinary images.

This is Chromium coverage only. WebKit, Firefox, physical iOS/Android browser testing and device-specific browser chrome remain deferred. Visual baselines are local Chromium release evidence, not production Core Web Vitals or Lighthouse evidence.
