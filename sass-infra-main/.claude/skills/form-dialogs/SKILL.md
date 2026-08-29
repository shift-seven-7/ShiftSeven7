---
name: form-dialogs
description: Form dialog design patterns. Covers the chrome-less Field helper (label row above input, icon on the end edge), live validation, sticky footer, mobile-first layout, and the custom RTL primitives (DateInput, TimeInput, NumberStepper, Segmented, SearchableSelect). Always use when creating or modifying form dialogs.
---

# Form Dialog Design System

## Reference Implementations
- **Invite user** (canonical): `components/features/users/InviteUserDialog.tsx`
- **Complex form**: `components/tasks/task-full-screen-overlay.tsx` (tabs, media, inline contractor creation)
- **Standard form**: `components/events/event-form-dialog.tsx` (fields + file attachments)

---

## Core Principles

1. **Field as a unit.** Every field is one block: icon + label + control + hint/error. Minimum 44px height for any interactive control.
2. **Full RTL.** Use `inset-inline-start`/`end`, `ms-`/`me-`, `ps-`/`pe-`, `text-start` — never `left`/`right`/`pl-`/`pr-`.
3. **No native pickers.** `<input type="date">` and `<input type="time">` are inconsistent, not RTL-aware, and ugly. **Always** use `DateInput` and `TimeInput` from `components/ui/`.
4. **Searchable selects above 8 items.** Use `SearchableSelect` with grouping when relevant. Plain shadcn `Select` is fine for ≤ 8 short, ungrouped options.
5. **Local errors.** Inline below the field with the alert icon, soft red. No top alerts, no toast for field-level validation.
6. **One primary action.** Save = primary violet, Cancel = ghost. Never two solid buttons.

---

## Hierarchy Inside the Form

- **Required fields first**, marked with red `*`.
- **Single-column rows** for fields that need full width (notes, long descriptions, contractor when external input is shown).
- **Mobile = one column.** No two fields side-by-side on mobile.
- **Logical order**: who → where → how many → when → what → description.

---

