'use client';

import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, useThemeColor } from '@/lib/theme/theme-provider';
import { COLOR_PRESETS, type ColorPreset } from '@/lib/theme/colors';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

/**
 * Per-user appearance. Writes through to `users.theme_mode` / `theme_color`
 * (via the theme provider's fire-and-forget PUT), so the choice follows the
 * user to another device.
 */
export function AppearanceSettingsTab() {
  const { theme, setTheme } = useTheme();
  const { color, setColor } = useThemeColor();

  // next-themes only knows the real value after mount; rendering before that
  // would show the wrong option selected for a frame.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">מצב תצוגה</CardTitle>
          <CardDescription>בהיר, כהה, או לפי הגדרת מערכת ההפעלה</CardDescription>
        </CardHeader>

        <CardContent>
          <Segmented
            ariaLabel="מצב תצוגה"
            value={mounted ? (theme ?? 'system') : 'system'}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'בהיר', icon: Sun },
              { value: 'dark', label: 'כהה', icon: Moon },
              { value: 'system', label: 'מערכת', icon: Monitor },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">צבע ראשי</CardTitle>
          <CardDescription>הצבע המוביל של הכפתורים, הקישורים והתפריט</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((preset) => {
              const isSelected = mounted && color === preset;

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  aria-label={COLOR_PRESETS[preset].name}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(${COLOR_PRESETS[preset].dark.primary})` }}
                  />
                  {COLOR_PRESETS[preset].name}
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
