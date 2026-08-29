'use client';

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { COLOR_PRESETS, ColorPreset, DEFAULT_THEME } from './colors';

interface ThemeContextType {
  color: ColorPreset;
  setColor: (color: ColorPreset) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Fallback component during SSR/hydration
function ThemeFallback({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function applyColorPreset(preset: ColorPreset, isDark: boolean) {
  const colorData = COLOR_PRESETS[preset];
  const root = document.documentElement;
  const colors = isDark ? colorData.dark : colorData.light;

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  // Update related tokens that reference primary
  root.style.setProperty('--ring', colors.primary);
  root.style.setProperty('--border-focus', colors.primary);
  root.style.setProperty('--sidebar-primary', colors.primary);
  root.style.setProperty('--sidebar-ring', colors.primary);
  root.style.setProperty('--chart-1', colors.primary);
  root.style.setProperty('--shadow-glow', `0 0 20px hsl(${colors.primary} / 0.3)`);
}

function ThemeColorProvider({ children }: { children: React.ReactNode }) {
  const [color, setColorState] = useState<ColorPreset>(DEFAULT_THEME.color);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedColor = localStorage.getItem('theme-color') as ColorPreset;
    if (savedColor && COLOR_PRESETS[savedColor]) {
      setColorState(savedColor);
    }
  }, []);

  const setColor = useCallback((newColor: ColorPreset) => {
    setColorState(newColor);
    localStorage.setItem('theme-color', newColor);

    // Sync to server (fire and forget)
    fetch('/api/users/me/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme_color: newColor }),
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ color, setColor }}>
      {mounted ? <ThemeColorApplier color={color}>{children}</ThemeColorApplier> : children}
    </ThemeContext.Provider>
  );
}

function ThemeColorApplier({ color, children }: { color: ColorPreset; children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    applyColorPreset(color, isDark);
  }, [color, resolvedTheme]);

  return <>{children}</>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ThemeFallback>{children}</ThemeFallback>}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <ThemeColorProvider>
          {children}
        </ThemeColorProvider>
      </NextThemesProvider>
    </Suspense>
  );
}

export function useThemeColor() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeColor must be used within ThemeProvider');
  }
  return context;
}

// Re-export useTheme for convenience
export { useTheme };
