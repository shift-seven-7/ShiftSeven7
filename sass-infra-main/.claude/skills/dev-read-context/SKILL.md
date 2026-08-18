---
name: dev-read-context
description: Read feature docs and the page map before starting any task. Always use as the FIRST step of every feature task.
---

# Step 1: Read context

Before writing any code, understand what already lives where you are about to
work.

## What to do

1. **Read `docs/INDEX.md`** — the map.
2. **Check the Page Map** — it lists every feature that lives on each route. A
   page usually combines several; changing one without knowing the others is how
   regressions happen.
3. **Read each feature doc it points to** in `docs/features/` — routes, API
   endpoints, data model, key files, and the design notes explaining why things
   are the way they are.
4. **Read `docs/architecture.md`** for system-level context: the two databases,
   auth, roles, storage, the design system.
5. **Read the specific system doc** your task touches:

| Task touches | Read |
|---|---|
| tenants, auth, Supabase clients, credentials | `docs/multi-tenant.md` |
| a new feature area or a new role | `docs/modules-and-roles.md` |
| the schema | `docs/migrations.md` |
| onboarding a tenant | `docs/provisioning.md` |

## Why this matters

The design notes in each feature doc record decisions that are not obvious from
the code — why keys are write-only, why the invite rolls back, why login uses a
full navigation. Re-deriving those from scratch usually means getting one of
them wrong.

## Checklist

- [ ] Read `docs/INDEX.md`
- [ ] Identified every feature on the target route via the Page Map
- [ ] Read each relevant doc in `docs/features/`
- [ ] Read `docs/architecture.md` if system context was needed
- [ ] Read the system doc matching what the task touches
