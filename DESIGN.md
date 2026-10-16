# FARTA Design System

<!-- impeccable:design-schema 1 -->

## Direction

FARTA is composed like a contemporary runway programme and seasonal product dossier: decisive type, calibrated white space, full-bleed garment imagery and small pieces of operational notation. The experience is editorial without becoming a magazine pastiche; every spread still makes shopping tasks obvious.

The dominant move is the **runway film**: the opening viewport places approved campaign media behind a strong typographic title and one clear shopping action. A CMS-managed poster remains the authoritative first frame and fallback; optional silent campaign video is progressive enhancement. Product grids become the quieter catalogue after that first statement.

## Mode

- Storefront: Persuade for campaign/home surfaces; Operate for shop, product, auth and account tasks.
- Admin: Operate. It inherits tokens but not the storefront's dramatic composition.

## Palette and Material

- Canvas: warm paper `#f6f3ed`.
- Primary text: ink `#171714`.
- Surface: warm white `#fffdf8`.
- Brand accent: oxblood `#5f2c3b`, used for selected states and decisive actions rather than decoration.
- Lines: quiet warm gray `#d9d4c9`.
- Glass: warm translucent surface reserved for sticky navigation, drawers and overlays; long-form text and product cards stay opaque.
- No decorative gradients, neon effects or global blur.

## Typography

- Display voice: the current Vietnamese-capable editorial serif token, pending stakeholder-provided licensed brand fonts.
- Body/control voice: compact sans-serif with clear Vietnamese diacritics.
- Product names and headings use sentence/title case; utility labels may use restrained uppercase tracking.
- Prices use tabular numerals and remain visually adjacent to the product/variant they describe.
- Display sizes are fluid and capped; body copy remains within a readable measure.

## Composition

- Desktop uses a twelve-column editorial grid with a full-bleed campaign opening and alternating section widths.
- Catalog grids use stable 4:5 image frames; 2 columns on small mobile when cards retain usable width, 3 on tablet and 4 on desktop.
- Section rhythm alternates between dense catalog passages and quiet editorial fields. Not every section receives a card or identical wrapper.
- Navigation stays slim and spatially stable. Mobile navigation and filters are dedicated drawers, not compressed desktop menus.

## Components and State

- Product cards are image-led and borderless; information follows below the frame. Secondary imagery cross-fades only on hover-capable devices.
- Primary controls are dark ink or oxblood with high-contrast text. Secondary controls use text/line treatment.
- Chips are reserved for filters, sizes and semantic status. Touch targets remain at least 44px.
- Loading uses shape-preserving skeletons. Empty and error states keep navigation intact and offer a clear recovery action.
- Disabled future Cart/Wishlist affordances must be labelled honestly; they never simulate persisted behavior.

## Imagery

- Real Cloudinary product and banner media are authoritative.
- Banner video is optional, limited to validated Cloudinary `video/upload` assets, and always paired with an image poster. Image-only banners remain valid.
- When no CMS campaign exists, the fallback is a designed typographic composition, not invented merchandise or a fake sale.
- Development-only generated imagery must be documented as such and never presented as stakeholder-owned campaign photography.
- Use descriptive alt text from media/catalog data; decorative framing receives empty alt text.

## Motion

- One authored page moment: an approved short campaign film may autoplay muted and inline over its poster. A visible play/pause control is provided; video failure and reduced motion preserve the poster.
- Drawers and overlays communicate spatial movement; product hover transitions are subtle.
- `prefers-reduced-motion` removes nonessential movement and never hides content.

## Responsive and Accessibility

- Mobile starts at 320px and retains the same brand hierarchy with fewer columns and shorter utility copy.
- Keyboard focus uses a visible oxblood outline with offset. Menus, drawers, gallery and variant controls expose native button semantics.
- Glass surfaces gain an opaque fallback and image overlays are strong enough to preserve contrast.
- Forms use persistent labels, programmatic error associations and safe human-readable API errors.

## Reference Boundary

TheUI informed drawer placement, controlled overlays, keyboard activation and responsive navigation. No TheUI source, assets or Svelte packages are copied. The runway-programme composition and FARTA tokens are original to this implementation.
