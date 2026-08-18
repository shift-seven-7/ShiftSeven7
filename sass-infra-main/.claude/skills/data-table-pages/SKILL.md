---
name: data-table-pages
description: Data table page design patterns. Covers page layout, filter bar, responsive table with CSS grid, expandable rows, pagination, summary bar, and mobile-first responsive design. Always use when creating or modifying data table pages.
---

# Data Table Page Design System

## Reference Implementations
- **Expandable rows + filters**: `components/purchase/PurchaseRequestsList.tsx`
- **Selection mode + pagination**: `components/equipment/EquipmentTable.tsx`
- **Page wrapper**: `app/app/users/page.tsx`
- **Page wrapper with actions**: `app/app/admin/tenants/page.tsx`

---

## Page Layout Structure

```tsx
{/* Page wrapper */}
<div className="min-h-screen bg-background">
  {/* Header section */}
  <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-8">
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">
        כותרת העמוד
      </h1>
      <div className="flex items-center gap-2">
        {/* Action buttons */}
        <Button className="rounded-lg h-9 px-4 text-sm font-medium gap-1.5">
          <Plus className="h-4 w-4" />
          הוסף חדש
        </Button>
      </div>
    </div>
  </div>

  {/* Filters + Table (separate container for embedded reuse) */}
  <div className="px-4 md:px-8 pt-4">
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Filter bar */}
      {/* Table */}
      {/* Summary bar */}
    </div>
  </div>
</div>
```

### Key Rules
- Header and table content are in **separate** `max-w-7xl` containers — this allows the table component to be reused embedded in other pages (as a tab inside another page) without the header
- Primary action button uses **default theme** colors (not hardcoded colors), `rounded-lg h-9`
- Title: `text-xl md:text-2xl font-bold`
- No greeting text, no icons in title

---

## Page-Level Tabs

When a page splits into two or three top-level views, use the shared **`PageTabs`** from [components/ui/page-tabs.tsx](../../../components/ui/page-tabs.tsx) — never hand-roll the markup:

```tsx
import { PageTabs } from '@/components/ui/page-tabs';

<PageTabs
  value={activeTab}
  onChange={setActiveTab}
  className="mb-4"
  ariaLabel="סוג רשומה"
  tabs={[
    { value: "open",   label: "פתוחות", icon: ClipboardList },
    { value: "closed", label: "סגורות", icon: CheckCircle },
  ]}
/>
```

- Full-width violet segmented bar; each tab is `flex-1`.
- Icons are **hidden below `md`** — the label alone must be understandable.
- 44px touch target on mobile (`min-h-[44px] md:min-h-0`).
- In use on: `/app/users`, `/app/admin/tenants`.

**Do NOT use** `components/ui/segmented.tsx` here — that is the *form control* variant (smaller, grid-based, icons always visible) documented in the **form-dialogs** skill. Two different jobs, two different components.

**Do NOT use** shadcn `Tabs`/`TabsList` for page-level views — it renders a compact pill group that doesn't match the design system, and it unmounts inactive content (losing filter state).

---

## Filter Bar

```tsx
<div className="flex items-center gap-2 flex-wrap">
  {/* Filters — RTL natural flow places them on the right */}
  <Select value={filter} onValueChange={setFilter}>
    <SelectTrigger className="w-auto min-w-[100px] max-w-[180px] h-9 rounded-lg border-border/50 bg-card/50 text-sm gap-1.5">
      <SelectValue placeholder="פילטר" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">הכל</SelectItem>
      {/* Options */}
    </SelectContent>
  </Select>

  {/* Search input */}
  <div className="relative">
    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    <input
      type="text"
      placeholder="חיפוש..."
      className="h-9 ps-9 pe-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 w-[200px] md:w-[250px] transition-colors"
    />
  </div>
</div>
```

### Filter Styling Constants
| Element | Classes |
|---------|---------|
| SelectTrigger | `w-auto min-w-[100px] h-9 rounded-lg border-border/50 bg-card/50 text-sm gap-1.5` |
| Search input | `h-9 ps-9 pe-3 rounded-lg border border-border/50 bg-card/50 text-sm` |
| Focus state | `focus:ring-2 focus:ring-primary/50 focus:border-primary/50` |
| Icon in input | `h-3.5 w-3.5 text-muted-foreground`, positioned with `start-3 top-1/2 -translate-y-1/2` |
| Last element | `ms-0 md:ms-auto` to push to end on desktop |
| Container | `flex items-center gap-2 flex-wrap` (RTL natural flow = right-aligned) |

