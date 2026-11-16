# TRACE palette review

Status: agent recommendation, not an applied theme change. The user stopped
feature work before this optional refinement was implemented.

The recommended direction keeps the chosen Midnight blue theme and the
existing blue action accent. Improve hierarchy through lighter card surfaces
and more legible secondary text, rather than adding another accent family.
Keep scientific ramps and verdict colours unchanged.

| Role | Recommended colour |
| --- | --- |
| Body | `#0A1220` |
| Surface | `#0F1B2D` |
| Card | `#1A2F4A` |
| Popover | `#1C314B` |
| Primary text | `#EEF3FA` |
| Secondary text | `#A4B7CE` |
| Accent / focus | `#62AFFF` |
| Accent text | `#9ACAFF` |
| On accent | `#0A111B` |
| Emphasized border | `#6E88A8` |
| Segmented base | `#172B43` |
| Selected segment | `#29486B` |

Use the blue accent for primary actions and focus. Elevate important findings
through surface separation, large primary text and small labelled semantic
markers. Keep navigation and secondary controls quieter. Do not rely on
colour alone to identify a result.

The agent also suggested `#3F526B` for disabled text. Review that separately:
the current canvas chrome reuses the disabled-text token for geographic
outlines. Lowering it globally could reduce map legibility. Test those marks
before applying the suggestion.

Any future application must use the Astryx theme editor, inspect its PNG
previews, check text/control contrast in the actual pages, and pass the
existing bundle and browser checks.
