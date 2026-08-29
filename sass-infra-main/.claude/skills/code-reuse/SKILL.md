---
name: code-reuse
description: Code reuse guidelines. Always check for existing shared utilities, types, and patterns before writing new code. Never duplicate — import and extend.
---

# Code Reuse Guidelines

**Rule: Never duplicate code. Always search for existing utilities, types, and patterns first.**

---

## 1. Shared Utilities — Always Check First

Before writing any helper function, check these shared modules:

| Module | Purpose | Key exports |
|--------|---------|-------------|
| `lib/date-utils.ts` | Date/time formatting & comparison | `toLocalDateKey`, `isSameDay`, `isDateStringOnDay`, `formatDateHebrew`, `formatDateShort`, `formatDate`, `formatTime` |
| `types/files.ts` | File/attachment types | `EntityFile`, `isImageFile` |
| `lib/utils.ts` | General utilities | `cn` (classnames) |
| `types/tasks.ts` | Task types & constants | `Task`, `TASK_STATUS_COLORS`, `TaskStatus` |
| `types/events.ts` | Event types & constants | `CalendarEvent`, `EVENT_STATUS_COLORS`, `EventStatus` |

## 2. Date & Time — Mandatory Patterns

**Never use `date.toISOString().split('T')[0]`** for local date operations. This converts to UTC and shifts dates in UTC+ timezones (e.g., Israel UTC+2/3).

```typescript
// WRONG - produces UTC date, off by 1 day in Israel
const dateStr = date.toISOString().split('T')[0];

// CORRECT - uses local timezone
import { toLocalDateKey } from '@/lib/date-utils';
const dateStr = toLocalDateKey(date);
```

**Always use shared formatters:**

```typescript
import {
  toLocalDateKey,      // Date → "YYYY-MM-DD" (local tz)
  isSameDay,           // Compare two Date objects
  isDateStringOnDay,   // Compare "YYYY-MM-DD" string to Date
  formatDateHebrew,    // Date → "יום ראשון, 11 בפברואר 2026"
  formatDateShort,     // "2026-02-11" → "11 בפבר׳"
  formatDate,          // "2026-02-11" → "11 בפברואר 2026" (nullable)
  formatTime,          // "14:30:00" → "14:30"
} from '@/lib/date-utils';
```

## 3. Types — Never Redeclare

Before creating an interface or type:

1. Search `types/` directory for existing definitions
2. Search for the type name across the codebase with grep
3. If it exists, import it. If it needs extension, use `extends` or intersection (`&`)

```typescript
// WRONG - duplicating an existing type
interface EntityFile { id: string; name: string; ... }

// CORRECT - import from shared types
import { type EntityFile, isImageFile } from '@/types/files';
```

## 4. Component Patterns — Reuse Before Creating

When building a new feature that resembles an existing one:

1. **Read the existing implementation first** — understand the pattern
2. **Reuse the same state management pattern** (e.g., `selectedTask` / `selectedEvent`)
3. **Reuse the same UI structure** — don't reinvent layouts
4. **Share constants** — status colors, labels, icons from `types/`

## 5. Checklist Before Writing Code

- [ ] Searched `lib/` for existing utility functions
- [ ] Searched `types/` for existing type definitions
- [ ] Searched `hooks/queries/` for existing data hooks
- [ ] Searched `components/ui/` for existing UI components
- [ ] No inline date formatting — using `lib/date-utils.ts`
- [ ] No duplicated interfaces — importing from shared `types/`
