---
name: design-system
description: Modern SaaS design system for a Hebrew-first RTL multi-tenant platform. Dark mode first approach with violet/indigo primary colors. Includes RTL layout guidelines and mobile-first responsive design patterns.
---

# Design System

## Design Philosophy

### Core Principles
1. **Dark Mode First**: Design for dark backgrounds first, then adapt for light mode
2. **Hebrew-First RTL**: All layouts use logical properties (start/end instead of left/right)
3. **Mobile-First Responsive**: Base styles target mobile, then enhance with breakpoints
4. **Modern Minimalism**: Clean, spacious layouts with purposeful elements
5. **Accessible**: WCAG 2.1 AA compliant color contrasts, minimum 44x44px touch targets

### Visual Identity
- **Primary Color**: Violet/Indigo (`--primary: 263 70% 58%`) — trust, innovation, professionalism
- **Aesthetic**: Modern SaaS dashboard with glassmorphism accents and subtle gradients
- **Typography**: Heebo font for Hebrew-optimized readability

---

## Color System

> **Full variable definitions** are in `app/globals.css`. Read that file for exact HSL values.

### Token Categories

| Category | Key Variables | Purpose |
|----------|--------------|---------|
| **Base** | `--background`, `--foreground`, `--foreground-muted` | Page bg, text colors |
| **Surfaces** | `--card`, `--card-elevated`, `--card-foreground` | Card/panel backgrounds |
| **Primary** | `--primary`, `--primary-hover`, `--primary-muted` | Violet CTA/accent |
| **Secondary** | `--secondary`, `--secondary-hover` | Zinc neutral actions |
| **Accent** | `--accent`, `--accent-hover` | Electric blue highlights |
| **Semantic** | `--success`, `--warning`, `--error`, `--info` | Status colors (each has `-muted` and `-background` variants) |
| **Border** | `--border`, `--border-subtle`, `--border-focus` | Borders and dividers |
| **Input** | `--input`, `--input-background`, `--ring` | Form elements |
| **Charts** | `--chart-1` through `--chart-6` | Data visualization |

Light mode overrides are in `.light` / `[data-theme="light"]` in `globals.css`.

Primary and zinc color scales (`--primary-50` through `--primary-950`, `--zinc-50` through `--zinc-950`) are also available — see `globals.css`.

### Using Colors in Tailwind

Colors are mapped in `tailwind.config.ts`. Use semantic names:

```tsx
<div className="bg-background text-foreground">
<div className="bg-card border-border">
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
<span className="text-muted-foreground">
<div className="bg-success-background text-success">
```

---

## Typography

- **Font**: `font-sans` = Heebo (Hebrew-optimized), `font-mono` = JetBrains Mono
- **Weights**: 300 (light) through 800 (extrabold)
- **Display sizes**: `text-display-2xl` (72px), `text-display-xl` (60px), `text-display-lg` (48px)
- **Body sizes**: `text-xl` through `text-xs` (standard Tailwind scale)
- **Labels**: `text-label-sm` (11px/500)

Full typography scale and custom `fontSize` entries are in `tailwind.config.ts`.

---

## RTL & Mobile-First Design

### RTL Rules

**Always use logical properties for RTL compatibility.**

| Instead of | Use | CSS Property |
|------------|-----|-------------|
| `ml-4` | `ms-4` | margin-inline-start |
| `mr-4` | `me-4` | margin-inline-end |
| `pl-4` | `ps-4` | padding-inline-start |
| `pr-4` | `pe-4` | padding-inline-end |
| `text-left` | `text-start` | text-align: start |
| `text-right` | `text-end` | text-align: end |
| `left-0` | `start-0` | inset-inline-start |
| `right-0` | `end-0` | inset-inline-end |
| `border-l` | `border-s` | border-inline-start |
| `border-r` | `border-e` | border-inline-end |
| `rounded-l-lg` | `rounded-s-lg` | border-start-radius |
| `rounded-r-lg` | `rounded-e-lg` | border-end-radius |

### Icons and Arrows

Directional icons must flip in RTL:

```tsx
<ChevronRight className="rtl:rotate-180" />
```

### Breakpoints (Mobile-First)

- **Mobile**: Default (< 640px)
- **Tablet**: `sm:` (>= 640px)
- **Desktop**: `md:` (>= 768px)
- **Large Desktop**: `lg:` (>= 1024px)
- **XL Desktop**: `xl:` (>= 1280px)

