'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Sidebar, useSidebarNavItems } from './Sidebar';
import { Header } from './Header';
import { MobileNavProvider, useMobileNav } from './MobileNavContext';
import { MobileNavList } from './MobileNavList';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isRedundantSingleModuleLink } = useSidebarNavItems();
  const { items: rawMobileNavOverride, title: mobileNavTitle } = useMobileNav();
  // Only take over the drawer when the platform Sidebar itself would be
  // redundant here (see the desktop rail below) — a role with real platform
  // destinations besides the current module (e.g. admin: Home/Users/
  // Settings) keeps seeing those in the drawer; only a role whose platform
  // nav is JUST the current module (nothing to lose) gets the swap.
  const mobileNavOverride = isRedundantSingleModuleLink ? rawMobileNavOverride : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Skipped when the whole platform nav is just the one module the user
          is already inside — see useSidebarNavItems. Desktop only: at lg+
          this rail and the module's own nav render in the same row, so a
          redundant single link here read as a second, near-empty menu. */}
      {!isRedundantSingleModuleLink && (
        <div className="hidden lg:block">
          <Sidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed((value) => !value)}
          />
        </div>
      )}

      {/* RTL: the drawer slides in from the right, matching the desktop side.
          Content is the platform Sidebar's own list by default — but a
          module whose own layout called useRegisterMobileNav (e.g. Shift7)
          takes over this drawer with its real routes instead, so a phone
          user gets one nav surface behind the hamburger, not a near-empty
          platform list plus a separate strip living on the page itself. */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetTitle className="sr-only">{mobileNavTitle ? `תפריט ${mobileNavTitle}` : 'תפריט ניווט'}</SheetTitle>
          {mobileNavOverride ? (
            <MobileNavList
              items={mobileNavOverride}
              title={mobileNavTitle}
              onNavigate={() => setIsMobileOpen(false)}
            />
          ) : (
            <Sidebar
              isCollapsed={false}
              onToggleCollapse={() => {}}
              onNavigate={() => setIsMobileOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setIsMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/**
 * The authenticated chrome: persistent sidebar on desktop, drawer on mobile,
 * sticky header, scrolling content area. MobileNavProvider wraps the whole
 * tree so both the drawer (the reader) and any module page nested in
 * `children` (a writer, via useRegisterMobileNav) can reach the same context.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <AppShellInner>{children}</AppShellInner>
    </MobileNavProvider>
  );
}
