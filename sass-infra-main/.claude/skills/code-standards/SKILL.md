---
name: code-standards
description: Coding standards and best practices for Next.js 14+ with TypeScript, Supabase, and Tailwind CSS. Ensures clean, maintainable, and consistent code across the project.
---

# Code Standards & Best Practices

**Architecture:** Client-First (CSR only, no SSR/SEO). All DB/auth through API routes.

---

## 1. Project Structure & Naming

```
/app
  /(auth)              # Public auth routes
  /(protected)         # Protected routes (projects, areas, admin)
  /api                 # API routes — all Supabase calls happen here
  layout.tsx           # Root layout (RTL, Heebo font)
  globals.css

/components
  /ui                  # Reusable UI (shadcn/ui)
  /layout              # Layout components (sidebar, header)
  /features            # Feature-specific (projects, areas)

/hooks/queries         # TanStack Query hooks + keys.ts

/lib
  /supabase            # Supabase clients (server + client)
  /utils               # Utility functions (cn, formatDate)
  /constants           # Constants & config

/types
  database.types.ts    # Generated Supabase types
  index.ts             # Custom types
```

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase + `use` prefix | `usePermissions.ts` |
| Utils | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |
| Types/Interfaces | PascalCase | `UserRole`, `ProjectData` |
| Files (non-component) | kebab-case | `api-client.ts` |

---

## 2. TypeScript Standards

**Use explicit types. Avoid `any`.**

```typescript
// Interface for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Type for unions/intersections
type UserRole = 'ADMIN' | 'MANAGER' | 'USER';
type AdminUser = User & { role: 'ADMIN'; permissions: string[] };
```

**Use `unknown` + type guards for truly unknown data:**

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}
```

**Use generated Supabase types:**

```typescript
import { Database } from '@/types/database.types';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
```

---

## 3. Component Standards

### Component Structure Order

```typescript
'use client';

import { /* ... */ } from 'package';

// 1. Types/Interfaces
interface ComponentProps { /* ... */ }

// 2. Component
export default function Component({ title, onSave }: ComponentProps) {
  // 3. Hooks (useState, useQuery, custom hooks)
  // 4. Derived state
  // 5. Event handlers
  // 6. Effects
  // 7. Early returns (loading, error, auth)
  // 8. Render
  return <div>...</div>;
}

// 9. Helper functions (outside component)
```

### Client-First Architecture

All pages use `'use client'`. Data fetching uses TanStack Query hooks (see **tanstack-query** skill).

```typescript
'use client';

import { useProjects } from '@/hooks/queries/useProjects';

export default function ProjectsPage() {
  const { data: projects, isPending, error } = useProjects();

  if (isPending) return <div>טוען...</div>;
  if (error) return <div>שגיאה: {error.message}</div>;

  return (
    <div>
      {projects?.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

### Props

Always destructure. Use default parameters for optional props:

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
  // ...
}
```

---

## 4. Supabase & API Routes

### Rule: All DB/Auth Through API Routes

```
Frontend (Client Components)
    ↓ fetch('/api/...')  — via TanStack Query hooks
Next.js API Routes (/app/api/*)
    ↓ supabase.from('...') / supabase.auth.*
Supabase
```

**Frontend components must never:**
- Import `@/lib/supabase/client` for database queries
- Call `supabase.from()` directly
- Call `supabase.auth.signIn*()` / `signUp()` / `signOut()` directly

**Exception:** `onAuthStateChange` listener is allowed in client components for detecting auth state changes.

### API Route Pattern

```typescript
// /app/api/projects/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data });
}
```

### Supabase Query Patterns (Server-Side Only)

```typescript
// Select specific fields
const { data } = await supabase
  .from('projects')
  .select('id, name, status')
  .eq('area_id', areaId);

// Joins
const { data } = await supabase
  .from('projects')
  .select(`*, area:areas(id, name), owner:users(id, full_name)`)
  .eq('id', projectId)
  .single();
```

**Always handle errors from Supabase:**

```typescript
const { data, error } = await supabase.from('projects').select('*');
if (error) throw new Error(`Database error: ${error.message}`);
```

---

## 5. Styling with Tailwind

### cn() Utility

```typescript
import { cn } from '@/lib/utils';

<button className={cn(
  'px-4 py-2 rounded-lg font-medium transition-colors',
  variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
  variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
  disabled && 'opacity-50 cursor-not-allowed',
)}>
```

### Class Organization Order

Layout → Spacing → Sizing → Typography → Colors → Borders → Effects → Responsive

```tsx
<div className="flex flex-col items-center p-4 mb-6 w-full max-w-2xl text-lg font-semibold bg-card text-foreground border border-border rounded-lg shadow-md hover:shadow-lg md:flex-row md:p-6">
```

**Never use inline styles.** Use Tailwind classes.

---

## 6. Error Handling

```typescript
// API routes: try-catch with proper HTTP responses
export async function GET() {
  try {
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw new Error(error.message);
    return NextResponse.json({ projects: data });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

Error boundary component for pages:

```typescript
'use client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">משהו השתבש</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
        נסה שוב
      </button>
    </div>
  );
}
```

---

## 7. Performance

- **Memoize** expensive calculations with `useMemo`
- **Lazy load** heavy components with `dynamic(() => import(...), { ssr: false })`
- **Optimize images** with `next/image` (set `priority` only for above-fold)
- **Use `select`** in TanStack Query to transform data and prevent unnecessary re-renders

---

## 8. Accessibility

- Use **semantic HTML** (`nav`, `main`, `article`, `button`) — not div soup
- Add **`aria-label`** to icon-only buttons (Hebrew text)
- Support **keyboard navigation** (Escape to close modals, Enter to submit)
- All form inputs need associated labels or `aria-describedby`

---

## Code Review Checklist

- [ ] All pages have `'use client'` directive
- [ ] No direct Supabase calls from frontend components
- [ ] Data fetching uses TanStack Query hooks (see tanstack-query skill)
- [ ] TypeScript types are explicit (no `any`)
- [ ] All API routes have error handling
- [ ] RTL classes used (`ms-`, `me-`, `text-start`) — see design-system skill
- [ ] Mobile-first responsive design
- [ ] Touch targets minimum 44x44px
- [ ] Semantic HTML used
- [ ] ARIA labels where needed
- [ ] Hebrew text in UI
- [ ] Loading states implemented
