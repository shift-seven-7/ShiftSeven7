export const COLOR_PRESETS = {
  violet: {
    name: 'סגול',
    value: 'violet',
    hue: 263,
    light: {
      primary: '263 70% 50%',
      'primary-hover': '263 70% 44%',
      'primary-muted': '263 70% 45%',
    },
    dark: {
      primary: '263 70% 58%',
      'primary-hover': '263 70% 65%',
      'primary-muted': '263 70% 48%',
    },
  },
  blue: {
    name: 'כחול',
    value: 'blue',
    hue: 217,
    light: {
      primary: '217 91% 50%',
      'primary-hover': '217 91% 44%',
      'primary-muted': '217 91% 45%',
    },
    dark: {
      primary: '217 91% 60%',
      'primary-hover': '217 91% 67%',
      'primary-muted': '217 91% 50%',
    },
  },
  emerald: {
    name: 'ירוק',
    value: 'emerald',
    hue: 160,
    light: {
      primary: '160 84% 39%',
      'primary-hover': '160 84% 33%',
      'primary-muted': '160 84% 34%',
    },
    dark: {
      primary: '160 84% 45%',
      'primary-hover': '160 84% 52%',
      'primary-muted': '160 84% 38%',
    },
  },
  teal: {
    name: 'טורקיז',
    value: 'teal',
    hue: 175,
    light: {
      primary: '175 77% 40%',
      'primary-hover': '175 77% 34%',
      'primary-muted': '175 77% 35%',
    },
    dark: {
      primary: '175 77% 48%',
      'primary-hover': '175 77% 55%',
      'primary-muted': '175 77% 40%',
    },
  },
  orange: {
    name: 'כתום',
    value: 'orange',
    hue: 25,
    light: {
      primary: '25 95% 53%',
      'primary-hover': '25 95% 47%',
      'primary-muted': '25 95% 48%',
    },
    dark: {
      primary: '25 95% 58%',
      'primary-hover': '25 95% 65%',
      'primary-muted': '25 95% 50%',
    },
  },
  rose: {
    name: 'ורוד',
    value: 'rose',
    hue: 350,
    light: {
      primary: '350 89% 55%',
      'primary-hover': '350 89% 49%',
      'primary-muted': '350 89% 50%',
    },
    dark: {
      primary: '350 89% 60%',
      'primary-hover': '350 89% 67%',
      'primary-muted': '350 89% 52%',
    },
  },
  red: {
    name: 'אדום',
    value: 'red',
    hue: 0,
    light: {
      primary: '0 72% 50%',
      'primary-hover': '0 72% 44%',
      'primary-muted': '0 72% 45%',
    },
    dark: {
      primary: '0 72% 55%',
      'primary-hover': '0 72% 62%',
      'primary-muted': '0 72% 47%',
    },
  },
} as const;

export type ColorPreset = keyof typeof COLOR_PRESETS;
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemePreferences {
  mode: ThemeMode;
  color: ColorPreset;
}

export const DEFAULT_THEME: ThemePreferences = {
  mode: 'dark',
  color: 'violet',
};
