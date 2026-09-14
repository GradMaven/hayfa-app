# Accessibility

Target: WCAG 2.2 AA where practical (§67), applied concretely rather than as an aspiration.

## What's in place

- **Semantic structure**: real `<button>`/`<label>`/`<fieldset>`/`<legend>` throughout forms (see any `*-form.tsx`), `role="tablist"`/`role="tab"`/`aria-selected` on the Health and Sharing page tab switchers, `<nav aria-label>` on the mobile menu.
- **Keyboard + focus**: a global `:focus-visible` ring (`--focus-ring`, [`globals.css`](../../src/app/globals.css)) instead of suppressing the browser default; every interactive control is a real focusable element, never a `<div onClick>`.
- **Forms**: every input has an associated `<Label htmlFor>`; validation errors are rendered via `<FieldError role="alert">` so a screen reader announces them; `aria-label` on icon-only buttons (delete, download, sign-out) — see `src/components/ui/input.tsx` and any list-page delete button.
- **Color is never the only signal**: status badges always carry text ("moderate", "revoked", "blocked"), not just a color chip; the danger/warning/success palette maintains contrast against both light and dark surfaces (tokens, not ad hoc hex per component).
- **Reduced motion**: `prefers-reduced-motion: reduce` collapses all animation/transition durations to near-zero globally ([`globals.css`](../../src/app/globals.css)) — this isn't per-component opt-in, so a future component author can't forget it.
- **Alerts**: `role="alert"` on danger-tone `Alert`s (so validation/error banners interrupt a screen reader), `role="status"` on informational ones (announced without interrupting).

## Known gaps (honest, not silently skipped)

- No automated accessibility test pass (axe-core / Playwright + `@axe-core/playwright`) has been run yet — this should gate before any real launch, not just be reasoned about.
- Skip-to-content link is not implemented on the app shell — a keyboard user must tab through the full sidebar before reaching page content on desktop.
- The Health page's tab panels don't yet set `role="tabpanel"`/`aria-labelledby` pairing with their tab buttons — the tabs themselves are marked up correctly but the association to their content is implicit (DOM order) rather than explicit ARIA.
- No dedicated screen-reader testing (VoiceOver/NVDA/TalkBack) has been performed against this build.
- Timeline's horizontal filter-chip scroller and the lab-results horizontal scroller (`/health`) are mouse/touch-scroll only — they lack visible affordance that more content exists off-screen for a sighted keyboard-only user (no scroll buttons), though the content itself is keyboard-reachable via Tab.

## Why this list exists

Per §67/§105's quality bar: accessibility is checked feature-by-feature, not assumed from using semantic components. This list is the honest current state so the next pass has a concrete starting checklist instead of "seems fine."
