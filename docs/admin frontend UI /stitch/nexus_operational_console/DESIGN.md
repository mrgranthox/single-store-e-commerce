# Design System Specification: The Operational Architect

## 1. Overview & Creative North Star
**Creative North Star: "The Command Deck"**
This design system moves away from the "airy" consumer-web aesthetic toward a high-density, authoritative environment. It treats the browser as a professional terminal—a place of high-stakes precision and rapid-fire data processing. Unlike standard admin templates that rely on borders to separate information, this system utilizes **Tonal Depth** and **Asymmetric Balance**. 

We do not just display data; we architect it. Through the use of deep, obsidian shells and paper-like content surfaces, we create a visceral "depth of field" that keeps the user focused on the operational core while maintaining the authority of the shell.

---

## 2. Color & Surface Architecture
The palette is built on a high-contrast relationship between the "Shell" (the dark, structural periphery) and the "Canvas" (the light, operational workspace).

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning. Structural boundaries must be defined solely by background color shifts or the proximity of elements. 
*   **The Shell:** `#0f1117` provides the foundation.
*   **The Sidebar:** `#13161e` sits atop the shell, creating a subtle lift.
*   **The Page:** `#f0f2f7` provides the wide-angle context.
*   **The Surface:** `#1a1d27` is used for high-contrast dark elements or "Control Overlays."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
1.  **Level 0 (Backdrop):** Page Background (`#f0f2f7`).
2.  **Level 1 (The Module):** Content Surface (`#f8f9fb`).
3.  **Level 2 (The Focus):** High-density cards using `surface_container_lowest` (`#ffffff`) to create a "pop" against the page background without using shadows.

### The "Glass & Gradient" Rule
To elevate the "Control Panel" feel, primary actions and high-level KPIs utilize subtle gradients.
*   **Primary CTA:** Transition from `primary` (`#1653cc`) to `primary_container` (`#3b6de6`) at a 135-degree angle.
*   **Glassmorphism:** For right-side detail drawers, use `surface_container_low` at 85% opacity with a `20px` backdrop blur to maintain the context of the underlying data table.

---

## 3. Typography: Editorial Precision
The system pairs the geometric authority of **DM Sans** with the mechanical clarity of **IBM Plex Sans**.

*   **Display & Headlines (DM Sans):** Used for KPIs and Page Titles. The 600/700 weight suggests permanence and reliability.
*   **Body & UI (IBM Plex Sans):** A "workhorse" typeface. Its slightly squared apertures make it highly legible at the small sizes required for dense data tables.
*   **Monospace (JetBrains Mono):** Used exclusively for Order IDs, SKUs, and financial figures to ensure character alignment and a "pro-tool" feel.

**Hierarchy Scale:**
- **Headline-LG (2rem):** Reserved for dashboard summaries.
- **Title-SM (1rem):** Standard card headings.
- **Label-SM (0.6875rem):** Used for metadata and table headers (always uppercase with 0.05em tracking).

---

## 4. Elevation & Depth: Tonal Layering
We reject the use of traditional drop shadows for every element. Depth is achieved through "stacking" and "Ambient Light."

*   **The Layering Principle:** Instead of a shadow, place a `surface_container_lowest` card on a `surface_dim` background. This "soft lift" reduces visual noise in dense layouts.
*   **Ambient Shadows:** For floating Modals or Tooltips, use a shadow with a 24px blur, 4% opacity, tinted with `#181b25`. It should feel like a natural occlusion of light, not a digital effect.
*   **The Ghost Border Fallback:** If a divider is functionally required in a dense table, use `outline_variant` at 15% opacity. It should be barely visible—felt rather than seen.

---

## 5. Components: Operational Primitives

### High-Density Data Tables
*   **Structure:** No vertical lines. Horizontal lines use the "Ghost Border" rule. 
*   **Spacing:** Row height at `8` (1.75rem).
*   **Typography:** Body-SM (0.75rem) for data; Monospace for numeric values.
*   **Interaction:** On hover, the row background shifts to `surface_container_high`.

### KPI Cards
*   **Visual Soul:** A 4px vertical accent bar on the left using `primary` or `success`. 
*   **Layout:** Asymmetric. The value (Headline-LG) is top-left; the trend indicator (Label-SM) is bottom-right.

### Status Badges
*   **Style:** Minimalist pills. 
*   **Detail:** A 6px solid dot (e.g., `success` #22c55e) placed to the left of the text. No background fill on the badge itself; use a "Ghost Border" to define the shape.

### Right-Side Detail Drawers
*   **Behavior:** Slides over the content area. 
*   **Surface:** Use `surface_container_lowest` with a subtle `20px` backdrop-blur on the parent page to create a "focus mode" effect.

### Login Split-Layout
*   **Left Panel:** Sidebar color (`#13161e`).
*   **Texture:** A dot-grid pattern using `#f8f9fb` at 5% opacity. The grid should align to the 8px base grid.
*   **Right Panel:** Page color (`#f0f2f7`), housing the central card.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use vertical white space (Spacing Scale `4` or `5`) instead of divider lines to separate card sections.
*   **Do** use JetBrains Mono for all SKU and currency strings to imply technical accuracy.
*   **Do** treat the sidebar as a "Dark Mode" anchor even when the main content is "Light Mode."

### Don’t
*   **Don’t** use the `xl` (16px) radius on inner components. Keep `xl` for main page containers and `sm` (4px) or `md` (8px) for internal elements like buttons and inputs.
*   **Don’t** use pure black `#000000`. The "Shell" (`#0f1117`) is our darkest point to maintain tonal richness.
*   **Don’t** allow primary buttons to have a border. Use the "Glass & Gradient" rule to provide the "pop" against the background.