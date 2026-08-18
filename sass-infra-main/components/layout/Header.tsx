'use client';

import Link from 'next/link';
import { LogOut, Menu, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { getRoleDisplayName } from '@/lib/constants/roles';
import { identityLabel } from '@/lib/utils';

interface HeaderProps {
  onOpenMobileNav: () => void;
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { user, role } = usePermissions();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Full navigation so the proxy sees the cleared session.
    window.location.href = '/auth/login';
  }

  const initials =
    user?.fullName
      ?.split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('') || identityLabel(user?.email, user?.phone)[0]?.toUpperCase();

  return (
    <header className="sticky top-0 z-sticky flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="פתיחת התפריט"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Pushes the controls to the end edge (left in RTL). */}
      <div className="flex-1" />

      <ThemeToggle />

      <DropdownMenu dir="rtl">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="תפריט משתמש"
          >
            <Avatar className="h-9 w-9">
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium">
              {user?.fullName || identityLabel(user?.email, user?.phone)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {getRoleDisplayName(role)}
            </p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/app/profile" className="cursor-pointer gap-2">
              <UserIcon className="h-4 w-4" />
              הפרופיל שלי
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2">
            <LogOut className="h-4 w-4" />
            התנתקות
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
