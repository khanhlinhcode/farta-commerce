# Premium Home and Video Refinement Report

Date: 2026-10-16

## A. Problems found

- The opening split layout read as a static catalog composition rather than a campaign-led fashion storefront.
- Home sections reused similar heading and grid rhythms, so editorial, category and catalog content had weak separation.
- The Header did not establish a distinct over-campaign state and a separate readable scrolled state.
- Banner and `MediaAsset` contracts could represent images only; using an arbitrary URL or inferring video from a file extension would have bypassed the existing media lifecycle.
- The two seeded New Arrivals occupied two tracks of a four-column grid on desktop, leaving an unintended empty field.

## B. Selected visual direction

The implemented direction is **FARTA Runway Film**: a full-bleed campaign opening, warm ivory catalog passages, one dark featured-category spread, an asymmetric category composition and an oxblood typography-led brand pause. Product and campaign media remain the dominant visual material. Liquid Glass is limited to the scrolled Header and the video control.

## C. Reused components and tokens

- Reused `ProductGrid`, `ProductCard`, `MediaFrame`, `CatalogState`, `SiteHeader` and `SiteFooter`.
- Reused the existing display/body font variables, page gutters, color, border, blur, motion and focus tokens.
- Reused Lucide for navigation, CTA and playback icons; no second icon library or animation/carousel dependency was added.

## D. Header changes

- Home Header is transparent over campaign media with a contrast veil.
- Scrolling beyond 24 px applies a restrained ivory glass surface.
- Existing category data, search dialog, account, Cart query and mobile focus behavior remain intact.
- A browser regression test verifies the overlay-to-scrolled state transition.

## E. Video architecture

The stakeholder approved a backward-compatible schema extension.

- `MediaAsset.resourceType` now accepts `image` or `video`.
- Video records additionally expose validated `format`, `bytes` and `durationSeconds`.
- `Banner` has optional `desktopVideoMediaId` and `mobileVideoMediaId`; existing required poster image and optional mobile poster are unchanged.
- Admin requests a type-bound signed Cloudinary upload. The generated public ID contains the resource type, and finalization verifies the type, allowed format, response signature, exact Cloudinary resource path, byte limit and video duration.
- Public Banner DTOs expose only delivery metadata. The Storefront accepts video only from the configured Cloudinary cloud and `/video/upload/` path.
- `CampaignHeroMedia` keeps the server-rendered poster visible until video can play, uses `muted`, `playsInline`, `loop` and `preload="metadata"`, and falls back to the poster on failure.
- `prefers-reduced-motion` prevents video mounting. A native button exposes play/pause with a changing accessible name.
- CSP `media-src` permits only the configured Cloudinary origin in addition to `'self'`.

This follows Cloudinary's documented resource-type upload endpoint and signed-upload model. `resource_type` selects the endpoint and is not included in the signed parameter string. MP4 and WebM are the project allowlist.

Official references checked 2026-10-16:

- [Cloudinary upload API](https://cloudinary.com/documentation/upload_images)
- [Cloudinary signature generation](https://cloudinary.com/documentation/authentication_signatures)
- [Cloudinary video formats and transcoding](https://cloudinary.com/documentation/video_transcoding)

## F. Asset source and license

- No new photography or video asset was added.
- Runtime campaign media continues to come from stakeholder-controlled Cloudinary `MediaAsset` records.
- `apps/storefront/public/images/farta-edit-01-hero.webp` remains an AI-generated development-only fallback documented in `docs/phase-3/assets-and-licenses.md`; it is not production campaign content.
- Production video is not configured by this change.

## G. Typography hierarchy

- Campaign display is the largest role and is constrained to a short readable measure.
- Section H2, editorial copy, Product H3, prices and operational metadata remain visually distinct.
- Vietnamese-capable existing fonts and limited weights are retained.
- Heading order is covered by focused Home tests; decorative fake `01 02 03 04` indicators were removed.

## H. Section composition

- Home now follows: campaign Hero, New Arrivals, featured active category, asymmetric remaining categories, brand manifesto and Footer.
- Featured “collection” is explicitly a presentation of the first active Category; no new Collection domain was fabricated.
- New Arrivals uses an auto-fit desktop grid so two real products occupy the available width without changing Shop grids.
- No newsletter submission, live-shopping CTA, promotion, rating or review was fabricated.

## I. Responsive behavior

- Poster/video sources support separate mobile and desktop assets.
- Hero text, overlay and media crop have mobile-specific rules.
- Product cards remain two columns on small screens; featured content and categories become a deliberate vertical sequence.
- Play/pause collapses to an icon-only 44 px control with an accessible name.
- Browser coverage exercises 320, 360, 375, 390, 430, 768, 1024 and 1440 px widths and checks page overflow.

## J. Accessibility

- Hero remains a semantic section with one H1 and visible CTA.
- Video is decorative and hidden from assistive technology; meaningful title/subtitle remain HTML text.
- The playback control is a native focusable button.
- Reduced-motion users receive the stable poster.
- Header menu/search focus handling and visible focus styling are preserved and browser-tested.

## K. Performance observations

- Poster remains the LCP candidate and establishes the Hero geometry before optional video.
- Only the playback boundary is a new client component; Home data fetching remains server-side.
- Video uses metadata preload and is not mounted for reduced-motion users.
- No video bundle, carousel or animation dependency was added.
- Browser runs emitted existing `next/image` development warnings for catalog/PDP `sizes="100vw"` declarations and an above-fold catalog LCP candidate. These are recorded observations, not measured Lighthouse regressions, and should be handled in a separate image-delivery pass.
- Actual production video bytes, codec behavior and LCP impact cannot be measured until an approved Cloudinary campaign video exists.

## L. Security review

- Banner CTA validation is unchanged.
- No `dangerouslySetInnerHTML`, arbitrary remote media URL or browser Cloudinary secret was introduced.
- Image IDs cannot be assigned to video fields and video IDs cannot be assigned to poster fields.
- Referenced Banner videos are protected from media archival.
- Existing image-only Banner documents remain readable without migration.

## M. Test and build results

Final local evidence:

- `pnpm format:check`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed for all typed workspaces.
- `pnpm --filter @farta/storefront test`: 8 files, 25 tests passed.
- `pnpm --filter @farta/api test`: 16 files, 77 tests passed.
- `pnpm --filter @farta/admin test`: 4 files, 12 tests passed.
- `pnpm test:e2e`: 7 API E2E files, 64 tests passed, including the expanded catalog/media/Banner cases.
- `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm build`: API, Admin and Storefront production builds passed; Storefront generated 19 static pages/routes where applicable.
- `pnpm test:browser`: 22 tests passed in 2.0 minutes against the local production-built Storefront, API and Admin stack.
- `git diff --check`: passed.
- Visual baselines for Home desktop and mobile were deliberately regenerated after direct inspection. The browser suite also retained passing Shop, PDP, Login, Cart, Checkout and Admin baselines.
- `impeccable` detector returned no source findings; its pre-existing build-phase metadata still references an older approved comp and was not used to replace this data-driven brief.

Earlier browser attempts reused a rate-limited development API or encountered Next dev compilation/I/O timeouts. No production logic or timeout was weakened. Interrupted `CREATED` orders carrying the explicit Browser E2E recipient marker were cancelled through the authorized Admin API, and the final suite was rerun on a production-built Storefront.

## N. Known limitations

- There is no approved production campaign video, so runtime verification currently exercises the image-only Banner fallback plus component/API video tests.
- The Admin Banner workflow supports selecting optional video assets when creating a Banner; the existing Admin feature still does not provide a full edit/preview studio.
- The same configured upload byte ceiling currently applies to image and video. Production video should be compressed below that ceiling or a separately reviewed typed limit should be introduced.
- Browser tests are sensitive to local Next.js development compilation and host I/O pressure; final evidence distinguishes functional failures from environment timeouts.

## O. External assets and configuration still required

- Stakeholder-controlled desktop/mobile campaign videos uploaded through Admin to the configured Cloudinary account.
- Image posters and truthful alt text for each campaign.
- Verification of final video duration, byte size, crop/focal point and mobile bandwidth on staging.
- No secret belongs in Git or a public frontend environment variable. The existing API-only Cloudinary secret configuration remains authoritative.
