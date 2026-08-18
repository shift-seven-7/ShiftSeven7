---
name: dev-update-docs
description: Update feature docs after changes. Keep docs/features/ accurate as the source of truth. Always use as the LAST step.
---

# Step 7: Update Docs

After making changes, update the documentation to keep it accurate.

## What To Update

### Feature Docs (`docs/features/*.md`)
If your changes affected a feature's behavior, routes, components, or data model:
- Update the relevant section (Pages & Routes, API Endpoints, Key Files, Data Model, Data Flow)
- Add new API routes, components, or hooks you created
- Update data model if tables/columns changed
- Update the Data Flow section if the flow changed

### Page Map (`docs/INDEX.md`)
If a page gained new features, tabs, or sections:
- Add the new feature reference to the page's entry in the Page Map
- Link to the relevant feature doc

### Architecture Doc (`docs/architecture.md`)
If you added new database tables, changed the route structure, or added significant new packages:
- Update the relevant section

## When NOT To Update

- Minor bug fixes that don't change behavior
- Style-only changes
- Internal refactors that don't change the public API or data model

## Checklist

- [ ] Feature doc updated (or no changes needed)
- [ ] Page Map in INDEX.md updated (or no changes needed)
- [ ] Architecture doc updated (or no changes needed)
