---
name: tanstack-query
description: Data fetching standards using TanStack Query (React Query) v5. Covers query/mutation hooks, key management, optimistic updates, and the fetch-via-API-routes pattern. Use this skill for any data fetching or caching questions.
---

# TanStack Query v5 Standards

## Architecture Rules

### 1. Hook Location

All queries and mutations **must** reside in custom hooks under `@/hooks/queries/`.

```
hooks/
└── queries/
    ├── keys.ts           # Central query keys factory
    ├── useProjects.ts    # Project-related queries/mutations
    ├── useAreas.ts       # Area-related queries/mutations
    ├── useUsers.ts       # User-related queries/mutations
    └── useDashboard.ts   # Dashboard queries
```

**Never inline `useQuery` or `useMutation` directly in components.**

### 2. Key Management

Use a central `queryKeys` factory. No hardcoded strings in `queryKey`.

```typescript
// @/hooks/queries/keys.ts
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters?: ProjectFilters) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
  },
  areas: {
    all: ['areas'] as const,
    lists: () => [...queryKeys.areas.all, 'list'] as const,
    list: (filters?: AreaFilters) => [...queryKeys.areas.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.areas.all, 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
    detail: (id: string) => [...queryKeys.users.all, 'detail', id] as const,
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
  },
} as const;
```

### 3. All Fetchers Use API Routes

Fetcher functions call `/api/*` endpoints — never import or use the Supabase client directly.

```typescript
// ✅ Correct
async function fetchProjects(filters?: ProjectFilters): Promise<Project[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.area_id) params.set('area_id', filters.area_id);

  const url = `/api/projects${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.error || 'Failed to fetch projects');
  }

  return json.projects;
}
```

---

## TanStack Query v5 Conventions

### Object-Based Syntax (Required)

```typescript
// ✅ v5 object syntax
const query = useQuery({
  queryKey: queryKeys.projects.list(),
  queryFn: fetchProjects,
  staleTime: 1000 * 60 * 1,
});

// ❌ old array syntax
const query = useQuery(queryKeys.projects.list(), fetchProjects);
```

### Use `isPending` Not `isLoading`

```typescript
// ✅ v5
const { data, isPending, error } = useQuery({...});
if (isPending) return <Spinner />;

// ❌ deprecated
const { data, isLoading } = useQuery({...});
```

### Always Throw Errors

React Query catches thrown errors. Always throw, never return error objects:

```typescript
// ✅ Correct
async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Failed to fetch project');
  return json.project;
}
```

---

## Optimization Standards

### Default Stale Time

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 1, // 1 minute
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
```

### Use `select` for Transformations

```typescript
// ✅ transform in select — prevents unnecessary re-renders
const { data: activeProjects } = useQuery({
  queryKey: queryKeys.projects.list(),
  queryFn: fetchProjects,
  select: (projects) => projects.filter(p => p.status === 'IN_PROGRESS'),
});
```

### Optimistic Updates for Mutations

```typescript
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,

    onMutate: async (newProject) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.lists() });
      const previousProjects = queryClient.getQueryData<Project[]>(queryKeys.projects.list());

      queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (old) => {
        const optimistic: Project = {
          id: `temp-${Date.now()}`,
          name: newProject.name,
          description: newProject.description || null,
          status: 'PLANNING',
          area_id: newProject.area_id || null,
          created_at: new Date().toISOString(),
        };
        return old ? [...old, optimistic] : [optimistic];
      });

      return { previousProjects };
    },

    onError: (err, newProject, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(queryKeys.projects.list(), context.previousProjects);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}
```

---

## Hook Template

```typescript
// @/hooks/queries/useProjects.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

// Types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  area_id: string | null;
  area?: { id: string; name: string } | null;
  created_at: string;
}

export interface ProjectFilters {
  status?: Project['status'];
  area_id?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  area_id?: string;
}

// Fetchers (always use /api/* routes)
async function fetchProjects(filters?: ProjectFilters): Promise<Project[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.area_id) params.set('area_id', filters.area_id);

  const url = `/api/projects${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) throw new Error(json.error || 'Failed to fetch projects');
  return json.projects;
}

async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Failed to fetch project');
  return json.project;
}

async function createProject(input: CreateProjectInput): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Failed to create project');
  return json.project;
}

// Query Hooks
export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: () => fetchProjects(filters),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

// Mutation Hooks (see optimistic update pattern above)
```

---

## Component Usage Example

```typescript
'use client';

import { useProjects, useCreateProject } from '@/hooks/queries/useProjects';

export default function ProjectsPage() {
  const { data: projects, isPending, error } = useProjects();
  const createProject = useCreateProject();

  if (isPending) return <Loader2 className="animate-spin" />;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {projects?.map(project => (
        <div key={project.id}>{project.name}</div>
      ))}
    </div>
  );
}
```

---

## Checklist

Before committing data-fetching code, verify:

- [ ] Query/mutation is in a custom hook under `@/hooks/queries/`
- [ ] Using `queryKeys` factory (no hardcoded strings)
- [ ] Using v5 object syntax for `useQuery`/`useMutation`
- [ ] Using `isPending` not `isLoading`
- [ ] Fetcher functions call `/api/*` routes (no direct Supabase client)
- [ ] Errors are thrown (not returned)
- [ ] TypeScript interfaces defined for return data
- [ ] Mutations have optimistic updates (where appropriate)
- [ ] `select` used for data transformations
