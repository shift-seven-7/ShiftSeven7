/**
 * Central query-key factory.
 *
 * Every `queryKey` in the app comes from here — no inline string arrays. That
 * is what makes targeted invalidation possible: `queryKeys.users.all`
 * invalidates every user query, `queryKeys.users.detail(id)` just one.
 *
 * Shape convention per entity:
 *   all      ['users']
 *   lists()  ['users', 'list']
 *   list(f)  ['users', 'list', filters]
 *   details() ['users', 'detail']
 *   detail(id) ['users', 'detail', id]
 */

export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: UserFilters) => [...queryKeys.users.lists(), filters ?? {}] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    /** The signed-in user's own profile, role and resolved module set. */
    me: () => [...queryKeys.users.all, 'me'] as const,
    preferences: () => [...queryKeys.users.all, 'preferences'] as const,
  },

  tenants: {
    all: ['tenants'] as const,
    lists: () => [...queryKeys.tenants.all, 'list'] as const,
    list: () => [...queryKeys.tenants.lists()] as const,
    details: () => [...queryKeys.tenants.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tenants.details(), id] as const,
    setup: (id: string) => [...queryKeys.tenants.all, 'setup', id] as const,
    verify: (id: string) => [...queryKeys.tenants.all, 'verify', id] as const,
  },

  /** The current tenant's own settings — logo, modules, PDF branding, legal. */
  tenantSettings: {
    all: ['tenant-settings'] as const,
    current: () => [...queryKeys.tenantSettings.all, 'current'] as const,
  },

  systemSettings: {
    all: ['system-settings'] as const,
    byKey: (key: string) => [...queryKeys.systemSettings.all, key] as const,
  },

  featureDefaults: {
    all: ['feature-defaults'] as const,
    list: () => [...queryKeys.featureDefaults.all, 'list'] as const,
  },

  files: {
    all: ['files'] as const,
    lists: () => [...queryKeys.files.all, 'list'] as const,
    byEntity: (entityType: string, entityId: string) =>
      [...queryKeys.files.lists(), entityType, entityId] as const,
  },

  terms: {
    all: ['terms'] as const,
    acceptance: () => [...queryKeys.terms.all, 'acceptance'] as const,
  },

  // ── Shift7 module ─────────────────────────────────────────────────────────
  shift7Staff: {
    all: ['shift7', 'staff'] as const,
    lists: () => [...queryKeys.shift7Staff.all, 'list'] as const,
    list: (search?: string) => [...queryKeys.shift7Staff.lists(), search ?? ''] as const,
    detail: (id: string) => [...queryKeys.shift7Staff.all, 'detail', id] as const,
  },
  shift7Facilities: {
    all: ['shift7', 'facilities'] as const,
    list: () => [...queryKeys.shift7Facilities.all, 'list'] as const,
  },
  shift7Posts: {
    all: ['shift7', 'posts'] as const,
    list: () => [...queryKeys.shift7Posts.all, 'list'] as const,
  },
  shift7ShiftTemplates: {
    all: ['shift7', 'shift-templates'] as const,
    list: () => [...queryKeys.shift7ShiftTemplates.all, 'list'] as const,
  },
  shift7StaffingRequirements: {
    all: ['shift7', 'staffing-requirements'] as const,
    list: () => [...queryKeys.shift7StaffingRequirements.all, 'list'] as const,
  },
  shift7SystemConfig: {
    all: ['shift7', 'system-config'] as const,
    list: () => [...queryKeys.shift7SystemConfig.all, 'list'] as const,
  },
  shift7ShiftRequests: {
    all: ['shift7', 'shift-requests'] as const,
    mine: (weekStart?: string) => [...queryKeys.shift7ShiftRequests.all, 'mine', weekStart ?? ''] as const,
    all_: (weekStart: string, facilityId?: string) =>
      [...queryKeys.shift7ShiftRequests.all, 'all', weekStart, facilityId ?? ''] as const,
  },
  shift7ShiftAssignments: {
    all: ['shift7', 'shift-assignments'] as const,
    range: (from: string, to: string, facilityId?: string, staffId?: string) =>
      [...queryKeys.shift7ShiftAssignments.all, 'range', from, to, facilityId ?? '', staffId ?? ''] as const,
  },
  shift7EmployeeRequests: {
    all: ['shift7', 'employee-requests'] as const,
    mine: () => [...queryKeys.shift7EmployeeRequests.all, 'mine'] as const,
    list: (status?: string) => [...queryKeys.shift7EmployeeRequests.all, 'list', status ?? 'all'] as const,
  },
} as const;
