'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/**
 * The authenticated chrome: persistent sidebar on desktop, drawer on mobile,
 * sticky header, scrolling content area.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((value) => !value)}
        />
      </div>

      {/* RTL: the drawer slides in from the right, matching the desktop side. */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
          <Sidebar
            isCollapsed={false}
            onToggleCollapse={() => {}}
            onNavigate={() => setIsMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setIsMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
