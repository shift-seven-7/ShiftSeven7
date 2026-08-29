'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  className?: string;
}

/**
 * ThemeToggle - Theme switcher button (Rentier Style)
 *
 * Features:
 * - Toggle between light and dark modes
 * - Animated icon transition
 * - Proper SSR handling to prevent hydration mismatch
 * - Minimum touch target size (44x44px)
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <button
        className={cn(
          'p-2 rounded-lg',
          'bg-secondary',
          'text-muted-foreground',
          'min-h-[44px] min-w-[44px]',
          'flex items-center justify-center',
          className
        )}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'p-2 rounded-lg',
        'bg-secondary hover:bg-muted',
        'text-muted-foreground',
        'transition-colors duration-200',
        'min-h-[44px] min-w-[44px]',
        'flex items-center justify-center',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
