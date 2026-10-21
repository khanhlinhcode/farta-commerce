# Phase 5E — Cross-browser release validation

Date: 2026-10-21

Browser-emulation verdict: **PASS**. Physical-device verdict: **BLOCKED / not
executed**.

## Final passing runs

| Runtime                            | Evidence                                                     | Result                      |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Chromium on local macOS Playwright | full staging suite, one worker                               | 31/31 passed in 7.1 minutes |
| Firefox on GitHub-hosted Linux     | workflow `39566128658`, job `119108714932`, commit `5125611` | 27/27 passed in 2.3 minutes |
| WebKit on local macOS Playwright   | full staging suite, one worker                               | 27/27 passed in 6.7 minutes |

Chromium includes the four visual-regression groups. Firefox/WebKit exclude
Chromium pixel snapshots by the existing configuration but run the functional,
responsive, accessibility-oriented and security flows.

## Covered flows and viewports

The suites cover Home/Product discovery, search/filter/sort, real variant
selection, server Cart, Cart merge, COD checkout, guest lookup, customer orders,
Admin login/catalog/order transition, Admin denial, CSRF, customer-order BOLA,
client-total tampering, provider-off Product Advisor and signed AI boundary.

Responsive assertions cover 320×568, 360×800, 375×812, 390×844, 430×932,
tablet portrait and 1440×900. Checks include horizontal overflow, mobile
navigation/search/filter focus, form labels/error association, touch targets,
reduced motion, Admin containment and checkout usability. No Lighthouse or
accessibility score is claimed.

## Defects found and fixed

1. The responsive test previously navigated every route once per viewport,
   creating 56 server navigations. It now navigates each of seven routes once
   and resizes through all required widths; coverage is retained with bounded
   load.
2. The BOLA test reused a logged-out context for customer B. It now uses a
   separate browser context, matching the object-ownership threat model.
3. The Admin transition assertion used `getByText("CONFIRMED").first()` and
   could select a hidden `<option>` rather than the visible status badge. The
   locator is now scoped to `.status-cluster .status`; transition persistence
   passes before and after reload.

An initial Chromium diagnostic run during an automatic Northflank deployment
recorded 28 passes and three failures (one hidden-locator issue, one API
connection reset and one catalog fallback screenshot). After the deployment
stabilized, the focused visual groups passed 7/7, the locator fix passed 1/1,
and the full suite passed 31/31. This diagnostic is retained rather than hidden
or reclassified as a passing run.

## Data cleanup and device limitation

Failed browser runs can leave valid COD test orders. The exact development
recipient marker and recent creation window were used to find them; 17 such
orders across Phase 5E browser attempts were cancelled through the authorized
Admin endpoint with an audit reason. No database record was deleted.

No physical iPhone, Android phone, tablet or screen reader was exercised in
this phase. Browser viewport emulation is not physical-device evidence.
