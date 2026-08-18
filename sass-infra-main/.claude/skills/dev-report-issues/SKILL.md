---
name: dev-report-issues
description: Document unrelated bugs discovered during work. Create issue files in docs/issues/ instead of fixing in current task.
---

# Step 6: Report Discovered Issues

During planning, development, or code review you may discover unrelated bugs, security issues, or code problems. Do NOT fix them in the current task — document them instead.

## What To Do

1. **Create a file in `docs/issues/`** for each discovered issue
2. **File naming:** `YYYY-MM-DD-short-description.md`
3. **Content:** Describe what the bug is, where it is (file paths + line numbers), what damage it could cause, and a suggested fix

## Issue File Template

```markdown
# Short Description

## What
Brief description of the bug or issue.

## Where
- File: `path/to/file.ts:42`
- Related files: `path/to/other.ts`

## Impact
What could go wrong if this isn't fixed.

## Suggested Fix
How to fix it.
```

## Why Not Fix It Now?

- Keeps the current task focused and reviewable
- Prevents scope creep and unintended side effects
- Ensures issues are tracked and not forgotten
- The developer can prioritize fixes separately

## Checklist

- [ ] No unrelated issues found during this task
- OR
- [ ] All discovered issues documented in `docs/issues/`
