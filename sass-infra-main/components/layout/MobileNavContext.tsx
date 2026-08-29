'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MobileNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  disabled?: boolean;
}

interface MobileNavState {
  items: MobileNavItem[] | null;
  title?: string;
}

interface MobileNavContextValue extends MobileNavState {
  setState: (state: MobileNavState) => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

/**
 * Lets a module's own layout (e.g. Shift7's) become the content of the
 * platform's mobile hamburger drawer while the user is inside it, instead of
 * the generic platform Sidebar's own (possibly near-empty, for a
 * single-module role) list. AppShell wraps its whole tree in this so both
 * the module layout (the writer, via useRegisterMobileNav) and the drawer
 * itself (the reader, via useMobileNav) can reach it.
 */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileNavState>({ items: null });
  return <MobileNavContext.Provider value={{ ...state, setState }}>{children}</MobileNavContext.Provider>;
}

function useMobileNavContext() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error('useMobileNavContext must be used within MobileNavProvider');
  return ctx;
}

/** The drawer reads this: non-null means "render this instead of the platform Sidebar". */
export function useMobileNav() {
  const { items, title } = useMobileNavContext();
  return { items, title };
}

/**
 * A module's own layout calls this with its current nav list (already
 * filtered/ordered for the signed-in role, with `isActive` computed by the
 * caller — this hook stays domain-blind, no route-matching logic of its
 * own). Registers only while the calling component stays mounted; clears
 * itself on unmount or when the module's route is left, so a platform page
 * with no module of its own gets the ordinary Sidebar list back.
 *
 * Keyed off a derived string, not the items array itself: the caller
 * reconstructs that array every render, and depending on the array
 * reference directly would re-fire this effect (and re-render every other
 * consumer of the context) on every unrelated render — including one this
 * effect itself triggered, which is an infinite loop.
 */
export function useRegisterMobileNav(items: MobileNavItem[] | null, title?: string) {
  const { setState } = useMobileNavContext();
  const key = items
    ? items.map((i) => `${i.href}:${i.label}:${i.isActive}:${i.disabled ?? false}`).join('|')
    : '';

  useEffect(() => {
    setState({ items, title });
    return () => setState({ items: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, title]);
}
