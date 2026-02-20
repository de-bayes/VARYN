# UI Continuity Guide

This document defines how UI quality stays consistent from idea to release and maintenance for the Varis marketing site.

## Goals

- Keep visual language, interaction patterns, and content tone consistent across pages.
- Prevent regressions when new features or copy updates are shipped.
- Make UI decisions easy to review, implement, and maintain over time.

## Design Principles

1. **Calm, serious, and readable**
   - Prefer low-noise layouts, clear hierarchy, and restrained motion.
   - Maintain legibility first: spacing, contrast, and predictable structure.
2. **Progressive complexity**
   - Keep primary flows obvious.
   - Introduce advanced details only when useful.
3. **Reusable primitives over one-off styling**
   - Reuse existing components (`Button`, `Badge`, `Reveal`, `AppMock`, etc.) where possible.
   - Extend patterns intentionally instead of creating ad-hoc variants.

## Lifecycle Workflow

### 1) Plan

For each UI change, define:

- User goal (what should become easier to understand or do)
- Scope (pages/components affected)
- Acceptance criteria (visual and interaction outcomes)

### 2) Design

- Match established spacing rhythm and typography hierarchy.
- Keep copy concise and outcome-oriented.
- Prefer existing visual tokens and utility classes.

### 3) Build

- Implement with existing component patterns first.
- Keep changes local and composable.
- Avoid introducing style drift between pages.

### 4) Validate

Minimum checks before merge:

- Type check passes (`npx tsc --noEmit`).
- Visual sanity check on affected pages.
- Screenshot capture for perceptible UI changes.

### 5) Review

Reviewers should check:

- Consistency with this guide and existing pages.
- Mobile/desktop layout behavior.
- Content clarity and CTA prominence.
- Motion pacing and accessibility impact.

### 6) Release + Follow-up

After release:

- Verify key pages render as expected in production.
- Log follow-up issues for polish or UX debt.
- Update this guide if new patterns become standard.

## UI Change Checklist (PR-ready)

- [ ] Reused existing components where possible.
- [ ] Preserved typography, spacing, and tone consistency.
- [ ] Verified responsive behavior for changed sections.
- [ ] Captured screenshot(s) for visual diffs when applicable.
- [ ] Ran type checks and recorded outcomes.
- [ ] Updated docs if new conventions were introduced.

## Ownership

- Primary owner: feature author for each UI change.
- Shared responsibility: reviewers enforce continuity during PR review.
- Living document: update this file whenever the team adopts a new UI convention.
