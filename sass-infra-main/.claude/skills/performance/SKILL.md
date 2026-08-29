---
name: performance
description: Performance best practices for Next.js API Routes + Supabase. Use when writing API routes, data fetching, or reviewing existing code for performance issues.
---

# Performance Standards

## 1. Parallel Data Fetching

**Always use `Promise.all` for independent queries:**
```typescript
// ❌ BAD - Sequential (slow)
const areas = await supabase.from('areas').select('*');
const users = await supabase.from('users').select('*');
const stats = await supabase.from('stats').select('*');

// ✅ GOOD - Parallel (fast)
const [areas, users, stats] = await Promise.all([
  supabase.from('areas').select('*'),
  supabase.from('users').select('*'),
  supabase.from('stats').select('*'),
]);
```

**Use `Promise.allSettled` when some queries can fail:**
```typescript
const [projects, notifications] = await Promise.allSettled([
  supabase.from('projects').select('*'),
  supabase.from('notifications').select('*'), // OK if fails
]);
```

---

## 2. Select Only What You Need

**Never use `select('*')` - specify fields:**
```typescript
// ❌ BAD
const { data } = await supabase.from('projects').select('*');

// ✅ GOOD
const { data } = await supabase.from('projects').select('id, name, status');
```

**Use relations instead of multiple queries:**
```typescript
// ❌ BAD - N+1 problem
const { data: projects } = await supabase.from('projects').select('*');
for (const project of projects) {
  const { data: area } = await supabase.from('areas').eq('id', project.area_id);
}

// ✅ GOOD - Single query with join
const { data } = await supabase
  .from('projects')
  .select('id, name, area:areas(id, name)');
```

---

## 3. Query by ID, Not Filter

**Use direct lookup when you have an ID:**
```typescript
// ❌ BAD
const { data } = await supabase.from('users').select('*');
const user = data?.find(u => u.id === userId);

// ✅ GOOD
const { data: user } = await supabase
  .from('users')
  .select('id, name, email')
  .eq('id', userId)
  .single();
```

---

## 4. Use Database for Counting
```typescript
// ❌ BAD
const { data } = await supabase.from('tasks').select('*');
const count = data?.length;

// ✅ GOOD
const { count } = await supabase
  .from('tasks')
  .select('*', { count: 'exact', head: true });
```

---

## 5. Pagination

**Always limit results for lists:**
```typescript
// ❌ BAD - Returns everything
const { data } = await supabase.from('projects').select('*');

// ✅ GOOD - Paginated
const { data, count } = await supabase
  .from('projects')
  .select('id, name', { count: 'exact' })
  .range(0, 19) // First 20 items
  .order('created_at', { ascending: false });
```

---

## 6. Error Handling Pattern

**Consistent error handling for API routes:**
```typescript
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('projects')
      .select('id, name');

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch' },
      { status: 500 }
    );
  }
}
```

---

## Quick Checklist

Before committing API route code:

- [ ] Independent queries use `Promise.all`
- [ ] `select()` specifies only needed fields
- [ ] Using `.eq('id', x).single()` for single item fetch
- [ ] Using relations instead of multiple queries
- [ ] Lists have pagination (`range` or `limit`)
- [ ] Counting uses `{ count: 'exact', head: true }`
- [ ] Proper error handling with try/catch