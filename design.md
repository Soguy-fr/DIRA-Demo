---
version: alpha
name: DIRA-Budget-design-system
description: The design language of DIRA Budget, by Shauri — a budget & financial-tracking product for NGOs. Built on a deep slate ink (#1e293b), an emerald primary (#0fa86b), a near-white canvas (#f8fafc), and a muted slate for secondary text (#64748b). The system pairs Inter at thin (300) weights with negative letter-spacing for editorial-density display headlines, and tabular figures (tnum) on every money / numeric cell — the quiet financial-data signal. Buttons are pill-shaped, cards live on the near-white canvas, and the app shell anchors on deep slate.
metadata:
  product: "DIRA Budget"
  vendor: "Shauri – Expertise Internationale"
  reference-client: "Sauve un arbre"

colors:
  primary: "#0fa86b"          # emerald — brand CTA / accent
  primary-deep: "#0c8b58"     # pressed / hover
  primary-soft: "#e8f5ee"     # pale emerald wash (tag / row highlight)
  ink: "#1e293b"              # deep slate — app shell + body headings
  ink-secondary: "#334155"
  ink-mute: "#64748b"         # muted slate — helper text, captions, labels
  on-primary: "#ffffff"
  canvas: "#f8fafc"           # near-white page background
  surface: "#ffffff"          # cards, panels
  hairline: "#e2e8f0"         # 1px borders
  input: "#1d4ed8"            # saisie utilisateur = bleu (convention métier)
  formula: "#0f172a"          # calcul = noir (convention métier)
  alert: "#dc2626"            # écart / dépassement = rouge (convention métier)

typography:
  display-xl:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 40px
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: -0.8px
    fontFeature: ss01
  display-lg:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 28px
    fontWeight: 300
    lineHeight: 1.15
    letterSpacing: -0.56px
    fontFeature: ss01
  heading-md:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
    fontFeature: ss01
  body-md:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
    fontFeature: ss01
  body-tabular:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: -0.28px
    fontFeature: tnum
  button-md:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0
  caption:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  micro-cap:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 0.6px    # UPPERCASE eyebrow

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  pill: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  button-on-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.hairline}"
    padding: 16px
  pill-tag-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.micro-cap}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
---

## Overview

DIRA Budget is a financial product; its design language reads as calm, dense, and trustworthy. **Deep slate** (`{colors.ink}` — `#1e293b`) anchors the app shell (sidebar, active nav, primary headings). **Emerald** (`{colors.primary}` — `#0fa86b`) is the single accent: CTAs, links, positive figures, coverage bars. The page rests on a **near-white canvas** (`{colors.canvas}` — `#f8fafc`) with cards on pure white; **muted slate** (`{colors.ink-mute}` — `#64748b`) carries secondary text.

Typography is **Inter**: thin (300) with negative tracking for display headlines, regular (400) for body, and **tabular figures (`tnum`)** on every cell that renders money or a count — the product's quiet financial-data signature.

**Key characteristics**
- One accent, used sparingly: emerald for CTAs, links, and "good" states.
- Deep-slate shell; near-white canvas; white cards with hairline borders.
- Inter thin display headlines with negative letter-spacing.
- Tabular figures on all monetary/numeric cells.
- Pill / soft-radius buttons; hairline-bordered cards.
- Business colour conventions preserved: saisie = blue, calcul = black, écart = red.

## Colours

### Brand & accent
- **Emerald** (`{colors.primary}` — `#0fa86b`): CTAs, links, active/positive states, coverage bars. Used sparingly.
- **Emerald deep** (`{colors.primary-deep}` — `#0c8b58`): hover / pressed lift.
- **Emerald soft** (`{colors.primary-soft}` — `#e8f5ee`): pale wash for row highlights and soft tags.

### Ink
- **Ink** (`{colors.ink}` — `#1e293b`): app shell, active nav, primary headings, body emphasis. Never pure black.
- **Ink mute** (`{colors.ink-mute}` — `#64748b`): helper text, captions, table labels.

### Surface
- **Canvas** (`{colors.canvas}` — `#f8fafc`): page background.
- **Surface** (`#ffffff`): cards, panels, nav rail.
- **Hairline** (`{colors.hairline}` — `#e2e8f0`): 1px borders.

### Business conventions (preserved from the app's constitution)
- **Saisie** (`{colors.input}` — `#1d4ed8`): user-entered values render blue.
- **Calcul** (`{colors.formula}` — `#0f172a`): computed values render near-black.
- **Écart / dépassement** (`{colors.alert}` — `#dc2626`): overruns / variances render red.

## Typography

**Font family:** Inter (Google Fonts), weights 300 / 400 / 500 / 600. `font-feature-settings: "ss01"` is applied globally; `tnum` is applied per-element on any monetary or numeric content.

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | 40px | 300 | -0.8px | Page hero (login, dashboard) |
| `display-lg` | 28px | 300 | -0.56px | Section opener |
| `heading-md` | 20px | 600 | -0.2px | Page title inside app |
| `body-md` | 15px | 400 | 0 | Default body |
| `body-tabular` | 14px | 400 | -0.28px | Money / numeric cells (`tnum`) |
| `button-md` | 14px | 500 | 0 | Button label |
| `caption` | 12px | 400 | 0 | Helper, labels |
| `micro-cap` | 10px | 600 | 0.6px | UPPERCASE eyebrow |

**Principles**
- Display headlines render thin (300) with negative tracking — the editorial signature.
- `tnum` on every money / count cell; it is the product's financial-data tell.
- `ss01` globally on the body.

## Layout
- **Base unit** 8px. Section padding 24px; card padding 16px.
- App shell: fixed-width slate/white nav rail + fluid content on canvas.
- Cards: white on canvas, `rounded.lg` (12px), 1px hairline border.

## Shapes
| Token | Value | Use |
|---|---|---|
| `rounded.sm` | 6px | inputs, chips |
| `rounded.md` | 8px | buttons |
| `rounded.lg` | 12px | cards, panels |
| `rounded.pill` | 9999px | tags, status pills |

## Components

**button-primary** — emerald fill, white text, 8px radius, `8px 16px` padding. The dominant CTA.
**button-on-dark** — slate `{colors.ink}` fill, white text; used for structural actions (save, add).
**nav-item-active** — slate fill, white text; the current section in the rail.
**card** — white surface, 12px radius, 1px hairline border, 16px padding.
**pill-tag-soft** — pale-emerald fill, emerald-deep text, uppercase micro-cap; status / category tags.

## Brand signature
- **Logo:** the Shauri double-S mark (slate ↔ emerald gradient), followed by the product name **DIRA Budget**.
- **Attribution:** every shell and auth surface carries **"DIRA Budget, by Shauri"**.
- **Reference client:** the demo instance is branded for the association **Sauve un arbre**.

## Do's and Don'ts
### Do
- Reserve emerald for CTAs, links, and positive/coverage states.
- Render display headlines thin (300) with negative tracking.
- Put `tnum` on every money / numeric cell.
- Keep the slate shell / white card / canvas rhythm.
### Don't
- Don't introduce accent colours outside emerald + the business conventions (blue/black/red).
- Don't bump display headlines above 300 — the editorial air collapses.
- Don't use emerald as body-text colour.
- Don't render money cells without `tnum`.
