# Admin Design System — E-Commerce Control Panel
## Import this into EVERY Stitch batch project before generating screens

---

## Brand & Identity
- Product: Enterprise E-Commerce Admin Panel
- Audience: Internal operations staff, admins, support agents, executives
- Tone: Authoritative, dense, operational — not consumer-friendly, not playful
- Density: High information density. Every pixel earns its place.

---

## Color System

### Core Palette
```
--color-bg-shell:       #0f1117   /* App outer background */
--color-bg-sidebar:     #13161e   /* Primary sidebar */
--color-bg-surface:     #1a1d27   /* Cards, panels, modals */
--color-bg-elevated:    #20243a   /* Hover rows, drawers */
--color-bg-content:     #f8f9fb   /* Main content region */
--color-bg-page:        #f0f2f7   /* Page background in content */

--color-primary:        #4f7ef8   /* Primary actions, links, active nav */
--color-primary-hover:  #3b68e0   /* Primary hover state */
--color-primary-muted:  #1e3a8a22 /* Primary tint for backgrounds */

--color-success:        #22c55e
--color-warning:        #f59e0b
--color-danger:         #ef4444
--color-info:           #38bdf8

--color-text-primary:   #f1f3f9   /* Sidebar text */
--color-text-secondary: #8891aa   /* Sidebar muted text */
--color-text-dark:      #0f1117   /* Content area headings */
--color-text-body:      #374151   /* Content area body text */
--color-text-muted:     #6b7280   /* Labels, metadata */

--color-border-dark:    #252a3d   /* Sidebar dividers */
--color-border-light:   #e5e7eb   /* Content area borders */
--color-border-focus:   #4f7ef8   /* Input focus ring */
```

### Status Badge Colors
```
active/completed:    bg #dcfce7, text #166534
pending/processing:  bg #fef9c3, text #854d0e
failed/cancelled:    bg #fee2e2, text #991b1b
draft/inactive:      bg #f1f5f9, text #475569
warning/at-risk:     bg #fff7ed, text #9a3412
```

---

## Typography

### Font Stack
- **Display / Headings**: `"DM Sans", sans-serif` — weight 600, 700
- **Body / Labels**: `"IBM Plex Sans", sans-serif` — weight 400, 500
- **Monospace / Code / IDs**: `"JetBrains Mono", monospace` — weight 400

### Type Scale
```
--text-xs:    11px / 1.4  /* Table metadata, timestamps */
--text-sm:    13px / 1.5  /* Table cells, labels, badges */
--text-base:  14px / 1.6  /* Body text, descriptions */
--text-md:    16px / 1.5  /* Section titles, form labels */
--text-lg:    20px / 1.3  /* Page titles */
--text-xl:    26px / 1.2  /* Dashboard KPI numbers */
--text-2xl:   36px / 1.1  /* Hero stat numbers */
```

---

## Spacing System (8px base grid)
```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
```

---

## Border Radius
```
--radius-sm:   4px   /* Badges, small chips */
--radius-md:   8px   /* Cards, inputs, buttons */
--radius-lg:   12px  /* Modals, drawers, panels */
--radius-xl:   16px  /* Dashboard cards */
--radius-full: 9999px /* Pills, avatars */
```

---

## Shadows
```
--shadow-card:   0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)
--shadow-panel:  0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)
--shadow-modal:  0 20px 60px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.12)
--shadow-sidebar: 2px 0 12px rgba(0,0,0,0.20)
```

---

## App Shell Layout

### Sidebar (Fixed Left, 240px wide)
```
Background: #13161e
Width: 240px (collapsed: 64px)
Position: fixed, full height
Shadow: var(--shadow-sidebar)

Regions:
  - Logo area (height: 60px) — product wordmark + icon
  - Nav groups (flex-grow) — grouped with section labels
  - Bottom zone (height: 80px) — user avatar + name + role badge
```

### Sidebar Nav Item States
```
Default:   text #8891aa, icon #5a6280, no background
Hover:     text #c8d0e8, bg rgba(255,255,255,0.05)
Active:    text #fff, bg rgba(79,126,248,0.18), left border 3px #4f7ef8
```

### Sidebar Nav Groups
```
Overview
Catalog
Inventory
Orders
Payments
Customers
Support
Content
Marketing
Reports
Security & Audit
System
```

### Header (Fixed Top in Content Region)
```
Background: #ffffff
Height: 60px
Border-bottom: 1px solid #e5e7eb
Shadow: 0 1px 4px rgba(0,0,0,0.06)

Left:  Breadcrumb (chevron-separated, max 3 levels)
Right: Search icon → Alert bell (badge) → Support indicator → Avatar menu
```

### Content Area
```
Margin-left: 240px
Min-height: 100vh
Background: #f0f2f7
Padding: 24px
```

---

## Core Components

### Page Header
```
Rendered inside content area below the fixed header
Contains:
  - Page title (DM Sans 700, 20px, color #0f1117)
  - Subtitle / description (IBM Plex Sans 400, 13px, color #6b7280)
  - Right-side primary action button
  - Optional filter pills if quick filters apply
Margin-bottom: 24px
```

