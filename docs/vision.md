# VARYN — Project Direction & Build Order

## Core Vision

Varyn is a **modern, cloud-native statistical workspace built on R**.

It is not:
- A Stata clone
- A notebook
- An AI gimmick

It is:
- A clean statistical IDE
- Progressive in complexity (beginner → expert)
- Cloud-scalable
- Built for serious modeling
- Calm, minimal, product-first

Emotional identity:

> Elegant. Calm. Powerful. Inevitable.

## Product Principles

1. Product over gimmicks
2. Animation enhances — never dominates
3. UI clarity > feature count
4. Build the 80% of workflows beautifully
5. No feature bloat
6. Progressive disclosure of complexity
7. Cloud-native from day one
8. Serious tone — never meme-y

## Phase Structure

### Phase 1 — Marketing Site (Fake It First)

Goal: Clarify product identity and visual language.

Deliverables:
- 3-page site (Home / Product / Pricing)
- Subtle ASCII wave hero (calm, mathematical)
- Fake app mock UI (regression table, command bar, simulation card)
- Clean typography system
- Black/charcoal dominant design
- Subtle accent color
- Responsive layout

No backend.
No real functionality.

Purpose:
- Lock aesthetic
- Lock messaging
- Lock positioning

### Phase 2 — UI-Only App Mock

Goal: Build the workspace layout before logic.

Deliverables:
- Sidebar (Datasets / Models / Jobs)
- Central output card canvas
- Right data preview panel
- Bottom command bar
- Fake regression card
- Fake simulation runner
- Fake model comparison

No real R execution yet.

Purpose:
- Fall in love with the workspace
- Refine interaction model
- Perfect spacing and hierarchy

### Phase 3 — Minimal Engine (Core Power)

Goal: Real functionality.

Must-have features:
- Upload CSV / .dta
- Active dataset
- summarize
- regress (OLS)
- robust SE
- cluster SE
- basic scatter plot
- save project

No AI.
No collaboration.
No Monte Carlo yet.

Purpose:
- Prove core value
- Validate modeling UX

### Phase 4 — Cloud Execution

Goal: Real differentiator.

Deliver:
- Job runner
- Parallel simulation
- Monte Carlo engine
- Progress tracking
- Cloud tier scaling

Pricing logic tied to:
- Simulation scale
- Job concurrency
- Data size

Do not expose raw CPU core counts to users.
Abstract infrastructure into understandable tiers.

### Phase 5 — Presets

Add:
- Poll aggregation preset
- Election modeling preset
- Fixed effects preset
- Logistic regression preset

Presets scaffold workflows.
They do not overwhelm.

### Phase 6 — Assistant Layer

Sidebar assistant:
- Non-agentic at first
- Helps write commands
- Explains output
- Suggests next steps

Later:
- Natural language → DSL
- Agent-run tasks

## Design System Rules

### Color
- Deep charcoal background
- Off-white text
- Subtle gray borders
- One muted accent color max

### Typography
- Clean sans-serif primary (Inter / Geist recommended)
- Optional refined serif for hero only
- No quirky fonts
- Strong hierarchy

### Motion
- Slow
- Mathematical
- Calm
- Never flashy
- Respect reduced-motion preferences

## What We Will Not Do

- No aggressive anti-Stata tone
- No crypto aesthetic
- No neon gradients
- No chaotic ASCII rain
- No enterprise buzzword overload
- No 50-tier pricing model

## Core Identity Statement

Varyn is:

> A cloud-native statistical IDE with progressive power scaling.

Or more simply:

> A modern statistical workspace.

## Strategic Focus Order (Founder Priority)

1. UI design
2. Cloud job system
3. Modeling engine
4. Presets
5. AI layer

Development should reflect this order.

## Key Strategic Reminder

If we remove:
- AI
- Presets
- Collaboration

Would the regression + simulation experience alone be compelling?

If not:
Refocus.

## Immediate Next Step

Build homepage mock.
Lock tone.
Lock identity.
Then build UI shell.

---

This document exists to prevent:
- Feature creep
- Direction drift
- Gimmick temptation
- Overbuilding too early
