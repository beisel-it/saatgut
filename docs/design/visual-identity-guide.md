# Saatgut Visual Identity Guide

## Purpose

Saatgut should feel like a practical growing companion, not a glossy startup dashboard. The visual system needs to communicate calm competence, physical garden work, and reliable planning. The interface should feel field-ready, slightly tactile, and trustworthy enough for repeated seasonal use.

This guide documents the current visual language already shipped in the app and sets the intended rules for future UI work.

## Brand Character

- Practical rather than ornamental
- Calm rather than loud
- Warm rather than sterile
- Grounded rather than futuristic
- Knowledgeable without sounding technical

The product should evoke seed envelopes, handwritten garden notes, planting plans, and well-used reference books. It should not drift into enterprise-console aesthetics or generic SaaS polish.

## Color System

### Core Palette

- `Foreground`: `#183128`
  - Deep evergreen used for text, strong actions, and structural contrast.
- `Background`: `#f4efe3`
  - Warm parchment tone used as the main app ground.
- `Muted`: `#fdf9f0`
  - Light cream used for cards, soft panels, and quieter surfaces.
- `Accent`: `#7f9b47`
  - Garden olive used for focus rings, highlights, and active emphasis.
- `Accent Strong`: `#45633f`
  - Dark moss green used for eyebrows, high-emphasis labels, and grounded visual anchors.
- `Border`: `rgba(24, 49, 40, 0.14)`
  - Soft structural edge rather than crisp hard-line chrome.
- `Shadow`: `0 20px 45px rgba(24, 49, 40, 0.12)`
  - Broad, quiet depth with low drama.

### Usage Rules

- Large background areas should stay warm and low-contrast. Avoid flat pure white full-screen surfaces when the parchment base can do the job.
- Use `Foreground` for primary reading contrast and strong controls.
- Use `Accent` for focus, positive emphasis, and active states, not as a constant decoration color.
- Use `Accent Strong` for section eyebrows and compact emphasis where tone should feel cultivated and intentional.
- Keep warning and success states readable, but they should remain secondary to the core evergreen and parchment system.
- Avoid introducing bright synthetic colors unless they represent a real semantic need.

### Contrast Behavior

- Main reading text should remain dark evergreen on warm light surfaces.
- Inverse surfaces may use white text on deep evergreen, especially in navigation and auth areas.
- Muted cream surfaces should never collapse into low-contrast beige-on-beige layouts; retain clear text separation.

## Typography

### Type Family

- Primary UI font: `"Trebuchet MS", "Segoe UI", sans-serif`

The current type choice is intentionally slightly human and familiar rather than ultra-neutral. It supports the product’s practical, notebook-adjacent tone.

### Typographic Tone

- Headlines should be concise, confident, and structurally clear.
- Supporting copy should explain intent without sounding like documentation.
- Labels should help users act, not expose implementation terminology.
- Uppercase eyebrow labels are acceptable in small doses for rhythm and orientation.

### Heading Guidance

- Use shorter primary headlines with supporting text underneath rather than long multi-line hero statements.
- Desktop headings should be width-constrained to prevent shallow, awkward wraps.
- Avoid oversized hero behavior unless the screen truly needs a strong orientation moment.

### Copy Style

- Prefer gardener-facing language over backend or workflow terminology.
- Use active, direct phrasing.
- Good examples:
  - "Store it cooler"
  - "What needs attention now."
  - "Add a newly bought seed packet"
- Avoid wording that sounds like:
  - system contract
  - transaction surface
  - journal mutation
  - operational record

## Spacing System

### General Rhythm

- The UI should breathe, but not drift into oversized empty luxury spacing.
- Card and panel interiors should usually feel compact-to-comfortable, not airy for its own sake.
- Mobile should prioritize fast orientation and reduced vertical waste.

### Layout Guidance

- Section-level spacing should clearly separate major workflows.
- Filter bars and browsing controls should sit close to the content they affect.
- Dense information views should use stacked grouping and consistent gaps instead of excessive divider noise.

### Dashboard Behavior

- The overview should read as a working status surface, not a marketing hero.
- Summary metrics should live inside the sections they describe whenever possible.

## Radius and Shape Language

### Principle

The interface should feel restrained and crafted, not pill-heavy.

### Rules

- Default control radius is moderate and softened, currently around `0.65rem` for inputs.
- Cards and panels may use slightly larger rounding for warmth, but corners should stay controlled.
- Chips, pills, and badges should not dominate the shape language.
- Avoid exaggerated fully-rounded components unless there is a strong semantic reason.

### Visual Effect

Rounded shapes should suggest paper tabs, labeled envelopes, and field tools. They should not make the product feel bubbly or toy-like.

## Surface and Depth Language

- Prefer layered cream and parchment surfaces over stark monochrome panels.
- Use shadows sparingly and broadly, not as sharp floating card effects.
- Borders should remain soft and quiet, more like structural guides than hard boxes.
- Deep evergreen surfaces are best reserved for strong anchors like auth panels and navigation.

## Component Tone

### Navigation

- Navigation should feel steady and dependable.
- Desktop navigation can be anchored and substantial.
- Mobile navigation should be compact first, expanded on demand.

### Forms

- Forms should explain intent through grouping and short helper text.
- Avoid backend-model order if a real user thinks in a different sequence.
- Inputs should feel editable and tactile, not clinical.

### Lists and Inventory Surfaces

- Browsing views should default to scan-friendly summaries.
- Details should appear on expansion rather than all at once when density becomes visually noisy.

### Print Surfaces

- Printed layouts should resemble tidy reference sheets and seed packet inserts.
- Keep typography crisp, spacing deliberate, and ornament minimal.

## Interaction Tone

- Motion, if added, should feel purposeful and light.
- Hover and focus states should improve clarity, not create spectacle.
- Expansion and collapse patterns should reduce clutter and reveal detail progressively.

## Imagery and Illustration Direction

If visual assets are added later, they should follow these cues:

- Botanical but simplified
- Diagrammatic rather than photoreal
- Useful rather than decorative
- Rooted in seed forms, leaf shapes, row spacing, and seasonal cycles

## Implementation Notes

These design decisions already map to the shipped codebase:

- CSS variables in `src/app/globals.css` define the core palette and shadow language.
- The app shell and content panels in `src/components/saatgut-app.tsx` apply the warm-surface, restrained-radius, and evergreen-accent system.
- Recent UX passes already shifted the interface toward clearer hierarchy, shorter headlines, gardener-facing wording, and browse-first catalog behavior.

Future design work should extend this system rather than resetting it to generic dashboard defaults.
