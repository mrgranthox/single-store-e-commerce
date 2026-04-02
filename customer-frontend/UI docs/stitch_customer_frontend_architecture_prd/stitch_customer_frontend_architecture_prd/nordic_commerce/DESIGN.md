```markdown
# Design System Strategy: The Editorial Storefront

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Atelier."** 

We are moving away from the cluttered, "boxed-in" feel of traditional e-commerce. Instead, we treat the storefront as a high-end editorial spread. The aesthetic is defined by **intentional asymmetry, expansive breathing room, and tonal depth.** By utilizing a sophisticated palette of deep navy and charcoal against cool-toned surfaces, we establish an immediate sense of institutional trust and modern luxury.

This system rejects the "template" look. We break the grid with overlapping elements—such as product imagery bleeding into container margins—and utilize a dramatic typography scale to guide the eye through a curated narrative rather than a mere list of items.

## 2. Colors & Surface Philosophy
The palette is built on a foundation of sophisticated blues (`primary_container: #131b2e`) and crisp neutrals.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. Use `surface_container_low` for secondary sections sitting atop a `surface` background. This creates a seamless, high-end feel that mimics architectural planes rather than a digital wireframe.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers to create organic depth:
*   **Base Layer:** `surface` (#f8f9ff)
*   **In-Page Sections:** `surface_container_low` (#eff4ff)
*   **Interactive Cards:** `surface_container_lowest` (#ffffff) to create a subtle "lift" against the page.
*   **Overlays/Modals:** `surface_container_highest` (#d3e4fe)

### The "Glass & Gradient" Rule
To elevate the storefront above standard retail sites, use Glassmorphism for floating navigation and quick-cart elements. Use semi-transparent versions of `surface_container` with a `backdrop-blur` of 12px–20px. 
*   **Signature Textures:** Apply a subtle linear gradient from `secondary` (#0051d5) to `secondary_container` (#316bf3) for primary CTAs. This adds "visual soul" and a tactile, prismatic quality to conversion points.

## 3. Typography
We use a dual-font system to balance editorial character with functional clarity.

*   **Display & Headlines (Manrope):** Our "Authoritative" voice. Use `display-lg` (3.5rem) with tight tracking (-2%) for hero sections. The geometric nature of Manrope conveys modernity and precision.
*   **Body & UI (Inter):** Our "Functional" voice. Inter is used for all utility text, product descriptions, and labels. It ensures maximum readability at small sizes, particularly for `body-sm` (0.75rem) legal and metadata text.
*   **Hierarchy as Brand:** Use `headline-sm` for product titles to create a bold, "magalog" style. Contrast this with `label-md` in all-caps with 5% letter spacing for category tags to denote premium curation.

## 4. Elevation & Depth
Traditional drop shadows are too "software-like" for this brand. We achieve hierarchy through **Tonal Layering.**

*   **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` section. The change in hex code provides enough contrast to signify a new layer without visual "noise."
*   **Ambient Shadows:** If a floating effect is required (e.g., a "Buy Now" sticky bar), use an extra-diffused shadow: `y: 20px, blur: 40px, spread: -5px, color: rgba(11, 28, 48, 0.06)`. Note the use of `on_surface` (#0b1c30) for the shadow tint rather than pure black.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` (#c6c6cd) at 20% opacity. Never use 100% opaque borders.

## 5. Components

### Buttons
*   **Primary:** Solid `primary` (#000000) or `secondary` (#0051d5). Shape: `md` (0.375rem). Padding: `spacing-3` (vertical) by `spacing-6` (horizontal). 
*   **Secondary:** `surface_container_low` background with `on_surface` text. No border.
*   **Tertiary:** Text-only with an underline that appears on hover, using `secondary` color.

### Product Cards
*   **Structure:** Forbidden: Divider lines or 1px borders. Use `spacing-4` (1.4rem) of internal padding.
*   **Imagery:** High-aspect ratio images. On hover, the image should subtly scale (1.05x) within its container (overflow-hidden).
*   **Badges:** Use `tertiary_fixed` (#ffddb8) for "New" or "Sale" badges—the warmth of the tertiary color provides a high-contrast pop against the cool blues.

### Form Inputs
*   **Styling:** Fill-only. Use `surface_container_high` (#dce9ff) as the field background. 
*   **Focus State:** Transition the background to `surface_container_lowest` and apply a 2px "Ghost Border" of `secondary`. 

### Trust & Social Proof
*   **Review Stars:** Use `tertiary` (#000000) for a sophisticated look, or `on_tertiary_container` (#b87500) for a classic gold that maintains high contrast against the background.
*   **Security Badges:** Monochromatic icons using `outline` (#76777d) to stay present but non-distracting.

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins (e.g., `spacing-24` on the left, `spacing-16` on the right) for hero layouts to create a bespoke feel.
*   **Do** prioritize touch-targets of at least 44x44px, especially for mobile quantity selectors and filter chips.
*   **Do** use `surface_dim` (#cbdbf5) for footer backgrounds to ground the application with a heavy, stable base.

### Don’t
*   **Don't** use card shadows on a white background; use `surface_container_low` as the background and `surface_container_lowest` for the card.
*   **Don't** use standard "Blue" for links. Use the `secondary` (#0051d5) token, which is tuned for the sophisticated charcoal palette.
*   **Don't** clutter the view with dividers. If content feels merged, increase the vertical spacing using `spacing-10` (3.5rem) or `spacing-12` (4rem).```