### Stat / KPI Card
```
Background: #ffffff
Border-radius: 12px
Padding: 20px 24px
Shadow: var(--shadow-card)
Border: 1px solid #e5e7eb

Contents:
  - Icon (24px, colored per metric category)
  - Label (IBM Plex Sans 500, 12px, uppercase, #6b7280, letter-spacing 0.05em)
  - Value (DM Sans 700, 28px, #0f1117)
  - Delta badge (trend %, colored green/red)
  - Sparkline (optional, muted)
```

### Data Table
```
Container background: #ffffff
Border-radius: 12px
Shadow: var(--shadow-card)
Border: 1px solid #e5e7eb
Overflow: hidden

Header row:
  Background: #f8f9fb
  Font: IBM Plex Sans 600, 12px, uppercase, #6b7280, letter-spacing 0.04em
  Height: 44px
  Border-bottom: 1px solid #e5e7eb

Body rows:
  Height: 52px
  Font: IBM Plex Sans 400, 13px, #374151
  Border-bottom: 1px solid #f1f3f9
  Hover: background #f8f9fb

Monospace columns (IDs, SKUs, codes):
  Font: JetBrains Mono 400, 12px, #374151

Columns always include: checkbox (left), actions menu (right)
```

### Filter Bar
```
Background: #ffffff
Border: 1px solid #e5e7eb
Border-radius: 8px
Padding: 12px 16px
Margin-bottom: 16px
Display: flex, gap 12px, align-center

Contains:
  - Search input (flex-grow, icon left)
  - Filter dropdowns (compact, 140px wide each)
  - Date range picker
  - "Clear filters" ghost text button (appears only when filters active)
  - Results count chip (right side)
```

### Status Badge
```
Display: inline-flex, align-center
Padding: 2px 8px
Border-radius: 4px
Font: IBM Plex Sans 600, 11px, uppercase, letter-spacing 0.04em

Use the status badge color system defined above.
Add a 6px dot (●) before the text for operational statuses.
```

### Primary Button
```
Background: #4f7ef8
Color: #ffffff
Font: IBM Plex Sans 600, 13px
Padding: 8px 16px
Border-radius: 8px
Height: 36px
Hover: #3b68e0, translateY(-1px)
```

### Destructive Button
```
Background: transparent
Border: 1px solid #ef4444
Color: #ef4444
On hover: background #fee2e2
```

### Timeline Component
```
Container: left-border timeline (2px solid #e5e7eb)
Event item:
  - Circle indicator (10px, colored by event type)
  - Timestamp (JetBrains Mono, 11px, #9ca3af)
  - Actor (IBM Plex Sans 600, 13px, #374151)
  - Description (IBM Plex Sans 400, 13px, #6b7280)
  - Optional: linked entity chip
Gap between events: 20px
```

### Confirmation Modal
```
Overlay: rgba(0,0,0,0.5) blur(2px)
Modal: background #fff, border-radius 12px, shadow var(--shadow-modal), max-width 480px
Header: entity summary with icon
Body: impact note, optional reason textarea
Footer: [Cancel ghost] [Confirm primary or destructive]
```

### Right-Side Detail Drawer
```
Width: 480px
Background: #ffffff
Shadow: var(--shadow-modal)
Slide in from right (transform translateX animation, 200ms ease)
Header: entity name + close button
Body: scrollable section panels
Footer: action buttons
```

---

## Icon System
Use Lucide icons throughout. Icon sizes: 16px (inline), 18px (nav), 20px (buttons), 24px (cards).

---

## Responsive Target
Desktop-first. Target: 1280px+ minimum content width.
Sidebar collapses to 64px icon-only below 1024px.
Tables scroll horizontally on smaller screens.

---

## Motion & Animation
```
Transition base: 150ms ease
Hover elevations: translateY(-1px) on cards and buttons
Page entry: fade-in + translateY(8px → 0), 200ms
Drawer slide: translateX(100% → 0), 200ms ease-out
Modal scale: scale(0.97 → 1) + opacity, 180ms
Skeleton shimmer: linear-gradient animation, 1.5s infinite
```

---

## Empty States
Every list/queue screen must show an empty state:
```
Icon (40px, muted color)
Heading: "No [entities] found"
Sub: Context-aware description
Optional: primary CTA button
```

---

## Loading Skeletons
```
Background: linear-gradient(90deg, #f0f2f7 25%, #e5e7eb 50%, #f0f2f7 75%)
Background-size: 200% 100%
Animation: shimmer 1.5s infinite
Border-radius: matches the component being loaded
```

---

## Data Density Rules
- Table rows: never exceed 8 columns visible by default
- KPI cards: 4 across on full desktop
- Queue screens: show action buttons inline on row hover
- Detail pages: use 2-column layout (main content 65% + summary panel 35%)
- Modals: never exceed 560px width for forms, 720px for data views