### Common Filter Types
- **Status dropdown**: Static options from status constants
- **Entity dropdown**: Dynamic options extracted from data with `useMemo`
- **Date range dropdown**: היום / שבוע אחרון / חודש אחרון
- **Date input**: `type="date"` for "from specific date" filtering
- **Text search**: Debounced with minimum character validation (see below)

---

## Search Input — Debounce + Minimum Characters + Loader

### State Management
```ts
const MIN_SEARCH_LENGTH = 3;
const [searchInput, setSearchInput] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

// Debounce: update search only after 300ms idle AND minimum chars met
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchInput.length >= MIN_SEARCH_LENGTH ? searchInput : '');
    setPage(1);
  }, 300);
  return () => clearTimeout(timer);
}, [searchInput]);
```

### Shared Component: `components/ui/table-search-input.tsx`

Always use `TableSearchInput` — never inline the search input manually.

```tsx
import { TableSearchInput } from '@/components/ui/table-search-input';

<TableSearchInput
  value={searchInput}
  onChange={setSearchInput}
  isLoading={isFetching}
  placeholder="חיפוש..."
  minLength={MIN_SEARCH_LENGTH}  // default: 3
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | Controlled input value |
| `onChange` | `(value: string) => void` | required | Input change handler |
| `isLoading` | `boolean` | `false` | Shows spinner instead of search icon |
| `placeholder` | `string` | `'חיפוש...'` | Input placeholder |
| `minLength` | `number` | `3` | Minimum chars to trigger search |
| `className` | `string` | — | Additional wrapper classes |

### Search Rules
| Rule | Detail |
|------|--------|
| Minimum chars | `MIN_SEARCH_LENGTH = 3` — search not triggered below this |
| Debounce | 300ms after last keystroke |
| Reset page | `setPage(1)` on every search change |
| Icon swap | `Search` icon → `Loader2 animate-spin` when `isFetching` |
| Validation hint | Show "מינימום 3 תווים לחיפוש" when 1-2 chars typed |
| Clear behavior | Empty input → `debouncedSearch = ''` → show all results |

### Loading States
| State | Visual |
|-------|--------|
| Fetching (search icon) | `Loader2` with `text-primary animate-spin` replaces `Search` icon |
| Table opacity | `transition-opacity duration-200`, `opacity-60` when fetching |
| Count text | "טוען תוצאות..." with spinner replaces count during fetch |

---

## Table Structure

### Container
```tsx
<div className="border border-border rounded-lg overflow-hidden">
  {/* Header (desktop only) */}
  {/* Rows */}
</div>
```

### Table Header (Desktop Only)
```tsx
<div className={`hidden md:grid ${gridCols} gap-x-4 items-center px-4 py-3 bg-card/50 border-b border-border text-xs font-medium text-muted-foreground`}>
  <div>Column 1</div>
  <div className="w-[120px]">Column 2</div>
  {/* ... */}
</div>
```

### Grid Column Templates
Use CSS grid with `1fr` for the main column and fixed `auto` widths for others:
```
grid-cols-[1fr_auto_auto_auto_auto]       // 5 columns
grid-cols-[1fr_auto_auto_auto_auto_auto]  // 6 columns
grid-cols-[40px_1fr_auto_auto_auto_auto]  // with checkbox
```

### Standard Column Widths
| Column | Width |
|--------|-------|
| Name/Project (primary) | `1fr` (flexible) |
| Person name | `w-[120px]` |
| Status badge | `w-[100px]` |
| ID/Reference | `w-[100px]` |
| Date | `w-[90px]` |
| Price | `w-[90px]` |
| Unit | `w-[80px]` |
| Actions | `w-[70px]` |
| Checkbox | `w-[40px]` |

### Dynamic Grid (Conditional Columns)
When columns are conditional (e.g. behind a module flag):
```tsx
const gridCols = hasExtraColumn
  ? 'grid-cols-[1fr_auto_auto_auto_auto_auto]'
  : 'grid-cols-[1fr_auto_auto_auto_auto]';
