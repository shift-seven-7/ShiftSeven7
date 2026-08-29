---
name: confirmation-dialogs
description: Confirmation modal patterns (RTL Hebrew). Covers AlertDialog for destructive/critical confirms and Dialog for in-flow confirms, including the required RTL footer reversal so the primary action sits on the right. Always use when adding or modifying a confirmation/approval modal.
---

# Confirmation Dialog Patterns

This app is **RTL Hebrew-first**. The default shadcn footer is left-aligned (LTR), so any confirmation modal **must** flip the footer for RTL — otherwise the primary action ends up on the wrong side and contradicts every other confirm in the app.

## When to use which

| Use case | Component |
|---|---|
| Destructive action (delete, clear, discard) | `AlertDialog` |
| Critical confirmation that blocks a flow (publish, send, lock) | `AlertDialog` |
| In-flow choice or quick form (rename, set value, pick option) | `Dialog` |

`AlertDialog` is keyboard-modal: it traps focus and forces a button click — correct for "are you sure?" gates. `Dialog` is dismissible by overlay click and ESC.

## The RTL rules (non-negotiable)

1. **`dir="rtl"` on the content element** — `<AlertDialogContent dir="rtl">` or `<DialogContent dir="rtl">`.
2. **`flex-row-reverse gap-2` on the footer** — flips the primary action to the right (RTL start).
3. **Order in JSX: cancel first, then action.** With `flex-row-reverse`, this puts cancel on the left and action on the right — matching every other confirm in the app.
4. **Destructive styling**: `bg-destructive text-destructive-foreground hover:bg-destructive/90` (use the design tokens, never raw `bg-red-500`).

## Reference: AlertDialog (destructive)

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialogContent dir="rtl">
    <AlertDialogHeader>
      <AlertDialogTitle>מחיקת צ'קליסט</AlertDialogTitle>
      <AlertDialogDescription>
        האם אתה בטוח שברצונך למחוק את הצ'קליסט? פעולה זו אינה ניתנת לביטול.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter className="flex-row-reverse gap-2">
      <AlertDialogCancel>ביטול</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleDelete}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        disabled={isPending}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
        מחק
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Live examples:
- `components/checklists/ChecklistPageContent.tsx`
- `components/tasks/task-full-screen-overlay.tsx` (around the delete-task button)

## Reference: Dialog (in-flow confirm)

```tsx
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent dir="rtl" className="max-w-xs">
    <DialogHeader>
      <DialogTitle>מחיקת שורה</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      האם למחוק את השורה?
    </p>
    <DialogFooter className="flex-row-reverse gap-2 sm:gap-2">
      <Button variant="destructive" onClick={handleDelete}>
        מחיקה
      </Button>
      <Button variant="ghost" onClick={cancel}>
        ביטול
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Live example: `components/custom-tables/SpreadsheetGrid.tsx` (the row-delete dialog).

> Note: `DialogFooter` already includes `sm:space-x-reverse` in its base class, so add **only** `flex-row-reverse gap-2 sm:gap-2` — do **not** add other `space-x-*` classes.

## Action labels (Hebrew)

Match the verb to the user's mental model — "are you sure you want to ___?":

| Action | Label |
|---|---|
| Delete | `מחק` / `מחיקה` |
| Clear | `נקה` |
| Discard changes | `בטל שינויים` |
| Confirm generic | `אישור` |
| Cancel | `ביטול` |

Never `OK` / `Yes`. Always a verb that matches the action.

## Title + description rules

- **Title**: noun phrase, no question mark. `מחיקת משימה`, `ניקוי טבלה`, `סגירת חוזה`.
- **Description**: a complete sentence + irreversibility warning when relevant.
  - Reversible: `האם למחוק את השורה?` (one short line is enough).
  - Irreversible: `... פעולה זו אינה ניתנת לביטול.` always append this.
- Keep the description **factual**, not scary. Say what will be deleted, not "this is dangerous!".

## Pending / async actions

Disable the action button while the mutation is pending and show a spinner:

```tsx
<AlertDialogAction
  onClick={handleConfirm}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
  disabled={mutation.isPending}
>
  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
  מחק
</AlertDialogAction>
```

Note: `ms-2` (margin-start) — RTL logical property. Never `ml-2` / `mr-2`.

## Common mistakes

❌ Forgetting `dir="rtl"` on the content → header + description align left.
❌ Plain `<AlertDialogFooter>` → primary button ends up on the left.
❌ `bg-red-500` instead of `bg-destructive` → breaks dark mode and theme tokens.
❌ Using `Dialog` for delete confirmations — overlay click cancels the modal, which is fine for "rename" but unsafe for "delete forever". Use `AlertDialog` for destructive.
❌ Using non-verb labels like `כן` / `אישור` for destructive actions — always name the action (`מחק`, `נקה`, `בטל`).
❌ Wiring the cancel button to do something other than dismiss — `AlertDialogCancel` already calls `onOpenChange(false)`, no `onClick` needed.

## Trigger pattern

Two ways to open:

**Controlled (recommended for buttons in a toolbar):**
```tsx
const [showConfirm, setShowConfirm] = useState(false);
<Button onClick={() => setShowConfirm(true)}>...</Button>
<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>...</AlertDialog>
```

**Trigger-based (for inline buttons next to a row):**
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost"><Trash2 className="h-4 w-4" /></Button>
  </AlertDialogTrigger>
  <AlertDialogContent dir="rtl">...</AlertDialogContent>
</AlertDialog>
```

Use controlled when state needs to persist across re-renders or when multiple actions can open the same dialog.
