# LLM Rules for building the Secure Shift system

Follow these rules when using LLMs (Claude / Copilot / Gemini) to generate code or infra changes.

1. All application code is TypeScript, strict mode. No new JavaScript files.
2. Data access changes (new tables, RLS policies, RPC functions) must ship as a versioned SQL migration file under Supabase's migrations directory — never as ad-hoc dashboard edits that aren't captured in the repo.
3. Every table that isn't purely internal must have explicit RLS policies before it's used from the frontend — no relying on a permissive default policy "for now."
4. Reuse existing components (`web/components/ui/*`, ported from the current `src/components/ui/*` shadcn primitives) where possible instead of writing new ones.
5. Never include secrets in code. Supabase service-role keys and third-party API keys (Slack, email provider) are server-only env vars, never exposed to the client bundle.
6. Route Handlers and RPC functions that implement business logic (not simple CRUD) need unit tests.
7. Commit and PR rules: small PRs, one feature per branch, include CHANGELOG entry.
8. No Dockerfiles or `docker-compose.yml` — this app deploys to Vercel (Next.js) and Supabase Cloud (Postgres/Auth/Storage), both managed platforms.
9. Infra changes (new Supabase project settings, Vercel env vars, cron schedules) should be documented as clear manual steps in the relevant README, since there's no Terraform layer for this stack.
10. If generating multi-file changes, include a PR description templated for reviewers.
