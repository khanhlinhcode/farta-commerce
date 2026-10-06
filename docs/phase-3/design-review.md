# Phase 3 design review

Date: 2026-10-06

## FARTA visual principles

The storefront uses a runway-programme/editorial direction: warm paper canvas, ink typography, restrained oxblood accents, calibrated whitespace, asymmetric hero composition and 4:5 product imagery. Catalog tasks remain quieter and more operational than the homepage.

## System decisions

- Display, heading, body, label, caption and price roles are expressed through shared semantic tokens and local storefront classes.
- Containers, gutters and section rhythm vary intentionally while retaining shared alignment anchors.
- Product cards remain borderless and photography-led. Secondary media cross-fades only on hover-capable devices.
- Liquid Glass appears on navigation, drawers, search/filter overlays and selected elevated surfaces. Product copy and long-form content remain opaque.
- Motion is short, CSS-first and removed under `prefers-reduced-motion`.
- The temporary FARTA wordmark is text/CSS, not presented as a stakeholder-approved logo.

## TheUI reference boundary

TheUI was reviewed for its public responsive navigation, drawer, form, accessibility and typed-component principles. Its official documentation identifies the available implementation as Svelte 5/Tailwind and publishes an MIT license. FARTA did not install that package, copy its source, reuse its assets or adopt its branding. All shipped components are React/Next.js-native and original to this repository.

## Responsive review

The desktop home and Shop surfaces were reviewed in Safari. A narrow mobile viewport was then checked through the accessibility tree: navigation collapses to a labelled menu, filters use a dedicated drawer, search uses a modal surface and focus moves to the relevant close/input control. CSS covers 320–430px mobile gutters, tablet grids and bounded wide-desktop layouts.

## Intentionally not implemented

No fake sale, rating, review, wishlist, cart content, order history, recommendation engine or analytics backend was added. Homepage sections collapse to real-data empty/error states when the API is empty or unavailable.

## Remaining brand decisions

- final logo and licensed brand font;
- stakeholder-owned campaign/product photography;
- configured policy/social/contact destinations;
- final Vietnamese editorial copy and size-guide content ownership.

No automated pixel-diff baseline was committed. Visual inspection was performed, but the internal comp workflow is explicitly recorded with a `recapture` disposition rather than a false pass. Screenshot regression remains a follow-up when a stable browser runner and deterministic catalog fixture are available.
