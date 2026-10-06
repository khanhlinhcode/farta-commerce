# ADR-009: FARTA design system

Status: Accepted

Build React/Next.js-native FARTA tokens and components. TheUI is a public design/interaction reference only; its Svelte implementation and assets are not copied. Liquid glass is restrained to navigation/overlays and has accessible opaque fallbacks.

## Phase 3 implementation note

- The visual system uses warm paper, ink and oxblood semantic tokens with a runway-programme editorial composition.
- Product imagery remains opaque and dominant; glass is limited to navigation, mobile/search/filter overlays and selected account surfaces.
- TheUI informed component categories and interaction principles such as responsive navigation, drawers, labelled controls and focus handling. No TheUI package, source or asset is present in the dependency tree.
- Storefront-specific composition remains local to `apps/storefront`; only genuinely cross-application primitives belong in `packages/ui`.
- Generated development imagery is documented and cannot replace stakeholder-owned Banner CMS/Product media in production.

The TheUI documentation reviewed on 2026-10-06 describes a Svelte 5/Tailwind component library and publishes an MIT license. The license permits reuse, but this implementation intentionally uses only public design principles so that FARTA keeps its React/Next.js architecture and original visual identity.