```

---

## Table Row (Responsive)

Each row has **two layouts** — mobile (card) and desktop (grid):

```tsx
<div
  className={cn(
    'border-b border-border cursor-pointer transition-colors',
    'hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.05]',
    isExpanded && 'bg-foreground/[0.02] dark:bg-foreground/[0.03]'
  )}
  onClick={() => toggleExpanded(id)}
>
  {/* Mobile layout */}
  <div className="md:hidden px-4 py-3">
    <div className="flex items-center justify-between gap-2 mb-1">
      <span className="font-medium text-foreground text-sm truncate">Primary text</span>
      <Badge className="shrink-0">Status</Badge>
    </div>
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>Secondary info</span>
      <span>Date</span>
    </div>
  </div>

  {/* Desktop layout */}
  <div className={`hidden md:grid ${gridCols} gap-x-4 items-center px-4 py-3.5`}>
    <div className="min-w-0">
      <span className="font-medium text-foreground">Primary text</span>
      <span className="text-xs text-muted-foreground ms-1.5">Secondary</span>
    </div>
    <div className="w-[120px] text-sm text-muted-foreground truncate">Value</div>
    <div className="w-[100px]">
      <Badge className={`${getStatusColor(status)} text-xs`}>{label}</Badge>
    </div>
    {/* ... more columns */}
  </div>
</div>
```

### Row State Classes
| State | Classes |
|-------|---------|
| Default | `border-b border-border` |
| Hover | `hover:bg-foreground/[0.03] dark:hover:bg-foreground/[0.05]` |
| Expanded | `bg-foreground/[0.02] dark:bg-foreground/[0.03]` |
| Selected (checkbox) | `bg-violet-50 dark:bg-violet-500/10` |

### Mobile Row Rules
- Use `items-start` (not `items-center`) so badge aligns to top when text wraps
- Primary text: `font-medium text-foreground text-sm leading-snug` — **no `truncate`**, allow line wrapping
- Badge: `shrink-0 mt-0.5` to align with first line of text
- Padding: `px-4 py-3`
- **Expandable**: Click row to toggle expanded details section below
- Expanded section: `mt-2 pt-2 border-t border-border/50 space-y-1.5 text-xs`
- Each detail row: `flex items-center justify-between` with label + value
- Action buttons at bottom of expanded section

### Desktop Row Rules
- Primary column uses `min-w-0` for text overflow
- Fixed-width columns use `truncate` for long text
- Padding: `px-4 py-3.5`
- Text sizes: primary `font-medium text-foreground`, secondary `text-sm text-muted-foreground`

---

## Expandable Row Details

When a row is clicked, show full details below the row:

```tsx
{isExpanded && (
  <div className="border-b border-border px-5 md:px-6 py-5 bg-gradient-to-b from-white/[0.02] to-transparent">
    <div className="space-y-4">
      {/* Status + Actions row */}
      {/* Metadata grid */}
      {/* Notes */}
      {/* Items list (for batched) */}
      {/* Additional sections */}
    </div>
  </div>
)}
```

### Expanded Content Blocks
- **Metadata grid**: `bg-muted/30 dark:bg-white/[0.03] border border-border/50 rounded-lg p-3` with `grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2`
- **Notes block**: `bg-muted/30 dark:bg-white/[0.03] border border-border/50 p-4 rounded-xl whitespace-pre-wrap`
- **Item cards**: `p-3 bg-muted/30 dark:bg-white/[0.03] border border-border/50 rounded-lg`

---

## Pagination

```tsx
<div className="flex items-center justify-between mt-3">
  <div className="text-sm text-muted-foreground">
    מציג {totalItems} פריטים
  </div>
  {totalPages > 1 && (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="text-xs text-muted-foreground">
        עמוד {page + 1} מתוך {totalPages}
      </span>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0}
        onClick={() => setPage(p => p - 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1}
        onClick={() => setPage(p => p + 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  )}
</div>
```

### Key Rules
- **Default page size: 10 items** (`PAGE_SIZE = 10`)
- Pagination sits **outside** the table border container, with `mt-3`
- ChevronRight = previous (RTL), ChevronLeft = next (RTL)
- Button size: `h-8 w-8` outline variant
- Always show pagination when `totalPages > 1`
- Count text: `text-sm text-muted-foreground`

---

## Summary Bar (No Pagination)

When there's no pagination, use a simple summary:

```tsx
{items.length > 0 && (
  <div className="flex items-center justify-start px-4 py-3 border border-border rounded-lg bg-card/30 text-sm">
    <div className="text-muted-foreground">
      מציג {items.length} פריטים
    </div>
  </div>
)}
```

---

## Empty State

```tsx
<div className="text-center py-12 border border-border rounded-lg bg-card/50">
  <p className="text-muted-foreground">אין פריטים להצגה</p>
</div>
```

For tables with icons:
```tsx
<div className="border border-border rounded-lg py-12 text-center">
  <div className="flex flex-col items-center gap-2 text-muted-foreground">
    <Package className="h-8 w-8 text-muted-foreground/50" />
    אין פריטים להצגה
  </div>
</div>
```

---

## Loading State

```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-9 w-24 rounded-lg" />
    ))}
  </div>
  <div className="border border-border rounded-lg">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex items-center gap-6 px-4 py-3.5 border-b border-border last:border-0">
        <Skeleton className="h-4 w-40 flex-1" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
