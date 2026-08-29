---
name: dev-plan
description: Plan changes and get developer approval before writing code. Always use after reading context.
---

# Step 2: Plan & Approve

Plan your changes and get developer approval before writing any code.

## What To Do

1. **Create a plan** listing all changes you intend to make
2. **List files to modify/create** — be specific about which files will be touched and what changes each will receive
3. **Identify dependencies** — note which existing patterns, utilities, or components you'll reuse (check `docs/features/` key files sections)
4. **Present the plan** to the developer and wait for approval before proceeding

## Plan Structure

Your plan should include:
- **Goal:** What the task achieves
- **Files to modify:** Each file and what changes it gets
- **Files to create:** Any new files (prefer editing existing files)
- **Data model changes:** Any new tables, columns, or migrations
- **API changes:** New or modified endpoints
- **UI changes:** New components or modifications to existing ones

## Checklist

- [ ] Plan created with specific file list
- [ ] Dependencies and reusable patterns identified
- [ ] Developer approved the plan
