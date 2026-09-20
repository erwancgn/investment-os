---
name: investment-os-ui
description: Use when creating, modifying, reviewing, or refactoring the Investment OS interface. Apply the repository's canonical design system and reference stories. Not for backend-only or data-only changes.
---

# Investment OS UI

Use the design system executed by the application. Do not reproduce its values or components inside this skill.

## Before editing

1. Read `docs/design-system.md`.
2. Inspect the relevant production component and its consumers.
3. Inspect `app/components/ui-primitives.tsx`, `app/ux-foundations.css`, and the relevant stories only as needed for the requested surface.
4. Confirm whether an existing primitive, token, or composition already covers the need.

## Implementation rules

- Make the smallest complete change that satisfies the request.
- Reuse production primitives and semantic tokens before creating anything new.
- Keep screen-specific styling local unless a pattern has at least two real consumers.
- Stories must render production components with small deterministic fixtures and no external network dependency.
- Preserve responsive behavior, visible focus, accessible labels, loading, empty, and error states relevant to the change.
- Do not alter data contracts, backend behavior, or deployment configuration for a visual-only request.
- Do not create a parallel component library, palette, spacing scale, or source of design truth.

## Verification

Review the complete diff and run the checks proportionate to the change. For shared primitives, tokens, or reference screens, run:

```bash
npm run lint
npm run build-storybook
npm test
npm run audit:css
```

Treat CSS audit candidates as evidence to investigate, not automatic deletion targets. Before removing a selector, search static and dynamic references and verify its consumers.

Report the files changed, reused primitives, any new shared element, reference states checked, commands run, and remaining manual checks. Do not commit, publish, or deploy unless the user explicitly requests it.
