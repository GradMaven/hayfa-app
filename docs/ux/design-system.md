# Design System

## Brand direction (§9–10)

Calm, clinically credible, premium — not a government portal, not a hospital billing system, not a generic gradient-heavy SaaS dashboard. The logo mark is an abstract pulse/leaf line, deliberately not a literal medical cross or stethoscope icon, aiming for "contemporary" over "stereotypically medical" per §10.

## Tokens ([`src/app/globals.css`](../../src/app/globals.css))

CSS custom properties, redefined under `prefers-color-scheme: dark` — no component hardcodes a color.

| Token | Light | Purpose |
|---|---|---|
| `--primary` | `#0f6e5d` (deep teal) | Primary actions, active nav, links |
| `--accent` | `#c9a24b` (muted gold) | Sparing — highlighted list markers, AI touches |
| `--success` / `--warning` / `--danger` / `--info` | standard semantic hues, each with a `-tint` background variant | Status badges, alerts — never the only signal (always paired with text, e.g. "moderate" not just an orange dot) |
| `--surface` / `--surface-alt` / `--border` | near-white / warm off-white / soft gray | Card backgrounds and separation without heavy shadows |

Radii (`--radius-sm/md/lg`) and shadows (`--shadow-sm/md`) are restrained on purpose — §9 explicitly asks to avoid "decorative dashboards" and "excessive animation." There is no glassmorphism, no gradient fills, and the only animation is a spinner on in-flight buttons and `animate-pulse` skeletons.

## Primitives ([`src/components/ui/`](../../src/components/ui/))

`Button` (5 variants × 4 sizes), `Card`/`CardHeader`/`CardContent`/`CardFooter`, `Badge` (7 tones), `Input`/`Textarea`/`Select`/`Label`/`FieldError`/`FieldHint`, `Alert` (4 tones with icon), `EmptyState`, `Skeleton`/`SkeletonList`. Every domain page composes these rather than styling raw elements — a new page should almost never need a new color or a one-off `<div className="...">` card.

## Component patterns established once, reused everywhere

- **List + inline add-form**: a page-level "Add X" button toggles a `Card` containing a `react-hook-form` + Zod form; on success, the relevant TanStack Query caches are invalidated. Used identically across medications, conditions, labs, vitals, allergies, immunizations, appointments, care plans — see any of `src/app/(app)/medications/page.tsx`, `.../health/*-tab.tsx` for the canonical shape.
- **Form date fields + Zod `z.coerce.date()`**: forms bind to `z.input<typeof schema>` (the pre-coercion shape, e.g. `dateOfBirth: string` from an `<input type="date">`) rather than the schema's output type — this is a real TypeScript/Zod-v4 constraint (see any form file), not a style choice, and every date-bearing form follows it consistently.
- **Provenance and verification badges**: any record with a `source`/`verificationStatus` renders a small neutral/info/success badge next to it (documents, medications) — §57's "don't imply verification that didn't happen" as a reusable UI pattern, not a one-off.

## Copy tone (§92–93)

Plain language over clinical/legal jargon in every user-facing string: "Remove access" not "Revoke Authorization," "Who can see your health information?" as the Sharing page's framing, error messages that say what happened and what to do ("Your document was not uploaded. Please try again.") rather than exposing internals.