```tsx
// ✅ Mobile first
<div className="w-full md:w-1/2 lg:w-1/3">

// ❌ Desktop first
<div className="w-1/3 md:w-full">
```

### Mobile-Specific Rules

**Touch Targets**: Minimum 44x44px

```tsx
<button className="min-h-[44px] min-w-[44px] p-2">
  <Icon className="w-5 h-5" />
</button>
```

**Font Sizes**: Minimum 16px on mobile inputs to prevent iOS zoom

```tsx
<input className="text-base md:text-sm" />
```

**Spacing**: Generous on mobile, tighter on desktop

```tsx
<div className="space-y-4 px-4 md:space-y-2 md:px-6">
```

---

## Component Patterns (Tailwind Classes)

### Action Buttons (Page Headers / Toolbars)

All action buttons use **compact, rounded** styling. Reference: `app/app/electrical-panel/page.tsx`.

```tsx
// Outline text button — responsive: icon-only on mobile, text on desktop
<Button
  variant="outline"
  className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3 text-xs font-medium rounded-lg md:gap-1.5"
>
  <ShoppingCart className="h-3.5 w-3.5" />
  <span className="hidden md:inline">פריט חדש</span>
</Button>

// Primary CTA button (always shows text)
<Button className="h-9 px-3 text-xs font-medium rounded-lg gap-1.5">
  <Plus className="h-3.5 w-3.5" />
  יצירה חדשה
</Button>

// Ghost icon button (edit, share, etc.)
<Button variant="ghost" size="icon"
  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
>
  <Pencil className="h-3.5 w-3.5" />
</Button>

// Destructive ghost icon button (delete)
<Button variant="ghost" size="icon"
  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
>
  <Trash2 className="h-3.5 w-3.5" />
</Button>
```

**Rules:**
- Always use `rounded-lg` on action buttons
- Icon size: `h-3.5 w-3.5` (14px)
- Text: `text-xs font-medium`
- Mobile: `h-8 w-8 p-0` (icon-only square), Desktop: `md:h-9 md:w-auto md:px-3`
- Text labels wrapped in `<span className="hidden md:inline">` for responsive
- Ghost hover: `hover:bg-muted/50`, Destructive hover: `hover:bg-destructive/10`
- Do NOT use `min-h-[44px]` on toolbar buttons — use the compact pattern above

### Cards

```tsx
// Base card
<div className="bg-card border border-border rounded-lg shadow-sm">
  <div className="p-4 md:p-6 border-b border-border">{/* header */}</div>
  <div className="p-4 md:p-6">{/* content */}</div>
</div>

// Interactive card
<div className="bg-card border border-border rounded-lg shadow-sm transition-all cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5">
```

### Inputs

```tsx
<input className="w-full h-11 md:h-10 px-3 text-base md:text-sm bg-input-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15 disabled:opacity-50 disabled:cursor-not-allowed" />
```

### Badges

```tsx
<span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/15 text-primary">
// Variants: bg-success-background text-success | bg-warning-background text-warning | bg-error-background text-error
```

### Tables — Responsive Pattern

```tsx
{/* Mobile: cards */}
<div className="md:hidden space-y-4">
  {data.map((item) => (
    <div key={item.id} className="bg-card border border-border p-4 rounded-lg">
      <div className="font-bold mb-2">{item.name}</div>
      <div className="text-sm text-muted-foreground">{item.description}</div>
    </div>
  ))}
</div>

{/* Desktop: table */}
<div className="hidden md:block border border-border rounded-lg overflow-hidden">
  <table className="w-full">
    <thead className="bg-background-subtle border-b border-border">
      <tr>
        <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {col.label}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-border last:border-b-0 hover:bg-secondary/50 transition-colors">
        <td className="px-4 py-4 text-sm text-foreground">{value}</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Animations

Available animation utilities (defined in `tailwind.config.ts`):

| Tailwind Class | Effect |
|---------------|--------|
| `animate-fade-in` | Fade in 200ms |
| `animate-fade-out` | Fade out 200ms |
| `animate-slide-up` | Slide up + fade 300ms |
| `animate-slide-down` | Slide down + fade 300ms |
| `animate-slide-in` | Slide in from start (RTL-aware) 300ms |
| `animate-scale-in` | Scale up + fade 200ms |
| `animate-shimmer` | Skeleton loading shimmer |

Skeleton loading pattern:

```tsx
<div className="bg-muted animate-shimmer rounded-md h-4 w-32" />
```

---

## Layout Patterns

### App Shell

```tsx
<div className="flex min-h-screen bg-background">
  {/* Sidebar (appears on right in RTL) */}
  <aside className="w-[280px] shrink-0 bg-card border-s border-border flex flex-col">
    {/* Nav items */}
  </aside>

  {/* Main area */}
  <div className="flex-1 flex flex-col min-w-0">
    <header className="h-16 px-4 md:px-6 bg-card border-b border-border flex items-center gap-4">
      {/* Header content */}
    </header>
    <main className="flex-1 p-4 md:p-6 overflow-y-auto">
      {/* Page content */}
    </main>
  </div>
