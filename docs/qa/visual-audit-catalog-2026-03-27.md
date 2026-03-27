# Visual Audit Backlog - 2026-03-27

Independent visual audit for task `b75e13d6` on current `main`.

Method:

- Seeded a clean audit workspace on an isolated runtime at `http://localhost:3310`
- Drove the UI with `/home/florian/.npm-global/bin/agent-browser`
- Captured screenshots and inspected them directly before writing findings

## Prioritized Backlog

### 1. High: Arten are still visually subordinate to Sorten and Chargen in the catalog browse flow

Problem:
The catalog presents itself as `Sorten und Chargen pflegen`, then immediately lists varieties. Species only appear as a muted metadata line under each variety. That makes `Arten`, `Sorten`, and `Chargen` feel like one blended layer instead of three distinct inventory levels.

Why it matters:
Users cannot quickly understand whether they are browsing species, varieties, or seed batches. The audit target explicitly asked whether Arten, Sorten, and Chargen are clearly distinguishable; in the shipped browse state they are not.

Reproduction:

1. Log in.
2. Open `Katalog`.
3. Look at the catalog hero and the first several list rows.

Evidence:

- [catalog-overview-desktop.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/catalog-overview-desktop.png)

### 2. High: The expanded catalog item overloads one accordion with too many object types and actions

Problem:
Once a variety is expanded, the same card mixes variety summary, variety actions, media management, batch list, batch actions, and batch-photo tools in one long uninterrupted stack. The visual separators are too weak to keep variety-level and batch-level actions mentally separate.

Why it matters:
The catalog becomes overwhelming exactly at the point where users need clarity. The expanded state asks users to parse whether they are editing the Sorte itself, one specific Charge, or a photo attached to that charge.

Reproduction:

1. Log in.
2. Open `Katalog`.
3. Expand `Black Cherry`.
4. Scroll through the expanded card.

Evidence:

- [catalog-black-cherry-expanded-desktop.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/catalog-black-cherry-expanded-desktop.png)
- [catalog-black-cherry-lower-detail.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/catalog-black-cherry-lower-detail.png)

### 3. Medium: Remaining split layouts in the catalog are still cramped at normal laptop width

Problem:
At roughly `1024px` wide, the catalog still relies on narrow side-by-side panels for image preview/upload and batch photo handling. Inputs, helper text, and textareas compress into small columns that feel mechanically split rather than comfortably readable.

Why it matters:
This is not a mobile edge case. The layout already feels tight on an ordinary laptop viewport, which raises form-completion effort and makes the dense expanded card feel even longer.

Reproduction:

1. Set the viewport to around `1024px` wide.
2. Open `Katalog`.
3. Expand `Black Cherry`.
4. Review the image and batch-photo sections.

Evidence:

- [catalog-black-cherry-edit-laptop.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/catalog-black-cherry-edit-laptop.png)
- [catalog-black-cherry-lower-detail.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/catalog-black-cherry-lower-detail.png)

### 4. Medium: The catalog overview is visually exhausting before any item is opened

Problem:
The browse screen stacks hero, filters, KPI counters, and a long list of nearly identical variety rows with the same muted metadata pattern and the same action button placement. The result reads as a large block of repeated UI instead of a well-paced browsing surface.

Why it matters:
Users hit cognitive overload before they even enter the detailed state. The catalog feels like work at first glance, especially once the list grows beyond a few varieties.

Reproduction:

1. Log in.
2. Open `Katalog`.
3. Scan from the filter block into the first several rows.

Evidence:

- [catalog-overview-desktop.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/catalog-overview-desktop.png)

### 5. Medium: The account/workspace dialog still contains a cramped multi-column block pattern

Problem:
The account dialog compresses identity summary tiles and the passkey area into narrow side-by-side blocks inside a constrained modal. Important account state, role information, and passkey guidance end up in boxes that are readable but not comfortable.

Why it matters:
This is one of the remaining places where the product still feels packed rather than calm. It reinforces the broader audit theme that some two-column layouts are being preserved even when the content density no longer suits them.

Reproduction:

1. Log in.
2. Open `Arbeitsbereich & Konto`.
3. Review the account summary and passkey section at laptop width.

Evidence:

- [workspace-account-panel-laptop.png](/home/florian/.openclaw/workspace/saatgut/docs/qa/screenshots/visual-audit-2026-03-27/workspace-account-panel-laptop.png)