## Dialog Structure

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent
    dir="rtl"
    showCloseButton={false}
    className="sm:max-w-lg w-full max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0 bg-card shadow-2xl border-border/50 rounded-2xl"
  >
    {/* Header: title + optional subtitle + X */}
    <div className="flex items-start justify-between px-5 py-3 border-b border-border/50 shrink-0 gap-3">
      <div className="min-w-0">
        <DialogTitle className="text-base font-semibold leading-tight">כותרת</DialogTitle>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">תיאור משני</p>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}
        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </Button>
    </div>

    {/* Scrollable content */}
    <div className="flex-1 overflow-y-auto px-5 pt-5 pb-20">
      {/* Field cards here */}
    </div>

    {/* Sticky footer */}
    <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-100/10 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-2 justify-end bg-slate-50/50 dark:bg-white/[0.02]">
      <Button variant="ghost" size="sm" onClick={cancel}
        className="h-9 min-h-[44px] md:min-h-0 px-4 text-sm text-muted-foreground hover:text-foreground">
        ביטול
      </Button>
      <Button size="sm" onClick={handleSave} disabled={!canSubmit || (isEditing && !isDirty)}
        className={cn(
          'h-9 min-h-[44px] md:min-h-0 px-5 text-sm font-semibold transition-all duration-150',
          canSubmit && (isEditing ? isDirty : true)
            ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25'
            : 'opacity-40 cursor-not-allowed bg-violet-600/60 text-white/70'
        )}>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
        {isLoading ? 'שומר...' : isEditing ? 'שמור' : 'צור'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### Key Rules
- `showCloseButton={false}` — we render our own X button in the header
- `p-0` on DialogContent — padding is on inner sections
- `pb-20` on scrollable content — clearance for sticky footer
- `env(safe-area-inset-bottom)` on footer — iPhone home bar support

---

## Styling Constants

Copy these into each form dialog file:

```ts
const fieldInputClass = 'bg-slate-50/50 dark:bg-white/5 border border-border/50 md:border-border/40 hover:border-border/80 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all duration-150 w-full text-start';
const fieldErrorClass = 'border-red-500/70 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/20';
const iconBaseClass = 'h-4 w-4 mt-0.5 shrink-0 transition-colors duration-150';
const iconMuted = 'text-slate-400/60 dark:text-slate-500/60';
```

---

## Field helper — `FormField`

The shared chrome-less field helper lives at [components/ui/form-field.tsx](../../../components/ui/form-field.tsx). **Always import it — never re-implement.** The field has **no outer chrome** — no border, no background, no padding. The bordered/backgrounded element is the input itself. The label sits above the input with `justify-between` so the icon hugs the end edge (left in RTL) and the label text + required marker hug the start edge (right in RTL).

```tsx
import { FormField } from '@/components/ui/form-field';

<FormField
  icon={User}
  label="אחראי"
  required
  error={errors.owner ? "יש לבחור אחראי" : null}
  hint="שדה לא חובה"        // shown only when there's no error
  className="md:col-span-2"  // full-width inside the 2-col grid
>
  <SearchableSelect ... />
</FormField>
```

The component (signature):

```tsx
interface FormFieldProps {
  icon: LucideIcon;
  label: string;
  required?: boolean;
  error?: string | null | false;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}
```

### Field Rules
- **No outer chrome.** No border, no background, no padding on the Field wrapper. The bordered element is the input.
- **Label row**: `flex items-center justify-between` — label text + required marker on the start edge (right in RTL), icon on the end edge (left in RTL).
- **Label typography**: `text-[12.5px] font-semibold text-muted-foreground`.
- **Label-icon size**: `h-3.5 w-3.5` (14px) at `text-muted-foreground/60`.
- **Required marker**: `<span className="text-red-500 dark:text-red-400 ms-1 font-bold">*</span>` immediately after label text (inside the start span, so icon stays on the far end).
- **Focus highlight**: `group/field` on wrapper → label darkens (`group-focus-within/field:text-foreground`) and icon turns violet (`group-focus-within/field:text-violet-500`).
- **Error**: `mt-1.5 text-[11.5px] text-red-500 dark:text-red-400 font-medium` + `<AlertCircle className="h-3 w-3" />`.
- **Hint**: `mt-1.5 text-[11.5px] text-muted-foreground/70`, only when there's no error.
- **Multi-control fields** (e.g. select + inline input when "external" is selected): give the second control its own `mt-2` to space it from the first.

### Grid Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  <FormField className="md:col-span-2" ...>{/* full-width field */}</FormField>
  <FormField ...>{/* half-width */}</FormField>
  <FormField ...>{/* half-width */}</FormField>
</div>
```
- Single column on mobile, 2 columns on `md+`
- `gap-3` between fields (12px row, 14px column ~= the design's spacing)
- Full-width fields use `md:col-span-2` — typically the first field (e.g. "אחראי"), the segmented control, and the notes textarea
- Field order follows: who → where → how many → when → what → description

---

## Custom Form Primitives

This app ships custom RTL-aware primitives in `components/ui/`. Use them everywhere instead of native inputs or shadcn equivalents that don't fit the RTL pattern.

| Primitive | Path | Replaces | When to use |
|-----------|------|----------|-------------|
| `DateInput` | `components/ui/date-input.tsx` | `<input type="date">` | Always for dates. Hebrew weekday headers, today/yesterday/clear chips, RTL-correct calendar grid. |
| `TimeInput` | `components/ui/time-input.tsx` | `<input type="time">` | Always for times. 24h format, hour + minute columns, quick presets (07/08/12/17). |
| `NumberStepper` | `components/ui/number-stepper.tsx` | `<input type="number">` | Counts/quantities (workers, items). 44×44 −/+ buttons, no native spinners. |
| `Segmented` | `components/ui/segmented.tsx` | `Select` with 2-3 short options | "Type" / "Status" choices. iOS-style toggle. |
| `SearchableSelect` | `components/ui/searchable-select.tsx` | `Select` for long lists or grouped data | Lists with > 8 items, grouped data, "create new" accent items, leading icons. |

### DateInput
```tsx
<DateInput
  value={form.start_date}              // 'YYYY-MM-DD'
  onChange={(v) => setForm({ ...form, start_date: v })}
  hasError={!!errors.start_date}
  placeholder="בחר תאריך"
/>
```
- Display format: `DD.MM.YYYY` with `tabular-nums`
- Popover: 296px, Hebrew month names, weekday row `א ב ג ד ה ו ש`
- Today: violet ring; Selected: violet fill
- Bottom chips: `היום` / `אתמול` / `נקה`
- Out-of-month days are dimmed

### TimeInput
```tsx
<TimeInput
  value={form.report_time}             // 'HH:MM' (24h)
  onChange={(v) => setForm({ ...form, report_time: v })}
/>
```
- Two columns: minutes (every 5) on the right, hours (00–23) on the left, `:` separator — matches the visual layout of a clock in RTL.
- Quick presets at top: 07:00 / 08:00 / 12:00 / 17:00
- Auto-scrolls to selected hour/minute on open

### NumberStepper
```tsx
<NumberStepper
  value={form.worker_count}
  onChange={(v) => setForm({ ...form, worker_count: v })}
  min={1}
  max={200}
  hasError={!!errors.worker_count}
  ariaLabel="כמות עובדים"
/>
```
- 44×44 −/+ buttons with hover background
- Center input with `tabular-nums`, hides native spinner
- Disables −/+ at min/max bounds

### Segmented
```tsx
<Segmented
  value={form.work_type}
  onChange={(v) => setForm({ ...form, work_type: v })}
  options={[
    { value: 'regular', label: 'רגיל' },
    { value: 'daily', label: 'עבודה יומית' },
  ]}
  ariaLabel="סוג עבודה"
/>
```
- Visual style: violet-tinted background + violet border + soft violet shadow on the active segment.
- Container: `grid` with one column per option, `bg-card-elevated/60 border border-border/50`, rounded-xl.
- Active button: `bg-violet-100/80 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 border border-violet-300 dark:border-violet-500/40 shadow-sm shadow-violet-500/10 dark:shadow-violet-900/30`.
- Optional `icon` per option (lucide component).
- Use only for 2–4 short, mutually-exclusive options.

### SearchableSelect
```tsx
<SearchableSelect
  value={form.contractor_id}
  onChange={(v) => setForm({ ...form, contractor_id: v })}
  options={[
    { value: '__external__', label: "משתמש חדש", leadingIcon: UserPlus, accent: true },
    { value: 'c1', label: 'אלקטרה בנייה', group: 'קבלנים פעילים' },
    { value: 'c2', label: 'דנה לוי',       group: 'קבלנים פעילים' },
    { value: 'c5', label: 'גוטמן הנדסה',   group: 'קבלנים נוספים' },
  ]}
  placeholder="בחר אחראי"
  searchable                              // auto-on above 8 items if omitted
  hasError={!!errors.contractor_id}
  renderValue={(sel) => sel?.value === '__external__'
    ? <span className="flex items-center gap-1.5 text-violet-500"><UserPlus className="h-3.5 w-3.5" />{sel.label}</span>
    : <span className="truncate">{sel?.label}</span>
  }
/>
```
- Trigger looks like an input, not a button
- Chevron rotates 180° when open
- Popover matches trigger width, max-height 320px with internal scroll
- `accent: true` on an option renders it in violet (use for "create new" / "external" entries)
- `group` on options creates section headers
- `leadingIcon` shows next to the label
- `renderValue` lets you customise the trigger render (e.g. icon + label)

### Native Textarea (still fine)
```tsx
<Textarea
  value={form.notes}
  onChange={(e) => setForm({ ...form, notes: e.target.value })}
  placeholder="הערות נוספות..."
  className={cn('min-h-[80px] resize-none text-sm shadow-none rounded-md px-3 py-2', fieldInputClass)}
/>
```
- `resize: none`, min-height 80px
- Same `fieldInputClass` tokens as inputs

---

## Validation

### State Management
```ts
const [touched, setTouched] = useState<Record<string, boolean>>({});

const errors = {
  title: touched.title && !form.title.trim(),
  start_date: touched.start_date && !form.start_date,
};
```

### How It Works (Touched-First)
1. **On blur / first interaction**: mark field as `touched`. Pickers (`DateInput`, etc.) accept the changed value as touched implicitly — set `touched[field] = true` from the `onChange` handler.
2. **On save attempt**: mark ALL required fields as touched in one `setTouched({...})` call.
3. **Error shows**: only when `touched && empty`. Never show errors before the user has interacted.
4. **Error clears**: immediately when user types (reactive via the computed `errors` object).

### Save Handler
```ts
const handleSave = async () => {
  setTouched({ title: true, start_date: true }); // mark all required
  if (!canSubmit) return;
  // ... proceed with save
};
```

### Error Messages — Hebrew Only
Use natural Hebrew, not "Field is required":
- `יש לבחור אחראי`
- `יש להזין שם`
- `יש לבחור תאריך`
- `נדרש לפחות עובד אחד`

---

## Save Button Logic

```ts
const canSubmit = form.title.trim() && form.start_date && !isLoading;
const isDirty = JSON.stringify(form) !== JSON.stringify(originalForm);
```

- **Create mode**: `disabled={!canSubmit}`
- **Edit mode**: `disabled={!canSubmit || !isDirty}` — block save if nothing changed
- **Loading**: always disabled during save (`isLoading`)
- **Active**: `bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/25`
- **Disabled**: `opacity-40 cursor-not-allowed bg-violet-600/60 text-white/70`

---

## Mobile Patterns

| Pattern | Class |
|---------|-------|
| Touch targets | `min-h-[44px] md:min-h-0` on inputs and buttons (primitives already do this internally) |
| Grid columns | `grid-cols-1 md:grid-cols-2` |
| Footer safe area | `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` |
| Content clearance | `pb-20` on scrollable area |
| Bottom sheet feel | Dialog at `rounded-2xl` looks fine even though it's not edge-to-edge — the field cards keep the eye away from the corners |

---

## RTL / Hebrew Alignment Rules

Hebrew-first, RTL-only. Never use `left-*` / `right-*` / `pl-` / `pr-` — always logical (`start-*` / `end-*` / `ps-` / `pe-`).

| Element | Rule |
|---------|------|
| Search icon in input | `start-3` (= right in RTL) + `ps-9` on the input |
| Field label | Label text + required marker on the start edge (right in RTL); icon on the end edge (left in RTL) — single flex row with `justify-between` |
| SelectTrigger | RTL is built into `components/ui/select.tsx`. Children wrapped in `<span className="flex-1 text-start truncate">`. No extra RTL classes. |
| `SearchableSelect` / `DateInput` / `TimeInput` | Already RTL-correct. Pass `dir="rtl"` to the dialog and they inherit. |
| Calendar grid | Sunday is on the right (CSS grid in RTL flows naturally). Don't reverse columns manually. |
| Time picker columns | Minutes on the left, hours on the right, `:` between — matches a wall-clock view in RTL. |
| Popovers | Always use `inset-inline-*` and `align="start"` so they hug the trigger's start edge. |

---

## Don'ts

- ❌ Native `<input type="date" / type="time" / type="number">` in any user-facing form. Use the primitives.
- ❌ Loud gradients on field backgrounds.
- ❌ Coloured icons inside every field — field icons stay subtle (text-muted) and only turn violet on focus.
- ❌ Placeholder as a substitute for label.
- ❌ 3+ columns. Always 1 (mobile) or 2 (desktop).
- ❌ Pale placeholder text. Contrast must be ≥ 4.5:1.
- ❌ Two solid buttons in the footer. One primary, one ghost.
- ❌ Top toasts / banners for field-level validation. Errors live under their field.

---

## Dialog Reset on Open

Always reset state when the dialog opens (not on every render):

```ts
const prevOpenRef = useRef(false);
useEffect(() => {
  const justOpened = open && !prevOpenRef.current;
  prevOpenRef.current = open;
  if (!justOpened) return;

  setTouched({});
  const initial = entity ? entityToForm(entity) : createEmptyForm(defaults);
  setForm(initial);
  setOriginalForm(initial);
}, [open, entity, ...defaults]);
```

---

## Confirmation / Alert Dialogs (RTL)

Reference: `components/plan-editor/confirm-delete-dialog.tsx`

```tsx
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent dir="rtl" className="text-right">
    <AlertDialogHeader className="text-right">
      <AlertDialogTitle className="text-right">כותרת</AlertDialogTitle>
      <AlertDialogDescription className="text-right">תיאור</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-end">
      <AlertDialogCancel className="mt-0">ביטול</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
        מחיקה
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Key RTL rules for alert dialogs
- `dir="rtl"` + `className="text-right"` on `AlertDialogContent`
- `className="text-right"` on Header, Title, and Description
- Footer: `className="flex-row-reverse gap-2 sm:justify-end"` — reverses DOM order so buttons appear right-to-left
- Cancel first in DOM, Action second — `flex-row-reverse` puts Action on right, Cancel on left
- `className="mt-0"` on Cancel to remove default top margin in row layout

---

## Checklist for New Form Dialogs

1. [ ] Dialog uses `showCloseButton={false}`, `p-0`, `dir="rtl"`, `rounded-2xl`
2. [ ] Header with title, optional subtitle, and X button
3. [ ] Scrollable content with `pb-20`
4. [ ] Sticky footer with ביטול + violet save button
5. [ ] All fields wrapped in `FormField` from [components/ui/form-field.tsx](../../../components/ui/form-field.tsx) (no outer chrome — label row above input, icon on end edge, label text + required marker on start edge)
6. [ ] Grid `grid-cols-1 md:grid-cols-2 gap-3`, full-width fields use `md:col-span-2`
7. [ ] **No native pickers.** Use `DateInput`, `TimeInput`, `NumberStepper`, `Segmented`, `SearchableSelect`.
8. [ ] Required fields marked with red `*`
9. [ ] `touched` state — touched-first validation, errors only after blur/change
10. [ ] `canSubmit` + `isDirty` for save button logic
11. [ ] Hebrew error messages, natural phrasing
12. [ ] State reset via `prevOpenRef` pattern
13. [ ] All labels and placeholders in Hebrew
14. [ ] RTL alignment: `text-start` on selects, `start-*` for input icons, `ps-`/`pe-` for padding
15. [ ] Field order follows: who → where → how many → when → what → description