</div>
```

---

## Selection Mode Pattern

For tables that support bulk operations:

```tsx
{/* Checkbox column in header */}
{selectable && <div className="w-[40px]" />}

{/* Checkbox in row */}
{selectable && (
  <div className="w-[40px]" onClick={(e) => e.stopPropagation()}>
    <Checkbox
      checked={isSelected}
      onCheckedChange={(checked) => onSelect(item, !!checked)}
      className="h-4 w-4 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
    />
  </div>
)}
```

### Selection Rules
- `onClick={(e) => e.stopPropagation()}` on checkbox container to prevent row click
- Selected row: `bg-violet-50 dark:bg-violet-500/10`
- Row becomes clickable for selection: `selectable && 'cursor-pointer'`
- Hide action columns when in selection mode: `!selectable && <Actions />`

---

## Action Buttons in Rows

```tsx
<div className="w-[70px] flex items-center gap-1 justify-end">
  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
    onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
    <Edit className="h-3.5 w-3.5" />
  </Button>
  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
    onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
    <Trash2 className="h-3.5 w-3.5" />
  </Button>
</div>
```

### Action Button Rules
- Always `e.stopPropagation()` to prevent row expansion/selection
- Button: `variant="ghost" size="icon" className="h-7 w-7"`
- Icon: `h-3.5 w-3.5`
- Edit: `hover:text-foreground`
- Delete: `hover:text-rose-600 dark:hover:text-rose-400`

---

## RTL / Hebrew Rules

All table pages follow RTL rules from the design-system skill:

| Element | Rule |
|---------|------|
| Search icon position | `start-3` (= right in RTL) |
| Input padding for icon | `ps-9` (padding-start) |
| Filter bar alignment | No `justify-end` needed — RTL flex starts from right naturally |
| Action buttons | `justify-end` on action cell to align to table edge |
| Pagination arrows | ChevronRight = previous, ChevronLeft = next |
| All text | Hebrew, `text-start` on selects |
| Logical properties only | Never use `left-*`/`right-*`/`pl-`/`pr-` |

---

## Checklist for New Data Table Pages

1. [ ] Page uses two-container layout (header separate from table)
2. [ ] Title: `text-xl md:text-2xl font-bold`, no icon
3. [ ] Primary button: default theme, `rounded-lg h-9`
4. [ ] Filter bar: `flex items-center gap-2 flex-wrap`
5. [ ] All selects use consistent trigger styling
6. [ ] Filter bar uses natural RTL flow (no `justify-end` needed — RTL starts from right)
7. [ ] Table container: `border border-border rounded-lg overflow-hidden`
8. [ ] Table header: `hidden md:grid`, `bg-card/50`, `text-xs font-medium text-muted-foreground`
9. [ ] Rows: dual layout (mobile card + desktop grid)
10. [ ] Mobile row: primary + badge on line 1, secondary on line 2
11. [ ] Row hover: `hover:bg-foreground/[0.03]`
12. [ ] Expandable details: `bg-gradient-to-b from-white/[0.02]`
13. [ ] Empty state with `py-12 border rounded-lg bg-card/50`
14. [ ] Loading skeleton matches table structure
15. [ ] Summary/pagination outside table container
16. [ ] Hebrew labels, RTL logical properties throughout
