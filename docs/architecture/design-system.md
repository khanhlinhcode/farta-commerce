# TheUI reference and FARTA design-system strategy

## Research boundary

TheUI is used only as a design and interaction reference. Its public documentation presents a Svelte/Tailwind component library, including responsive navbar/mega-menu behavior, drawers, tabs and keyboard/ARIA guidance:

- https://www.theui.dev/
- https://www.theui.dev/docs/navbar
- https://www.theui.dev/docs/drawer
- https://www.theui.dev/docs/tabs

FARTA will not install `theui-svelte`, change framework, copy source/assets, or claim compatibility. No third-party TheUI code is currently reused, so no TheUI license obligations are introduced. If source is adapted later, its exact version and license must be verified and recorded before merge.

## Product direction

FARTA is premium fashion editorial commerce: photography leads, typography creates hierarchy, and controls stay quiet. It must not resemble a SaaS/AI dashboard or a component showcase.

### Visual principles

- restrained neutral palette with one brand accent;
- editorial display type paired with a highly legible UI/body type;
- generous but responsive whitespace;
- product imagery uses stable aspect ratios and meaningful alt text;
- liquid glass only for floating/navigation/overlay surfaces;
- no blur behind long-form product data, prices, form fields or tables;
- motion communicates spatial transition and respects `prefers-reduced-motion`.

## Token architecture

`packages/design-tokens` exports framework-neutral CSS variables and typed metadata:

- primitive palette and semantic colors (`background`, `surface`, `text`, `border`, `accent`, status colors);
- typography families, sizes, line-heights, weights and tracking;
- spacing, container widths, radii, shadows, z-layers;
- glass surface opacity/border/blur/fallback;
- duration/easing and reduced-motion alternatives.

Components consume semantic tokens, never raw brand hex values or arbitrary shadows. Storefront and admin themes share accessibility primitives but have separate composition/density tokens.

## Component ownership

- shadcn/ui code may be generated into each React stack only after version/license review.
- `packages/ui` contains genuinely shared React primitives with accessible behavior: `Button`, `Input`, `FormField`, `Dialog`, `Drawer`, `Surface`, `GlassSurface`, `Container`.
- Product cards, checkout steps, admin tables and domain components remain in their applications until reuse is proven.
- Next.js Server Components do not import a client-only shared entry point; package exports separate server-safe styles/types from interactive components.

## Interaction adaptations from TheUI

| Reference idea                             | FARTA adaptation                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| responsive navbar and full-width menu      | editorial desktop mega menu; mobile navigation drawer; click/keyboard primary interaction |
| drawer positions and controlled open state | cart/filter/account sheets with focus trap, return focus and scroll lock                  |
| typed variants                             | small documented variants backed by semantic tokens, not arbitrary class passthrough APIs |
| tab relationships                          | WAI-ARIA tab semantics for account/product details only when content is genuinely tabbed  |
| keyboard disclosure behavior               | Enter/Space activation, Escape close and visible focus across menus/dialogs               |

## Accessibility acceptance

- WCAG 2.2 AA target, including contrast, reflow, focus visibility and target size.
- Semantic HTML first; ARIA supplements behavior rather than replacing semantics.
- Dialog/drawer focus lifecycle and background inertness are tested.
- Validation errors are programmatically associated and announced.
- Glass fallback remains readable without backdrop-filter.
