/**
 * Module registry — SHIPS EMPTY BY DESIGN.
 *
 * Every mechanism around it is wired and working: the admin toggle matrix, the
 * route guard, the sidebar filter, the per-tenant and per-user resolution. With
 * zero keys every guard is a no-op and the admin matrix shows an empty state.
 * A project fills this in as it grows.
 *
 * ── ADDING A MODULE (5 edit points, no migration) ────────────────────────────
 * 1. FEATURE_KEYS       — add the key
 * 2. getFeatureFlags()  — add the descriptor; it appears in the admin matrix
 * 3. ROUTE_FEATURES     — map the route prefix to the key; gates the page
 * 4. components/layout/Sidebar.tsx — nav item with `feature: FEATURE_KEYS.X`
 * 5. lib/constants/permissions.ts  — ROUTE_PERMISSIONS entry for the route
 *
 * Then build under app/app/<module>/ and app/api/<module>/, plus a migration
 * for its tables. See the `modules` skill.
 *
 * ── HOW A FLAG RESOLVES ──────────────────────────────────────────────────────
 *   tenants.settings.features        (master DB — what the tenant bought)
 *     ∩ tenant_feature_defaults      (tenant DB — what the tenant turned on)
 *     ∩ users.features_override      (tenant DB — per-user opt-out)
 *   Super roles bypass the last two and get the whole package.
 *   Merged in app/api/users/me/route.ts, consumed via usePermissions().
 */

export const FEATURE_KEYS = {
  SHIFT7: 'shift7',
} as const;

type RegisteredKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * While the registry is empty `RegisteredKey` is `never`, which would make
 * every feature-typed parameter unusable. Fall back to `string` until the first
 * key is added; from then on it narrows to the real union automatically.
 */
export type FeatureKey = [RegisteredKey] extends [never] ? string : RegisteredKey;

export interface FeatureFlag {
  key: FeatureKey;
  /** Hebrew label shown in the admin matrix. */
  label: string;
  description: string;
  /**
   * Sub-feature: only meaningful while its parent is on, and inherited when the
   * parent is enabled. See `resolveFeatureSet`.
   */
  parent?: FeatureKey;
}

export function getFeatureFlags(): FeatureFlag[] {
  return [
    {
      key: FEATURE_KEYS.SHIFT7,
      label: 'Shift7',
      description: 'ניהול משמרות, כוח אדם ותקני איוש למתקני אבטחה',
    },
  ];
}

export function getFeatureFlag(key: FeatureKey): FeatureFlag | undefined {
  return getFeatureFlags().find((flag) => flag.key === key);
}

export const ALL_FEATURE_KEYS: FeatureKey[] = getFeatureFlags().map((flag) => flag.key);

/**
 * Route prefix → the module(s) it requires.
 *
 * An array means "any of these" (OR). Checked by
 * app/app/ProtectedAppLayoutClient.tsx before a page renders.
 */
export const ROUTE_FEATURES: Record<string, FeatureKey | FeatureKey[]> = {
  '/app/shift7': FEATURE_KEYS.SHIFT7,
};

/** The module(s) required for `pathname`, or null if it is ungated. */
export function getRequiredFeatures(pathname: string): FeatureKey[] | null {
  const match = Object.keys(ROUTE_FEATURES)
    .filter((route) => pathname === route || pathname.startsWith(`${route}/`))
    // Longest prefix wins, so /app/x/y can be gated separately from /app/x.
    .sort((a, b) => b.length - a.length)[0];

  if (!match) return null;
  const required = ROUTE_FEATURES[match];
  return Array.isArray(required) ? required : [required];
}

export function getChildFeatureKeys(parent: FeatureKey): FeatureKey[] {
  return getFeatureFlags()
    .filter((flag) => flag.parent === parent)
    .map((flag) => flag.key);
}

/**
 * Normalises a stored feature list.
 *
 * - null/undefined means "everything" — a tenant with no explicit package gets
 *   the full registry, so adding a module does not silently switch it off for
 *   existing tenants.
 * - A sub-feature whose parent is off is dropped.
 * - A parent that is on with NONE of its children listed gets all of them.
 *   That is how a newly added child key reaches tenants whose stored list
 *   predates it, without a data migration.
 *
 *   The trade-off: a parent deliberately left on with every child disabled is
 *   indistinguishable from that legacy shape, and its children come back on.
 *   Disable the parent instead if that is what you meant.
 */
export function resolveFeatureSet(features: string[] | null | undefined): string[] | null {
  if (!features) return null;

  const enabled = new Set(features);
  const flags = getFeatureFlags();

  for (const flag of flags) {
    if (flag.parent) continue;
    if (!enabled.has(flag.key)) continue;

    const children = getChildFeatureKeys(flag.key);
    if (children.length > 0 && !children.some((child) => enabled.has(child))) {
      children.forEach((child) => enabled.add(child));
    }
  }

  // Orphans: a child cannot outlive its parent.
  for (const flag of flags) {
    if (flag.parent && !enabled.has(flag.parent)) {
      enabled.delete(flag.key);
    }
  }

  return Array.from(enabled);
}
