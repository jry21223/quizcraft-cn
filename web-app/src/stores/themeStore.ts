import { create } from 'zustand';

const KEY = 'theme-preference';

function getInitial(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return v === 'dark';
  } catch {}
  return false; // default light
}

function apply(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  try { localStorage.setItem(KEY, isDark ? 'dark' : 'light'); } catch {}
  // Notify Android WebView if available
  try {
    const bridge = (window as any).AndroidBridge;
    if (bridge?.setDarkMode) bridge.setDarkMode(isDark);
  } catch {}
}

if (typeof document !== 'undefined') {
  apply(getInitial());
}

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false,
  toggle: () => {
    const next = !get().isDark;
    set({ isDark: next });
    apply(next);
  },
}));