</div>
```

### Dashboard Layout (Responsive)

```tsx
<div className="min-h-screen bg-background">
  <header className="bg-card border-b border-border px-4 py-3 md:px-8 md:py-4">
    <h1 className="text-xl md:text-2xl font-bold">לוח בקרה</h1>
  </header>

  <div className="flex flex-col md:flex-row">
    <aside className="w-full p-4 bg-card md:w-64 md:min-h-screen md:sticky md:top-0 order-2 md:order-1">
      {/* Navigation */}
    </aside>
    <main className="flex-1 p-4 md:p-8 order-1 md:order-2">
      {/* Content */}
    </main>
  </div>
</div>
```

### Dashboard Grid

```tsx
{/* Stats grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
  <StatCard />
</div>

{/* 12-col grid (desktop) */}
<div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
  <div className="md:col-span-8">{/* Main */}</div>
  <div className="md:col-span-4">{/* Sidebar */}</div>
</div>
```

---

## Usage Examples

### Stat Card

```tsx
function StatCard({ icon: Icon, label, value, change, changeType }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 transition-all hover:border-primary/50 hover:shadow-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-md text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <Badge variant={changeType === "positive" ? "success" : "error"}>
          {change}
        </Badge>
      </div>
      <div className="text-2xl md:text-3xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
```

### RTL-Safe Button Group

```tsx
<div className="flex items-center gap-2">
  {/* Flex automatically respects RTL direction */}
  <Button variant="secondary">ביטול</Button>
  <Button variant="primary">שמור</Button>
</div>
```

---

## Hebrew UI Text Labels

```typescript
export const hebrewLabels = {
  // Actions
  save: "שמור", cancel: "ביטול", delete: "מחק", edit: "עריכה",
  add: "הוסף", create: "צור", update: "עדכן", submit: "שלח",
  confirm: "אישור", close: "סגור", back: "חזרה", next: "הבא",
  previous: "הקודם", search: "חיפוש", filter: "סינון", sort: "מיון",
  export: "ייצוא", import: "ייבוא", download: "הורדה", upload: "העלאה",

  // Status
  active: "פעיל", inactive: "לא פעיל", pending: "ממתין",
  approved: "מאושר", rejected: "נדחה", completed: "הושלם",
  inProgress: "בתהליך", onHold: "מושהה", cancelled: "בוטל",

  // Navigation
  home: "דף הבית", dashboard: "לוח בקרה", projects: "פרויקטים",
  areas: "אזורים", tasks: "משימות", users: "משתמשים",
  settings: "הגדרות", profile: "פרופיל", reports: "דוחות",
  documents: "מסמכים",

  // Time
  today: "היום", yesterday: "אתמול", thisWeek: "השבוע",
  thisMonth: "החודש", lastMonth: "חודש שעבר",

  // Messages
  loading: "טוען...", noResults: "לא נמצאו תוצאות",
  error: "שגיאה", success: "הצלחה", warning: "אזהרה",

  // Forms
  required: "שדה חובה", optional: "אופציונלי",
  email: "דואר אלקטרוני", password: "סיסמה", name: "שם",
  phone: "טלפון", address: "כתובת", description: "תיאור", notes: "הערות",
};
```

---

## New Component Checklist

- [ ] Uses CSS variables via Tailwind semantic names (not raw hex/HSL)
- [ ] Uses logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`)
- [ ] Dark mode styles by default; light mode via `.light` overrides
- [ ] Heebo font family (`font-sans`)
- [ ] Focus states with `focus-visible:ring-2 focus-visible:ring-ring`
- [ ] Hover transitions (`transition-all` or `transition-colors`)
- [ ] Mobile-first responsive (`base` = mobile, `md:` = desktop)
- [ ] Touch-friendly targets (min 44x44px)
- [ ] Accessible color contrast (4.5:1 minimum for text)
- [ ] Loading/disabled states
- [ ] All UI text in Hebrew
